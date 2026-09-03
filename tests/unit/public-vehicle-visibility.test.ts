import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { VehicleStatus } from "@/generated/prisma/enums"

/**
 * The public marketplace must never show a vehicle that is not PUBLISHED.
 *
 * This is the Phase 6 trap in one sentence. The admin list query applies no
 * status filter by default — correctly, because an operator has to be able
 * to find a vehicle they archived — and reusing it behind /cars would put
 * unfinished drafts, sold cars and withdrawn listings in front of customers
 * at prices nobody meant to publish.
 *
 * Two things are asserted here, and they fail for different reasons on
 * purpose: that the public reads pin the status no matter what they are
 * asked for, and that no customer-facing route imports the admin module at
 * all. The second is what stops the first from being bypassed rather than
 * broken.
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
    vehicle: {
      count: record("count"),
      findMany: record("findMany"),
      findFirst: record("findFirst"),
    },
  },
}))

vi.mock("@/lib/storage/vehicle-media", () => ({
  vehiclePhotoPublicUrl: (storagePath: string) => `https://example.test/${storagePath}`,
}))

const {
  PUBLIC_VEHICLE_STATUS,
  RELATED_VEHICLES_LIMIT,
  getPublishedVehicleBySlug,
  listPublishedVehicles,
  listRelatedVehicles,
  publicVehicleWhere,
} = await import("@/lib/queries/public-vehicle.queries")

beforeEach(() => {
  queries = []
})

describe("publicVehicleWhere", () => {
  it("pins the status to PUBLISHED with no filters at all", () => {
    expect(publicVehicleWhere()).toEqual({ status: VehicleStatus.PUBLISHED })
  })

  it("keeps the caller's filters alongside it", () => {
    expect(publicVehicleWhere({ make: "Toyota", year: { gte: 2020 } })).toEqual({
      make: "Toyota",
      year: { gte: 2020 },
      status: VehicleStatus.PUBLISHED,
    })
  })

  it("wins over a status an untyped caller smuggles in", () => {
    /**
     * `status` is excluded from the parameter type, so this cannot happen in
     * typed code — the cast is standing in for the one caller that is not
     * typed: a future API route building a filter from a query string.
     * Spreading before the status is what makes the override inert.
     */
    const where = publicVehicleWhere({
      status: VehicleStatus.DRAFT,
    } as never)

    expect(where.status).toBe(VehicleStatus.PUBLISHED)
  })

  it("names PUBLISHED as the only publicly visible status", () => {
    expect(PUBLIC_VEHICLE_STATUS).toBe(VehicleStatus.PUBLISHED)

    // Spelled out so adding a status to the enum without deciding whether
    // customers may see it is a failing test rather than a silent leak.
    const hidden = Object.values(VehicleStatus).filter(
      (status) => status !== PUBLIC_VEHICLE_STATUS
    )

    expect(hidden.sort()).toEqual(["ARCHIVED", "DRAFT", "RESERVED", "SOLD"])
  })
})

describe("listPublishedVehicles", () => {
  it("filters both the count and the page by PUBLISHED", async () => {
    await listPublishedVehicles()

    expect(queries.map((query) => query.method).sort()).toEqual(["count", "findMany"])

    for (const query of queries) {
      expect(query.where).toMatchObject({ status: VehicleStatus.PUBLISHED })
    }
  })

  it("still pins the status when search filters are applied", async () => {
    await listPublishedVehicles({ filters: { make: "Toyota" }, page: 3 })

    for (const query of queries) {
      expect(query.where).toMatchObject({
        make: "Toyota",
        status: VehicleStatus.PUBLISHED,
      })
    }
  })
})

describe("listRelatedVehicles", () => {
  it("pins the status, so a related strip cannot leak a draft or a sold car", async () => {
    await listRelatedVehicles({
      make: "Toyota",
      excludeSlug: "toyota-harrier-2021-clm-v-2026-000123",
    })

    expect(queries).toHaveLength(1)
    expect(queries[0].where).toMatchObject({
      make: "Toyota",
      status: VehicleStatus.PUBLISHED,
    })
  })

  it("excludes the vehicle whose page it is rendered on", async () => {
    await listRelatedVehicles({ make: "Toyota", excludeSlug: "the-open-listing" })

    expect(queries[0].where).toMatchObject({ slug: { not: "the-open-listing" } })
  })

  it("caps the strip at a length someone will actually swipe", () => {
    expect(RELATED_VEHICLES_LIMIT).toBe(8)
  })

  it("never asks the database for a negative page", async () => {
    // `take: -1` is legal Prisma and means "walk backwards", which would
    // silently return the wrong end of the list rather than an error.
    await listRelatedVehicles({ make: "Toyota", excludeSlug: "x", limit: -5 })

    expect(queries).toHaveLength(1)
  })
})

describe("getPublishedVehicleBySlug", () => {
  it("looks a slug up with the visibility clause, not by unique key", async () => {
    await getPublishedVehicleBySlug("toyota-harrier-2021-clm-v-2026-000123")

    // `findUnique` on the slug would hand a draft or a sold vehicle to
    // anyone holding the URL and leave the page to remember to check.
    expect(queries).toEqual([
      {
        method: "findFirst",
        where: {
          slug: "toyota-harrier-2021-clm-v-2026-000123",
          status: VehicleStatus.PUBLISHED,
        },
      },
    ])
  })

  it("reports an unpublished slug as simply not found", async () => {
    await expect(getPublishedVehicleBySlug("an-archived-listing")).resolves.toBeNull()
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
  it("imports no admin vehicle query from a customer-facing route", () => {
    /**
     * A static check, because this is a mistake that is only ever made once
     * and only ever noticed by a customer. `listVehicles` is two characters
     * away from being autocompleted into a public page, and it would render
     * a perfectly convincing catalogue of vehicles that are not for sale.
     */
    const publicRoutes = [
      path.join(SRC, "app", "(public)"),
      path.join(SRC, "app", "api"),
    ].flatMap(sourceFiles)

    const offenders = publicRoutes.filter((file) =>
      /from\s+["']@\/lib\/queries\/vehicle\.queries["']/.test(readFileSync(file, "utf8"))
    )

    expect(offenders).toEqual([])
  })
})
