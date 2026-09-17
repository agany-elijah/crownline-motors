import { describe, expect, it, vi } from "vitest"

import { buildVehicleSlug, slugifyFragment } from "@/lib/utils/slugify"
import { formatReference } from "@/lib/utils/generate-reference"
import {
  formatCurrency,
  formatCurrencyOrDash,
  formatMileage,
} from "@/lib/utils/format-currency"
import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleListFiltersSchema,
  VEHICLE_FEATURES_MAX,
  VEHICLE_FEATURE_MAX_LENGTH,
} from "@/lib/validations/vehicle.schema"
import { vehicleYearMax } from "@/lib/constants/vehicle-options"

const valid = {
  make: "Toyota",
  model: "Harrier",
  year: "2021",
  price: "22500",
  mileageKm: "42000",
  fuelType: "PETROL",
  transmission: "AUTOMATIC",
  driveType: "FWD",
  countryOfOrigin: "JAPAN",
  condition: "USED",
  engineSize: "2.0L",
  exteriorColor: "Black",
  interiorColor: "Black",
  currentLocation: "Yokohama, Japan",
  description: "Well-maintained example with a full service history and no damage.",
  isFeatured: "false",
}

describe("createVehicleSchema", () => {
  it("accepts a complete listing and coerces the numbers", () => {
    const result = createVehicleSchema.safeParse(valid)

    expect(result.success).toBe(true)
    expect(result.data?.year).toBe(2021)
    expect(result.data?.price).toBe(22500)
    expect(result.data?.mileageKm).toBe(42000)
  })

  it("treats a blank estimate as absent, not zero", () => {
    // The distinction is customer-visible: NULL renders as "not quoted",
    // zero renders as a confirmed charge of nothing.
    const result = createVehicleSchema.safeParse({
      ...valid,
      shippingEstimate: "",
      clearingEstimate: "",
      otherChargesEst: "",
    })

    expect(result.success).toBe(true)
    expect(result.data?.shippingEstimate).toBeUndefined()
    expect(result.data?.clearingEstimate).toBeUndefined()
  })

  it("keeps a zero estimate that was actually entered", () => {
    const result = createVehicleSchema.safeParse({ ...valid, shippingEstimate: "0" })

    expect(result.success).toBe(true)
    expect(result.data?.shippingEstimate).toBe(0)
  })

  it("accepts a price whose float multiplication is inexact", () => {
    // 33.34 * 100 is 3334.0000000000005. A precision check written as
    // `value * 100 % 1 === 0` rejects this valid two-decimal price.
    const result = createVehicleSchema.safeParse({ ...valid, price: "22500.34" })

    expect(result.success).toBe(true)
    expect(result.data?.price).toBe(22500.34)
  })

  it("rejects more than two decimal places on money", () => {
    expect(createVehicleSchema.safeParse({ ...valid, price: "22500.345" }).success).toBe(
      false
    )
  })

  it("rejects a mileage that is almost certainly a typo", () => {
    // The real error this catches is an extra digit or metres-for-kilometres.
    expect(
      createVehicleSchema.safeParse({ ...valid, mileageKm: "42000000" }).success
    ).toBe(false)
  })

  it("rejects implausible years", () => {
    expect(createVehicleSchema.safeParse({ ...valid, year: "1899" }).success).toBe(false)
    expect(createVehicleSchema.safeParse({ ...valid, year: "2999" }).success).toBe(false)
  })

  it("allows next year, for model-year listings ahead of the calendar", () => {
    const nextYear = String(new Date().getFullYear() + 1)
    expect(createVehicleSchema.safeParse({ ...valid, year: nextYear }).success).toBe(true)
  })

  it("requires a real description, not a placeholder", () => {
    expect(createVehicleSchema.safeParse({ ...valid, description: "nice" }).success).toBe(
      false
    )
  })

  it("rejects an unknown enum value", () => {
    expect(
      createVehicleSchema.safeParse({ ...valid, fuelType: "NUCLEAR" }).success
    ).toBe(false)
  })

  it("trims text fields", () => {
    const result = createVehicleSchema.safeParse({ ...valid, make: "  Toyota  " })
    expect(result.data?.make).toBe("Toyota")
  })
})

describe("vehicleListFiltersSchema", () => {
  it("falls back to defaults rather than failing on a hand-edited URL", () => {
    // These come from a query string anyone can edit. A bad filter should
    // show an unfiltered list, not an error page.
    const result = vehicleListFiltersSchema.parse({
      status: "NOT_A_STATUS",
      page: "banana",
    })

    expect(result.status).toBeUndefined()
    expect(result.page).toBe(1)
  })

  it("keeps valid filters", () => {
    const result = vehicleListFiltersSchema.parse({
      search: " harrier ",
      status: "PUBLISHED",
      page: "3",
    })

    expect(result.search).toBe("harrier")
    expect(result.status).toBe("PUBLISHED")
    expect(result.page).toBe(3)
  })

  it("refuses a page below one", () => {
    expect(vehicleListFiltersSchema.parse({ page: "0" }).page).toBe(1)
    expect(vehicleListFiltersSchema.parse({ page: "-5" }).page).toBe(1)
  })
})

describe("slugs", () => {
  it("strips accents to the base letter rather than dropping it", () => {
    // "Citroën" must not become "citron" — that is a different word.
    expect(slugifyFragment("Citroën")).toBe("citroen")
    expect(slugifyFragment("Škoda")).toBe("skoda")
  })

  it("collapses punctuation and spacing into single hyphens", () => {
    expect(slugifyFragment("Land   Rover / Range")).toBe("land-rover-range")
    expect(slugifyFragment("  --Toyota--  ")).toBe("toyota")
  })

  it("includes the reference so identical vehicles do not collide", () => {
    // Two 2021 Harriers is a normal week for an importer, and `slug` is
    // unique in the database — without the reference the second save fails.
    const a = buildVehicleSlug({
      make: "Toyota",
      model: "Harrier",
      year: 2021,
      referenceNumber: "CLM-V-2026-000123",
    })
    const b = buildVehicleSlug({
      make: "Toyota",
      model: "Harrier",
      year: 2021,
      referenceNumber: "CLM-V-2026-000124",
    })

    expect(a).toBe("toyota-harrier-2021-clm-v-2026-000123")
    expect(a).not.toBe(b)
  })
})

describe("reference formatting", () => {
  it("pads to six digits", () => {
    expect(formatReference("VEHICLE", 2026, 1)).toBe("CLM-V-2026-000001")
    expect(formatReference("VEHICLE", 2026, 123)).toBe("CLM-V-2026-000123")
  })

  it("gives tracking no letter, matching what customers type", () => {
    // The brief's example is literally CLM-2026-000125.
    expect(formatReference("TRACKING", 2026, 125)).toBe("CLM-2026-000125")
  })

  it("uses a distinct prefix per record type", () => {
    expect(formatReference("QUOTE", 2026, 45)).toBe("CLM-Q-2026-000045")
    expect(formatReference("ORDER", 2026, 12)).toBe("CLM-O-2026-000012")
  })
})

describe("formatting", () => {
  it("drops decimals on whole prices", () => {
    expect(formatCurrency(22500)).toBe("$22,500")
  })

  it("keeps decimals when there are any", () => {
    expect(formatCurrency(22500.5)).toBe("$22,500.50")
  })

  it("shows a dash for an unknown amount, never $0", () => {
    // "$0" would state that shipping is free; the dash says it is unpriced.
    expect(formatCurrencyOrDash(null)).toBe("—")
    expect(formatCurrencyOrDash(undefined)).toBe("—")
    expect(formatCurrencyOrDash(0)).toBe("$0")
  })

  it("formats mileage with a unit", () => {
    expect(formatMileage(42000)).toBe("42,000 km")
  })
})

describe("isFeatured (checkbox semantics)", () => {
  /**
   * This field used to be `z.coerce.boolean()`, which is `Boolean(input)` —
   * so every non-empty string was true, and a request carrying
   * `isFeatured=false` set the flag rather than clearing it. Only an
   * authenticated administrator could reach the action, so it was never a
   * privilege issue; it was a value that meant the opposite of what it said.
   */
  it("is false when the box is absent, which is how a browser sends unchecked", () => {
    const { isFeatured, ...withoutField } = valid
    void isFeatured

    const result = createVehicleSchema.safeParse(withoutField)

    expect(result.success).toBe(true)
    expect(result.data?.isFeatured).toBe(false)
  })

  it("is true only for a real checkbox submission", () => {
    expect(
      createVehicleSchema.safeParse({ ...valid, isFeatured: "true" }).data?.isFeatured
    ).toBe(true)

    // Some browsers/serialisers send the HTML default value "on".
    expect(
      createVehicleSchema.safeParse({ ...valid, isFeatured: "on" }).data?.isFeatured
    ).toBe(true)
  })

  it("reads a literal \"false\" as false, not as a non-empty string", () => {
    // The regression this test exists for.
    expect(
      createVehicleSchema.safeParse({ ...valid, isFeatured: "false" }).data?.isFeatured
    ).toBe(false)
  })

  it("treats any other value as unchecked rather than failing the form", () => {
    // A checkbox carrying something unexpected is a crafted request, not
    // something an operator can act on — so it is refused by being read as
    // "off", not by producing a validation error beside a tick box.
    for (const value of ["0", "1", "yes", "TRUE", "", "unexpected"]) {
      expect(
        createVehicleSchema.safeParse({ ...valid, isFeatured: value }).data?.isFeatured,
        `isFeatured=${JSON.stringify(value)}`
      ).toBe(false)
    }
  })
})

describe("year bounds", () => {
  it("allows next year, because importers list ahead of the calendar", () => {
    const result = createVehicleSchema.safeParse({
      ...valid,
      year: String(vehicleYearMax()),
    })

    expect(result.success).toBe(true)
  })

  it("refuses a year beyond next year", () => {
    const result = createVehicleSchema.safeParse({
      ...valid,
      year: String(vehicleYearMax() + 1),
    })

    expect(result.success).toBe(false)
  })

  /**
   * The bound is evaluated per parse, not once when the module loaded.
   *
   * It used to be `.max(vehicleYearMax(), ...)`, which froze the ceiling —
   * and its message — at import time. A server process alive across New
   * Year's Eve would go on refusing the new model year, which is precisely
   * when an importer starts listing it, while quoting last year's limit.
   */
  it("moves its ceiling with the calendar rather than with process start", () => {
    const yearAfterNext = new Date().getFullYear() + 2

    // Out of range now: the ceiling is this year + 1.
    expect(
      createVehicleSchema.safeParse({ ...valid, year: String(yearAfterNext) }).success
    ).toBe(false)

    vi.useFakeTimers()

    try {
      // Roll the clock into next year. The same input is now in range —
      // which can only be true if the bound is read at parse time. Under the
      // old `.max(vehicleYearMax())`, the ceiling was frozen when this module
      // was imported and this would still be refused.
      vi.setSystemTime(new Date(`${yearAfterNext - 1}-06-01T00:00:00.000Z`))

      const result = createVehicleSchema.safeParse({
        ...valid,
        year: String(yearAfterNext),
      })

      expect(result.success).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it("names the current ceiling in its message", () => {
    const result = createVehicleSchema.safeParse({
      ...valid,
      year: String(vehicleYearMax() + 5),
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain(String(vehicleYearMax()))
  })
})

describe("updateVehicleSchema", () => {
  const validUpdate = {
    ...valid,
    id: "clv1abc23def45ghi67jkl890",
    expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
  }

  it("accepts an edit carrying the timestamp its form was rendered from", () => {
    const result = updateVehicleSchema.safeParse(validUpdate)

    expect(result.success).toBe(true)
    expect(result.data?.expectedUpdatedAt).toBeInstanceOf(Date)
  })

  /**
   * Required, not optional. Treating an absent token as "skip the
   * concurrency check" would leave the hole open for every caller that
   * simply omits the field — which is every caller that is not this form.
   */
  it("refuses an edit with no concurrency token at all", () => {
    const { expectedUpdatedAt, ...withoutToken } = validUpdate
    void expectedUpdatedAt

    expect(updateVehicleSchema.safeParse(withoutToken).success).toBe(false)
  })

  it("refuses a token that is not a date", () => {
    expect(
      updateVehicleSchema.safeParse({ ...validUpdate, expectedUpdatedAt: "soon" })
        .success
    ).toBe(false)
  })

  /**
   * Postgres stores TIMESTAMP(3), so the token has to survive a round trip
   * through an ISO string with its milliseconds intact. Losing them would
   * make the `updateMany` filter miss a row that had not actually changed,
   * and every save would be reported as someone else's conflicting edit.
   */
  it("preserves millisecond precision through the ISO round trip", () => {
    const original = new Date("2026-08-29T09:00:00.123Z")

    const result = updateVehicleSchema.safeParse({
      ...validUpdate,
      expectedUpdatedAt: original.toISOString(),
    })

    expect(result.success).toBe(true)
    expect(result.data?.expectedUpdatedAt.getTime()).toBe(original.getTime())
    expect(result.data?.expectedUpdatedAt.getMilliseconds()).toBe(123)
  })

  it("still refuses the field errors the create schema refuses", () => {
    // The two schemas share `vehicleFields`; this is the guard against them
    // being allowed to drift into separate copies.
    const result = updateVehicleSchema.safeParse({
      ...validUpdate,
      mileageKm: "42000000",
    })

    expect(result.success).toBe(false)
  })
})

/**
 * The equipment list.
 *
 * All of this normalisation runs on operator input that goes straight onto
 * a public listing, and every case below is one that has a visible
 * consequence on the page rather than a hypothetical.
 */
describe("vehicle features", () => {
  /** Parses `valid` with the given raw textarea contents. */
  function parseFeatures(features: unknown) {
    const result = createVehicleSchema.safeParse({ ...valid, features })
    return result.success ? result.data.features : result.error.issues
  }

  it("splits one feature per line, keeping the operator's order", () => {
    expect(parseFeatures("Sunroof\nLeather seats\nReverse camera")).toEqual([
      "Sunroof",
      "Leather seats",
      "Reverse camera",
    ])
  })

  it("reads a Windows submission without keeping the carriage returns", () => {
    // A CRLF that survived would be stored in the value and rendered as
    // part of the bullet.
    expect(parseFeatures("Sunroof\r\nLeather seats")).toEqual([
      "Sunroof",
      "Leather seats",
    ])
  })

  it("strips bullet characters carried in by a paste", () => {
    // Otherwise the page draws its own marker beside the pasted one and
    // the customer sees "• • Sunroof".
    expect(parseFeatures("• Sunroof\n- Leather seats\n* Alloy wheels")).toEqual([
      "Sunroof",
      "Leather seats",
      "Alloy wheels",
    ])
  })

  it("drops blank lines, including the trailing one every textarea ends with", () => {
    expect(parseFeatures("Sunroof\n\n   \nLeather seats\n")).toEqual([
      "Sunroof",
      "Leather seats",
    ])
  })

  it("collapses repeats case-insensitively, keeping the first spelling", () => {
    expect(parseFeatures("Sunroof\nSUNROOF\nsunroof")).toEqual(["Sunroof"])
  })

  it("treats an empty or absent list as no features, not an error", () => {
    expect(parseFeatures("")).toEqual([])
    expect(parseFeatures("   \n  ")).toEqual([])
    // A form that omits the field entirely — the Zod 4 optional-ordering
    // trap this schema had to be written around.
    expect(createVehicleSchema.safeParse(valid).success).toBe(true)
    expect(createVehicleSchema.safeParse(valid).data?.features).toEqual([])
  })

  it("refuses more features than a listing should carry", () => {
    const tooMany = Array.from(
      { length: VEHICLE_FEATURES_MAX + 1 },
      (_, i) => `Feature ${i}`
    ).join("\n")

    // Refused rather than truncated: silently dropping the tail would
    // publish a listing that misdescribes the car.
    expect(createVehicleSchema.safeParse({ ...valid, features: tooMany }).success).toBe(
      false
    )
  })

  it("refuses a paragraph pasted in as a single feature", () => {
    const essay = "x".repeat(VEHICLE_FEATURE_MAX_LENGTH + 1)

    expect(createVehicleSchema.safeParse({ ...valid, features: essay }).success).toBe(
      false
    )
  })
})

describe("vehicle condition", () => {
  it("accepts the two conditions a listing can be in", () => {
    for (const condition of ["NEW", "USED"]) {
      expect(createVehicleSchema.safeParse({ ...valid, condition }).success).toBe(true)
    }
  })

  it("refuses anything else, and refuses to guess when it is missing", () => {
    // Required rather than defaulted in the schema: the column defaults to
    // USED, but a form that fails to send the field is a broken form, and
    // quietly listing the car as used would hide that.
    for (const condition of ["PRE_OWNED", "", undefined]) {
      expect(createVehicleSchema.safeParse({ ...valid, condition }).success).toBe(false)
    }
  })
})

describe("body type", () => {
  it("is optional, and a blank selection is stored as null so clearing it clears the column", () => {
    const blank = createVehicleSchema.safeParse({ ...valid, bodyType: "" })
    const absent = createVehicleSchema.safeParse(valid)

    expect(blank.success && blank.data.bodyType).toBeNull()
    expect(absent.success && absent.data.bodyType).toBeNull()
  })

  it("accepts a listed body type", () => {
    const result = createVehicleSchema.safeParse({ ...valid, bodyType: "SUV" })

    expect(result.success && result.data.bodyType).toBe("SUV")
  })

  it("rejects anything else", () => {
    const result = createVehicleSchema.safeParse({ ...valid, bodyType: "SPACESHIP" })

    expect(result.success).toBe(false)
  })
})
