import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { SparePartStatus } from "@/generated/prisma/enums"

/**
 * The public parts catalogue must never show a part that is not PUBLISHED,
 * and must never carry an internal column to the browser.
 *
 * Two separate hazards, and the parts domain has both where the vehicle
 * domain has one.
 *
 * The first is the familiar Phase 6 trap: the admin list query applies no
 * status filter by default — correctly, because an operator has to be able to
 * find a part they archived — and reusing it behind /spare-parts would put
 * unfinished drafts and withdrawn listings in front of customers at prices
 * nobody meant to publish.
 *
 * The second is specific to parts: `SparePart` carries `supplierName` and
 * `supplierNotes`, which record where stock came from, what it cost and how
 * long it takes. Publishing those would hand every customer the dealership's
 * margin. The dealership has also asked that condition, country of origin,
 * pricing mode and stock stay off the public catalogue. None of those is
 * enforced by a status filter — the defence is that the public DTOs never
 * select the columns, which is what the last group of assertions checks.
 */

/** Every `where` handed to Prisma during a test, in call order. */
let queries: { method: string; where: unknown }[] = []

function record(method: string) {
  return async (args: { where?: unknown }) => {
    queries.push({ method, where: args?.where })
    return method === "count" ? 0 : method === "findMany" ? [] : null
  }
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // The list query batches count + findMany through `$transaction`, which
    // receives already-built promises — recording happens as each is
    // constructed, so the array is populated by the time this resolves.
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    sparePart: {
      count: record("count"),
      findMany: record("findMany"),
      findFirst: record("findFirst"),
      groupBy: async () => [],
    },
    sparePartCategory: {
      findMany: async () => [],
    },
  },
}))

vi.mock("@/lib/storage/spare-part-media", () => ({
  sparePartPhotoPublicUrl: (storagePath: string) =>
    `https://example.test/${storagePath}`,
}))

const {
  PUBLIC_SPARE_PART_STATUS,
  RELATED_SPARE_PARTS_LIMIT,
  getPublishedSparePartBySlug,
  listPublishedSpareParts,
  listRelatedSpareParts,
  publicSparePartWhere,
  sparePartSearchWhere,
} = await import("@/lib/queries/public-spare-part.queries")

beforeEach(() => {
  queries = []
})

describe("publicSparePartWhere", () => {
  it("pins the status to PUBLISHED with no filters at all", () => {
    expect(publicSparePartWhere()).toEqual({ status: SparePartStatus.PUBLISHED })
  })

  it("keeps the caller's filters alongside it", () => {
    expect(publicSparePartWhere({ category: { slug: "brakes" } })).toEqual({
      category: { slug: "brakes" },
      status: SparePartStatus.PUBLISHED,
    })
  })

  it("wins over a status an untyped caller smuggles in", () => {
    /**
     * `status` is excluded from the parameter type, so this cannot happen in
     * typed code — the cast stands in for the one caller that is not typed: a
     * future API route building a filter from a query string. Spreading
     * before the status is what makes the override inert.
     */
    const where = publicSparePartWhere({ status: SparePartStatus.DRAFT } as never)

    expect(where.status).toBe(SparePartStatus.PUBLISHED)
  })

  it("names PUBLISHED as the only publicly visible status", () => {
    expect(PUBLIC_SPARE_PART_STATUS).toBe(SparePartStatus.PUBLISHED)

    // Spelled out so adding a status to the enum without deciding whether
    // customers may see it is a failing test rather than a silent leak.
    const hidden = Object.values(SparePartStatus).filter(
      (status) => status !== PUBLIC_SPARE_PART_STATUS
    )

    expect(hidden.sort()).toEqual(["ARCHIVED", "DRAFT"])
  })
})

describe("sparePartSearchWhere", () => {
  it("matches a word against the name, the OEM number and our reference", () => {
    const where = sparePartSearchWhere({ q: "33471", category: undefined })

    expect(where.AND).toEqual([
      {
        OR: [
          { name: { contains: "33471", mode: "insensitive" } },
          { oemPartNumber: { contains: "33471", mode: "insensitive" } },
          { referenceNumber: { contains: "33471", mode: "insensitive" } },
        ],
      },
    ])
  })

  it("ANDs the words so every one of them has to match something", () => {
    // "harrier pads" must mean "a Harrier pad", not "anything Harrier-ish or
    // any pad" — the second reading returns half the catalogue and looks like
    // a search that ignored the query.
    const where = sparePartSearchWhere({ q: "harrier pads", category: undefined })

    expect(where.AND).toHaveLength(2)
  })

  it("escapes the wildcards LIKE would otherwise read", () => {
    // Prisma binds the value, so this is a correctness fix rather than an
    // injection defence: an unescaped `%` matches every part in the
    // catalogue, which reads as a broken search rather than a clever one.
    const where = sparePartSearchWhere({ q: "100%", category: undefined })

    expect(JSON.stringify(where)).toContain("100\\\\%")
  })

  it("caps how many words one query turns into", () => {
    const where = sparePartSearchWhere({
      q: "one two three four five six seven eight",
      category: undefined,
    })

    expect(where.AND).toHaveLength(6)
  })

  it("filters by category slug rather than by id", () => {
    // A slug is stable, readable in a shared link, and survives a restore
    // into an environment where ids differ.
    expect(
      sparePartSearchWhere({ q: undefined, category: "brakes" }).category
    ).toEqual({ slug: "brakes" })
  })

  it("narrows nothing when neither filter is present", () => {
    expect(sparePartSearchWhere({ q: undefined, category: undefined })).toEqual({})
  })
})

describe("listPublishedSpareParts", () => {
  it("filters both the count and the page by PUBLISHED", async () => {
    await listPublishedSpareParts()

    expect(queries.map((query) => query.method).sort()).toEqual([
      "count",
      "findMany",
    ])

    for (const query of queries) {
      expect(query.where).toMatchObject({ status: SparePartStatus.PUBLISHED })
    }
  })

  it("still pins the status when a search is applied", async () => {
    await listPublishedSpareParts({
      page: 2,
      criteria: { q: "brake", category: "brakes" },
    })

    for (const query of queries) {
      expect(query.where).toMatchObject({
        status: SparePartStatus.PUBLISHED,
        category: { slug: "brakes" },
      })
      expect(JSON.stringify(query.where)).toContain("brake")
    }
  })
})

describe("listRelatedSpareParts", () => {
  it("pins the status, so a related strip cannot leak a draft", async () => {
    await listRelatedSpareParts({
      categorySlug: "brakes",
      excludeSlug: "front-brake-pads-clm-sp-2026-000001",
    })

    expect(queries).toHaveLength(1)
    expect(queries[0].where).toMatchObject({
      category: { slug: "brakes" },
      status: SparePartStatus.PUBLISHED,
    })
  })

  it("excludes the part whose page it is rendered on", async () => {
    await listRelatedSpareParts({
      categorySlug: "brakes",
      excludeSlug: "the-open-listing",
    })

    expect(queries[0].where).toMatchObject({ slug: { not: "the-open-listing" } })
  })

  it("caps the strip at a length someone will actually swipe", () => {
    expect(RELATED_SPARE_PARTS_LIMIT).toBe(12)
  })

  it("never asks the database for a negative page", async () => {
    // `take: -1` is legal Prisma and means "walk backwards", which would
    // silently return the wrong end of the list rather than an error.
    await listRelatedSpareParts({
      categorySlug: "brakes",
      excludeSlug: "x",
      limit: -5,
    })

    expect(queries).toHaveLength(1)
  })
})

describe("getPublishedSparePartBySlug", () => {
  it("looks a slug up with the visibility clause, not by unique key", async () => {
    await getPublishedSparePartBySlug("front-brake-pads-clm-sp-2026-000001")

    // `findUnique` on the slug would hand a draft or an archived part to
    // anyone holding the URL and leave the page to remember to check.
    expect(queries).toEqual([
      {
        method: "findFirst",
        where: {
          slug: "front-brake-pads-clm-sp-2026-000001",
          status: SparePartStatus.PUBLISHED,
        },
      },
    ])
  })

  it("reports an unpublished slug as simply not found", async () => {
    await expect(
      getPublishedSparePartBySlug("an-archived-listing")
    ).resolves.toBeNull()
  })
})

/* ── The import boundary ─────────────────────────────────────────── */

const SRC = path.join(process.cwd(), "src")

/** Every .ts/.tsx file below `dir`. */
function sourceFiles(dir: string): string[] {
  const found: string[] = []

  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)

    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full))
      continue
    }

    if (/\.tsx?$/.test(entry)) found.push(full)
  }

  return found
}

describe("the public site never reaches the admin queries", () => {
  it("imports no admin spare-part query from a customer-facing route", () => {
    /**
     * A static check, because this is a mistake that is only ever made once
     * and only ever noticed by a customer. `listSpareParts` is two characters
     * away from being autocompleted into a public page, and it would render a
     * convincing catalogue of parts that are not for sale — with the supplier
     * and cost notes attached.
     */
    const offenders = sourceFiles(path.join(SRC, "app", "(public)")).filter((file) =>
      /from\s+["']@\/lib\/queries\/spare-part\.queries["']/.test(
        readFileSync(file, "utf8")
      )
    )

    expect(offenders).toEqual([])
  })

  it("keeps every internal column out of the public read module", () => {
    /**
     * The columns the dealership has asked to stay off the catalogue, plus
     * the two that are commercially sensitive. None of these is protected by
     * the status filter: the defence is that the public module never selects
     * them, so no component downstream can render one by accident.
     *
     * `pricingMode` is included because a quoted part is represented to the
     * customer as `price: null` and nothing else — the internal name of the
     * strategy is not something the catalogue exposes.
     *
     * `isFeatured` is deliberately *not* on this list. It appears in the
     * module, in `CARD_ORDER_BY` — ordering the catalogue featured-first
     * publishes nothing about any individual part, and no DTO carries it.
     */
    const source = readFileSync(
      path.join(SRC, "lib", "queries", "public-spare-part.queries.ts"),
      "utf8"
    )

    // Comments explain exactly which columns are excluded and why, so they
    // are stripped before the check — otherwise the file's own reasoning
    // would fail the assertion it exists to support.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")

    for (const column of [
      "supplierName",
      "supplierNotes",
      "stockQuantity",
      "pricingMode",
      "condition",
      "countryOfOrigin",
    ]) {
      expect(code).not.toContain(column)
    }
  })
})
