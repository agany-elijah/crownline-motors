import { describe, expect, it, vi } from "vitest"

import { VehicleStatus } from "@/generated/prisma/enums"
import {
  buildCatalogueQuery,
  catalogueHref,
  hasActiveSearch,
  parseVehicleSearchParams,
} from "@/lib/validations/vehicle-search.schema"
import { VEHICLE_YEAR_MIN, vehicleYearMax } from "@/lib/constants/vehicle-options"

/**
 * The public catalogue's search (Stage 12).
 *
 * Three things are pinned here, and they fail for different reasons:
 *
 *   - **Parsing** must be forgiving. Every value arrives in a query string
 *     that is bookmarked, pasted into WhatsApp, and rewritten by link
 *     previewers, so rubbish has to degrade to "not filtered" rather than to
 *     an error page.
 *   - **The where clause** must AND the filters and must never be able to
 *     widen visibility. A search that could return a draft or a sold vehicle
 *     is the Phase 6 trap arriving through a new door.
 *   - **URL building** must carry the filters through pagination. Losing
 *     them on page two is invisible until the inventory is big enough to
 *     have a page two, which is exactly when it matters.
 */

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

const { vehicleSearchTerms, vehicleSearchWhere } = await import(
  "@/lib/queries/public-vehicle.queries"
)

describe("parseVehicleSearchParams", () => {
  it("returns the full published set when nothing is filtered", () => {
    const parsed = parseVehicleSearchParams({})

    expect(parsed).toEqual({
      make: undefined,
      model: undefined,
      year: undefined,
      page: 1,
    })
    expect(hasActiveSearch(parsed)).toBe(false)
  })

  it("combines make, model and year", () => {
    const parsed = parseVehicleSearchParams({
      make: "Toyota",
      model: "Harrier",
      year: "2021",
    })

    expect(parsed).toMatchObject({ make: "Toyota", model: "Harrier", year: 2021 })
    expect(hasActiveSearch(parsed)).toBe(true)
  })

  it("treats an empty value as no filter", () => {
    // A GET form submits every select, so an untouched filter bar posts
    // "?make=&model=&year=". Those must mean "any", not "match the empty
    // string" — which would return nothing and look like a broken search.
    const parsed = parseVehicleSearchParams({ make: "", model: "  ", year: "" })

    expect(hasActiveSearch(parsed)).toBe(false)
  })

  it("trims surrounding whitespace", () => {
    expect(parseVehicleSearchParams({ make: "  Toyota " }).make).toBe("Toyota")
  })

  it("ignores a non-numeric year rather than failing the page", () => {
    expect(parseVehicleSearchParams({ year: "banana" }).year).toBeUndefined()
    expect(parseVehicleSearchParams({ year: "20.5" }).year).toBeUndefined()
  })

  it("ignores a year outside the range a listing could hold", () => {
    expect(
      parseVehicleSearchParams({ year: String(VEHICLE_YEAR_MIN - 1) }).year
    ).toBeUndefined()
    expect(
      parseVehicleSearchParams({ year: String(vehicleYearMax() + 1) }).year
    ).toBeUndefined()
  })

  it("accepts the boundaries of that range", () => {
    expect(parseVehicleSearchParams({ year: String(VEHICLE_YEAR_MIN) }).year).toBe(
      VEHICLE_YEAR_MIN
    )
    expect(parseVehicleSearchParams({ year: String(vehicleYearMax()) }).year).toBe(
      vehicleYearMax()
    )
  })

  it("caps an over-long text filter instead of passing it to the database", () => {
    // A hand-edited URL carrying kilobytes of text must not reach a query.
    const parsed = parseVehicleSearchParams({ make: "x".repeat(500) })

    expect(parsed.make).toBeUndefined()
  })

  it("falls back to page one for junk and out-of-range pages", () => {
    expect(parseVehicleSearchParams({ page: "0" }).page).toBe(1)
    expect(parseVehicleSearchParams({ page: "-4" }).page).toBe(1)
    expect(parseVehicleSearchParams({ page: "banana" }).page).toBe(1)
    expect(parseVehicleSearchParams({ page: "2" }).page).toBe(2)
  })

  it("takes the first value when a key is repeated", () => {
    // "?make=Toyota&make=Nissan" is not a filter anything can satisfy.
    expect(parseVehicleSearchParams({ make: ["Toyota", "Nissan"] }).make).toBe(
      "Toyota"
    )
  })
})

describe("parseVehicleSearchParams — the free-text box", () => {
  it("keeps a typed query", () => {
    expect(parseVehicleSearchParams({ q: "Toyota Harrier" }).q).toBe("Toyota Harrier")
  })

  it("collapses whitespace so one search has one address", () => {
    // "toyota   harrier" and "toyota harrier" are the same search. Left
    // alone they would be two URLs over one result set, which splits
    // caching and search-engine signal for no reason.
    expect(parseVehicleSearchParams({ q: "  toyota   harrier " }).q).toBe(
      "toyota harrier"
    )
  })

  it("treats an empty box as no search", () => {
    // A GET form submits every field, so an untouched bar posts "?q=".
    expect(parseVehicleSearchParams({ q: "" }).q).toBeUndefined()
    expect(parseVehicleSearchParams({ q: "   " }).q).toBeUndefined()
    expect(hasActiveSearch(parseVehicleSearchParams({ q: " " }))).toBe(false)
  })

  it("counts a text search as an active search", () => {
    // The empty state and the result-count wording both branch on this: a
    // fruitless text search must say "no vehicles match", not "no vehicles
    // listed yet".
    expect(hasActiveSearch(parseVehicleSearchParams({ q: "harrier" }))).toBe(true)
  })

  it("drops a pasted paragraph rather than sending it to the database", () => {
    expect(parseVehicleSearchParams({ q: "x".repeat(500) }).q).toBeUndefined()
  })
})

describe("vehicleSearchTerms", () => {
  it("splits a query into words", () => {
    expect(vehicleSearchTerms("toyota harrier")).toEqual([
      { pattern: "toyota", year: null },
      { pattern: "harrier", year: null },
    ])
  })

  it("recognises a four-digit word as a year", () => {
    expect(vehicleSearchTerms("harrier 2021")).toEqual([
      { pattern: "harrier", year: null },
      { pattern: "2021", year: 2021 },
    ])
  })

  it("treats a four-digit number no listing could hold as text", () => {
    // "1234" is not a model year, and matching it as one would silently
    // widen the search to every vehicle in a year that cannot exist.
    expect(vehicleSearchTerms("1234")).toEqual([{ pattern: "1234", year: null }])
  })

  it("escapes the wildcards LIKE would otherwise read", () => {
    // Not an injection defence — Prisma binds the value — but a customer
    // typing "%" must not match the entire floor, and "_" must not match
    // any single character.
    expect(vehicleSearchTerms("100%")).toEqual([
      { pattern: "100\\%", year: null },
    ])
    expect(vehicleSearchTerms("a_b")).toEqual([{ pattern: "a\\_b", year: null }])
    expect(vehicleSearchTerms("a\\b")).toEqual([
      { pattern: "a\\\\b", year: null },
    ])
  })

  it("caps how many words reach the database", () => {
    // A hand-edited URL must not turn one page load into eighty scans.
    expect(vehicleSearchTerms("a b c d e f g h i j")).toHaveLength(6)
  })

  it("returns nothing for an absent query", () => {
    expect(vehicleSearchTerms(undefined)).toEqual([])
  })
})

describe("vehicleSearchWhere", () => {
  it("produces no constraints when nothing is filtered", () => {
    expect(vehicleSearchWhere({})).toEqual({})
  })

  it("matches a make or model case-insensitively", () => {
    // The URL is hand-editable and shared, so "?make=toyota" typed on a
    // phone must find the same cars as the dropdown's "Toyota".
    expect(vehicleSearchWhere({ make: "toyota" })).toEqual({
      make: { equals: "toyota", mode: "insensitive" },
    })
  })

  it("matches a whole value, never a fragment", () => {
    // `contains` would make "Prado" also match "Land Cruiser Prado SX",
    // which silently returns something the customer did not pick.
    const where = vehicleSearchWhere({ model: "Harrier" }) as {
      model?: Record<string, unknown>
    }

    expect(where.model).toHaveProperty("equals")
    expect(where.model).not.toHaveProperty("contains")
  })

  it("ANDs all three filters", () => {
    // The brief's "Toyota → Harrier → 2021" journey. A flat object is an
    // AND in Prisma; anything nested under OR here would widen the search.
    const where = vehicleSearchWhere({
      make: "Toyota",
      model: "Harrier",
      year: 2021,
    })

    expect(where).toEqual({
      make: { equals: "Toyota", mode: "insensitive" },
      model: { equals: "Harrier", mode: "insensitive" },
      year: 2021,
    })
    expect(where).not.toHaveProperty("OR")
  })

  it("matches each word against make, model or year", () => {
    // One box standing in for three fields: the customer should not have to
    // decide which one they are searching.
    const where = vehicleSearchWhere({ q: "harrier" })

    expect(where.AND).toEqual([
      {
        OR: [
          { make: { contains: "harrier", mode: "insensitive" } },
          { model: { contains: "harrier", mode: "insensitive" } },
        ],
      },
    ])
  })

  it("ANDs the words and ORs the fields within each", () => {
    // "harrier 2021" means "a Harrier, from 2021". The other reading —
    // anything Harrier-ish OR anything from 2021 — returns the whole 2021
    // floor and looks like a search that ignored half the query.
    const where = vehicleSearchWhere({ q: "harrier 2021" })

    expect(where.AND).toHaveLength(2)
    expect(where.AND).toEqual([
      {
        OR: [
          { make: { contains: "harrier", mode: "insensitive" } },
          { model: { contains: "harrier", mode: "insensitive" } },
        ],
      },
      {
        OR: [
          { make: { contains: "2021", mode: "insensitive" } },
          { model: { contains: "2021", mode: "insensitive" } },
          { year: 2021 },
        ],
      },
    ])
  })

  it("matches text case-insensitively and partially", () => {
    // A customer typing into a box works from memory: half a name is a
    // legitimate query, and nobody capitalises in a hurry.
    const where = vehicleSearchWhere({ q: "HARRIER" }) as {
      AND?: { OR: { make?: Record<string, unknown> }[] }[]
    }

    expect(where.AND?.[0].OR[0].make).toEqual({
      contains: "HARRIER",
      mode: "insensitive",
    })
  })

  it("narrows with the dropdowns rather than replacing them", () => {
    // Typing "harrier" and then choosing 2021 must return vehicles matching
    // both. A flat object is an AND in Prisma.
    const where = vehicleSearchWhere({ q: "harrier", make: "Toyota", year: 2021 })

    expect(where.make).toEqual({ equals: "Toyota", mode: "insensitive" })
    expect(where.year).toBe(2021)
    expect(where.AND).toHaveLength(1)
  })

  it("cannot smuggle a status past the visibility rule", async () => {
    // The guarantee that matters most: search is a new way into the public
    // reads, and it must not become a way to ask for a draft or a sold car.
    const { publicVehicleWhere } = await import("@/lib/queries/public-vehicle.queries")

    const where = publicVehicleWhere({
      ...vehicleSearchWhere({ make: "Toyota" }),
      // What a hostile or careless caller might try to add.
      ...({ status: VehicleStatus.DRAFT } as object),
    })

    expect(where.status).toBe(VehicleStatus.PUBLISHED)
  })
})

describe("catalogueHref", () => {
  it("returns the bare catalogue when nothing is filtered", () => {
    // "/cars" and "/cars?page=1" must not become two URLs for one page.
    expect(catalogueHref({})).toBe("/cars")
    expect(catalogueHref({}, 1)).toBe("/cars")
  })

  it("carries the filters into a page link", () => {
    // The paginated-search bug: page two silently dropping the filters and
    // showing the whole floor.
    expect(catalogueHref({ make: "Toyota", model: "Harrier" }, 2)).toBe(
      "/cars?make=Toyota&model=Harrier&page=2"
    )
  })

  it("percent-encodes values rather than concatenating them", () => {
    const href = catalogueHref({ make: "Mercedes-Benz & Co", model: "S/500" })

    expect(href).toContain("make=Mercedes-Benz+%26+Co")
    expect(href).toContain("model=S%2F500")
  })

  it("emits keys in a stable order", () => {
    // The same search must always produce the same URL, or one result set
    // ends up with several addresses in caches and in search results.
    const a = buildCatalogueQuery({ year: 2021, make: "Toyota", model: "Harrier" }, 3)
    const b = buildCatalogueQuery({ make: "Toyota", model: "Harrier", year: 2021 }, 3)

    expect(a).toBe(b)
    expect(a).toBe("make=Toyota&model=Harrier&year=2021&page=3")
  })

  it("round-trips through the parser", () => {
    const criteria = { make: "Toyota", model: "Harrier", year: 2021 }
    const query = Object.fromEntries(
      new URLSearchParams(buildCatalogueQuery(criteria, 2))
    )

    expect(parseVehicleSearchParams(query)).toEqual({ ...criteria, page: 2 })
  })
})
