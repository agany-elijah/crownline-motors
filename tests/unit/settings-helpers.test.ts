import { describe, expect, it } from "vitest"

import { readPngDimensions } from "@/lib/constants/branding-options"
import { diffSettings } from "@/lib/settings/audit-diff"
import {
  DEFAULT_BUSINESS_HOURS,
  formatTimeOfDay,
  summariseBusinessHours,
} from "@/lib/settings/business-hours"
import { DEFAULT_CATALOG_DISPLAY } from "@/lib/settings/catalog-display"
import {
  businessHoursSchema,
  resolveBusinessHours,
  resolveCatalogDisplay,
} from "@/lib/validations/settings.schema"

describe("business hours", () => {
  it("writes the default week as two lines", () => {
    expect(summariseBusinessHours(DEFAULT_BUSINESS_HOURS)).toEqual([
      "Mon – Sat: 8:00 AM – 6:00 PM",
      "Sun: Closed",
    ])
  })

  it("only groups consecutive days with identical hours", () => {
    const hours = DEFAULT_BUSINESS_HOURS.map((day) =>
      day.day === "WEDNESDAY" ? { ...day, closesAt: "13:00" } : day
    )

    expect(summariseBusinessHours(hours)).toEqual([
      "Mon – Tue: 8:00 AM – 6:00 PM",
      "Wed: 8:00 AM – 1:00 PM",
      "Thu – Sat: 8:00 AM – 6:00 PM",
      "Sun: Closed",
    ])
  })

  it("formats midnight and noon correctly", () => {
    expect(formatTimeOfDay("00:30")).toBe("12:30 AM")
    expect(formatTimeOfDay("12:00")).toBe("12:00 PM")
  })

  it("refuses a closing time before the opening time, but not on a closed day", () => {
    const backwards = DEFAULT_BUSINESS_HOURS.map((day) =>
      day.day === "MONDAY" ? { ...day, opensAt: "18:00", closesAt: "08:00" } : day
    )
    expect(businessHoursSchema.safeParse(backwards).success).toBe(false)

    const closed = backwards.map((day) => (day.day === "MONDAY" ? { ...day, closed: true } : day))
    expect(businessHoursSchema.safeParse(closed).success).toBe(true)
  })

  it("treats a malformed stored value as unpublished rather than throwing", () => {
    expect(resolveBusinessHours([{ day: "FUNDAY" }])).toBeNull()
    expect(resolveBusinessHours(null)).toBeNull()
  })
})

describe("catalogue display", () => {
  it("uses the defaults when nothing is stored", () => {
    expect(resolveCatalogDisplay(null)).toEqual(DEFAULT_CATALOG_DISPLAY)
  })

  it("merges a partial stored value over the defaults", () => {
    const resolved = resolveCatalogDisplay({ vehicle: { price: false }, actions: { whatsapp: false } })

    expect(resolved.vehicle.price).toBe(false)
    expect(resolved.vehicle.mileage).toBe(true)
    expect(resolved.actions.whatsapp).toBe(false)
    expect(resolved.sparePart).toEqual(DEFAULT_CATALOG_DISPLAY.sparePart)
  })

  it("reads a row saved before the switches were site-wide", () => {
    // An operator who had switched the category off must not see it return.
    const resolved = resolveCatalogDisplay({
      vehicleCard: { location: false },
      sparePartCard: { category: false, stockQuantity: true },
    })

    expect(resolved.vehicle.location).toBe(false)
    expect(resolved.vehicle.driveType).toBe(true)
    expect(resolved.sparePart.category).toBe(false)
    expect(resolved.sparePart.stockQuantity).toBe(true)
  })

  it("prefers the current groups over the legacy ones", () => {
    const resolved = resolveCatalogDisplay({ vehicle: { price: true }, vehicleCard: { price: false } })
    expect(resolved.vehicle.price).toBe(true)
  })

  it("keeps the stock count private by default", () => {
    expect(resolveCatalogDisplay(null).sparePart.stockQuantity).toBe(false)
  })

  it("ignores non-boolean values instead of treating them as off", () => {
    expect(resolveCatalogDisplay({ vehicle: "yes" })).toEqual(DEFAULT_CATALOG_DISPLAY)
  })
})

describe("settings audit diff", () => {
  it("records only what changed", () => {
    expect(
      diffSettings({ businessName: "Crownline Motors", primaryPhone: "+211" }, { businessName: "Crown Motors", primaryPhone: "+211" })
    ).toEqual([{ field: "businessName", from: "Crownline Motors", to: "Crown Motors" }])
  })

  it("treats equal numbers and reordered objects as unchanged", () => {
    expect(diffSettings({ defaultInitialPercentage: "50.00" }, { defaultInitialPercentage: 50 })).toEqual([])
    expect(diffSettings({ hours: { closesAt: "18:00", day: "MONDAY" } }, { hours: { day: "MONDAY", closesAt: "18:00" } })).toEqual([])
  })

  it("reports a group of switches switch by switch, not as JSON", () => {
    const changes = diffSettings(
      { catalogDisplay: { sparePart: { category: true, price: true } } },
      { catalogDisplay: { sparePart: { category: false, price: true } } },
      { catalogDisplay: "Catalogue display" }
    )

    expect(changes).toEqual([{ field: "Catalogue display › spare part › category", from: "true", to: "false" }])
  })

  it("uses operator-facing labels and clips long values", () => {
    const [change] = diffSettings({ quoteTerms: null }, { quoteTerms: "x".repeat(400) }, { quoteTerms: "Terms" })
    expect(change.field).toBe("Terms")
    expect(change.to?.length).toBeLessThanOrEqual(160)
  })
})

describe("PNG dimensions", () => {
  it("reads width and height from the header", () => {
    const bytes = new Uint8Array(24)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
    new DataView(bytes.buffer).setUint32(16, 512)
    new DataView(bytes.buffer).setUint32(20, 256)

    expect(readPngDimensions(bytes)).toEqual({ width: 512, height: 256 })
  })

  it("returns null for anything that is not a PNG", () => {
    expect(readPngDimensions(new Uint8Array(24))).toBeNull()
  })
})
