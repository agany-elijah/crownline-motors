import { beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_CATALOG_DISPLAY, type CatalogDisplaySettings } from "@/lib/settings/catalog-display"
import { hiddenFieldsField } from "@/lib/validations/hidden-fields.schema"
import {
  SPARE_PART_INFO_FIELDS,
  VEHICLE_INFO_FIELDS,
  normalizeHiddenFields,
  resolveVisibility,
} from "@/lib/visibility/product-visibility"

/**
 * A fact an operator hides is hidden everywhere a customer can reach it.
 *
 * The rule is enforced where the public DTOs are built, so these tests drive
 * the real query modules with a stubbed database and assert on what leaves
 * them: a hidden value must be null in the payload, and search must not be
 * able to find a listing by it.
 */

const state = vi.hoisted(() => ({
  catalogDisplay: null as unknown as CatalogDisplaySettings,
  vehicleRow: null as Record<string, unknown> | null,
  partRow: null as Record<string, unknown> | null,
}))

vi.mock("@/lib/queries/settings.queries", () => ({
  getPublicSiteSettings: async () => ({ catalogDisplay: state.catalogDisplay }),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findFirst: async () => state.vehicleRow },
    sparePart: { findFirst: async () => state.partRow },
  },
}))

vi.mock("@/lib/storage/vehicle-media", () => ({ vehiclePhotoPublicUrl: (path: string) => `https://example.test/${path}` }))
vi.mock("@/lib/storage/spare-part-media", () => ({
  sparePartPhotoPublicUrl: (path: string) => `https://example.test/${path}`,
}))

const { getPublishedVehicleBySlug, vehicleSearchWhere } = await import("@/lib/queries/public-vehicle.queries")
const { getPublishedSparePartBySlug, sparePartSearchWhere } = await import("@/lib/queries/public-spare-part.queries")

const decimal = (value: number) => ({ toNumber: () => value })

beforeEach(() => {
  state.catalogDisplay = structuredClone(DEFAULT_CATALOG_DISPLAY)
  state.vehicleRow = {
    slug: "toyota-harrier",
    referenceNumber: "CLM-V-2026-000001",
    make: "Toyota",
    model: "Harrier",
    year: 2021,
    price: decimal(22500),
    mileageKm: 42000,
    fuelType: "PETROL",
    transmission: "AUTOMATIC",
    engineSize: "2.0L",
    driveType: "TWO_WD",
    exteriorColor: "Black",
    interiorColor: "Black",
    countryOfOrigin: "JAPAN",
    currentLocation: "Mombasa",
    condition: "USED",
    features: ["Sunroof"],
    hiddenFields: [],
    description: "A clean Harrier.",
    photos: [],
  }
  state.partRow = {
    slug: "brake-pads",
    referenceNumber: "CLM-SP-2026-000001",
    name: "Brake pads",
    oemPartNumber: "04465-48150",
    brand: "Denso",
    price: decimal(80),
    availability: "IN_STOCK",
    description: "Front pads.",
    hiddenFields: [],
    category: { name: "Brakes", slug: "brakes" },
    photos: [],
    compatibility: [{ id: "c1", make: "Toyota", model: "Harrier", yearFrom: 2020, yearTo: 2023, engine: null }],
  }
})

describe("visibility helpers", () => {
  it("needs both the site-wide switch and the listing's own choice", () => {
    const siteWide = { ...DEFAULT_CATALOG_DISPLAY.vehicle, mileage: false }
    const visible = resolveVisibility(VEHICLE_INFO_FIELDS, siteWide, ["price"])

    expect(visible.price).toBe(false)
    expect(visible.mileage).toBe(false)
    expect(visible.year).toBe(true)
  })

  it("normalises a stored list to known fields, in order, without repeats", () => {
    expect(normalizeHiddenFields(SPARE_PART_INFO_FIELDS, ["brand", "nonsense", "price", "brand"])).toEqual([
      "price",
      "brand",
    ])
    expect(normalizeHiddenFields(SPARE_PART_INFO_FIELDS, "price")).toEqual([])
  })
})

describe("the hiddenFields form field", () => {
  const schema = hiddenFieldsField(VEHICLE_INFO_FIELDS)

  it("reads the JSON array the form submits", () => {
    expect(schema.parse('["year","price"]')).toEqual(["price", "year"])
    expect(schema.parse("")).toEqual([])
    expect(schema.parse(undefined)).toEqual([])
  })

  it("refuses anything that is not a list of known fields", () => {
    expect(schema.safeParse('["year","supplierNotes"]').success).toBe(false)
    expect(schema.safeParse("{").success).toBe(false)
    expect(schema.safeParse('{"year":true}').success).toBe(false)
  })
})

describe("a vehicle's public payload", () => {
  it("carries every fact when nothing is hidden", async () => {
    const vehicle = await getPublishedVehicleBySlug("toyota-harrier")
    expect(vehicle).toMatchObject({ year: 2021, price: 22500, mileageKm: 42000, currentLocation: "Mombasa" })
  })

  it("nulls what the listing hides, and only that", async () => {
    state.vehicleRow!.hiddenFields = ["price", "year", "features"]
    const vehicle = await getPublishedVehicleBySlug("toyota-harrier-own")

    expect(vehicle).toMatchObject({ price: null, year: null, features: [], mileageKm: 42000, engineSize: "2.0L" })
  })

  it("nulls what Settings hides for every listing", async () => {
    state.catalogDisplay.vehicle.mileage = false
    state.catalogDisplay.vehicle.description = false
    const vehicle = await getPublishedVehicleBySlug("toyota-harrier-site")

    expect(vehicle).toMatchObject({ mileageKm: null, description: null, price: 22500 })
  })

  it("never searches by a year that is hidden site-wide", () => {
    const hidden = { ...DEFAULT_CATALOG_DISPLAY.vehicle, year: false }
    const where = vehicleSearchWhere({ q: "harrier 2021", year: 2021 }, hidden)

    expect(where.year).toBeUndefined()
    expect(JSON.stringify(where)).not.toContain("2021,")
    expect(JSON.stringify(where.AND)).not.toContain('"year"')
  })

  it("excludes listings that hide their own year from a year filter", () => {
    const where = vehicleSearchWhere({ year: 2021 })
    expect(where).toMatchObject({ year: 2021, NOT: { hiddenFields: { has: "year" } } })
  })
})

describe("a spare part's public payload", () => {
  it("represents a hidden price exactly like a quoted one", async () => {
    state.partRow!.hiddenFields = ["price", "partNumber", "compatibility"]
    const part = await getPublishedSparePartBySlug("brake-pads-own")

    expect(part).toMatchObject({ price: null, oemPartNumber: null, fitment: [], brand: "Denso" })
  })

  it("drops the category, name and link together when categories are hidden", async () => {
    state.catalogDisplay.sparePart.category = false
    const part = await getPublishedSparePartBySlug("brake-pads-site")

    expect(part).toMatchObject({ categoryName: null, categorySlug: null })
  })

  it("stops searching part numbers and filtering by category while they are hidden", () => {
    const hidden = { ...DEFAULT_CATALOG_DISPLAY.sparePart, partNumber: false, category: false }
    const where = sparePartSearchWhere({ q: "04465", category: "brakes" }, hidden)

    expect(JSON.stringify(where)).not.toContain("oemPartNumber")
    expect(where.category).toBeUndefined()
  })
})
