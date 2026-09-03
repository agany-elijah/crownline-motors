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

const { vehicleSearchWhere } = await import("@/lib/queries/public-vehicle.queries")

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
