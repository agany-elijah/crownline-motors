import { describe, expect, it } from "vitest"

import {
  createSparePartSchema,
  sparePartListFiltersSchema,
  updateSparePartSchema,
} from "@/lib/validations/spare-part.schema"

/**
 * Server-side validation for a spare-part listing.
 *
 * This is the layer between a public POST endpoint and the inventory. Every
 * assertion below covers a specific way a listing could go wrong in front of
 * a customer — a price that contradicts its own pricing mode, a stock figure
 * that promises what nobody has, an empty string stored where NULL means
 * "not recorded".
 *
 * The rules that also exist as database CHECK constraints are tested here
 * too. The database is the backstop no code path can route around; this is
 * what turns a violation into a sentence an operator can act on.
 */

/** A valid submission, as `Object.fromEntries(formData)` produces it. */
function validForm(overrides: Record<string, string> = {}) {
  return {
    name: "Toyota Harrier front brake pads",
    categoryId: "cat_brakes",
    condition: "USED",
    availability: "IN_STOCK",
    price: "120",
    stockQuantity: "4",
    description: "Genuine pads removed from a low-mileage import, unused.",
    ...overrides,
  }
}

describe("createSparePartSchema — pricing", () => {
  it("accepts a price and marks the part as priced", () => {
    const result = createSparePartSchema.safeParse(validForm())

    expect(result.success).toBe(true)
    expect(result.data?.price).toBe(120)
    expect(result.data?.pricingMode).toBe("FIXED")
  })

  it("treats an empty price as 'price on enquiry' rather than an error", () => {
    /**
     * The form has no pricing-mode control: the price field alone decides.
     * An operator listing a part they have not priced yet must be able to
     * save it, and the honest reading of a blank price is that the customer
     * has to ask.
     */
    const result = createSparePartSchema.safeParse(validForm({ price: "" }))

    expect(result.success).toBe(true)
    expect(result.data?.price).toBeUndefined()
    expect(result.data?.pricingMode).toBe("QUOTE_ONLY")
  })

  it("treats a missing price field the same way", () => {
    // Not the same submission: a field the browser never sent at all, which
    // is what a form rendered without the input would produce.
    const { price: _price, ...withoutPrice } = validForm()
    const result = createSparePartSchema.safeParse(withoutPrice)

    expect(result.success).toBe(true)
    expect(result.data?.pricingMode).toBe("QUOTE_ONLY")
  })

  it("never produces a combination the database CHECK would refuse", () => {
    /**
     * `SparePart_pricing_mode_check` requires FIXED to carry a price and
     * QUOTE_ONLY to carry none. Deriving both from the same value is what
     * makes that true by construction rather than by validation — there is
     * no input that can produce the other two combinations.
     */
    for (const price of ["", "0", "120", "0.01"]) {
      const result = createSparePartSchema.safeParse(validForm({ price }))

      expect(result.success).toBe(true)
      expect(result.data?.pricingMode === "FIXED").toBe(
        result.data?.price !== undefined
      )
    }
  })

  it("accepts a price of zero as a real price", () => {
    // Zero is a figure someone typed. It is not the same as leaving the box
    // empty, and collapsing the two would turn "free with the part" into
    // "ask us".
    const result = createSparePartSchema.safeParse(validForm({ price: "0" }))

    expect(result.data?.price).toBe(0)
    expect(result.data?.pricingMode).toBe("FIXED")
  })

  it("refuses a negative price", () => {
    const result = createSparePartSchema.safeParse(validForm({ price: "-1" }))
    expect(result.success).toBe(false)
  })

  it("refuses more than two decimal places", () => {
    // Decimal(12,2) in the database. A third place would be silently
    // rounded, and the figure shown would stop matching the figure stored.
    expect(createSparePartSchema.safeParse(validForm({ price: "120.999" })).success).toBe(false)
    expect(createSparePartSchema.safeParse(validForm({ price: "120.99" })).success).toBe(true)
  })

  it("accepts the precision values that trip a naive modulo check", () => {
    // `33.34 * 100` is 3334.0000000000005 in binary floating point. A schema
    // comparing that exactly rejects a perfectly ordinary price.
    for (const price of ["33.34", "0.07", "9.95", "1234.56"]) {
      expect(createSparePartSchema.safeParse(validForm({ price })).success).toBe(true)
    }
  })
})

describe("createSparePartSchema — stock", () => {
  it("accepts zero, which is a normal publishable state", () => {
    // "Out of stock" is a quantity, not a status: a published part at zero
    // stays visible so customers can ask when the next shipment lands.
    const result = createSparePartSchema.safeParse(validForm({ stockQuantity: "0" }))

    expect(result.success).toBe(true)
    expect(result.data?.stockQuantity).toBe(0)
  })

  it("reads an empty box as none in stock", () => {
    // Optional, because a part is often listed before the box arrives. An
    // operator should not have to type a figure they do not have yet.
    const blank = createSparePartSchema.safeParse(validForm({ stockQuantity: "" }))
    expect(blank.success).toBe(true)
    expect(blank.data?.stockQuantity).toBe(0)

    const { stockQuantity: _omitted, ...missing } = validForm()
    const absent = createSparePartSchema.safeParse(missing)
    expect(absent.success).toBe(true)
    expect(absent.data?.stockQuantity).toBe(0)
  })

  it("creates a part with every optional field left empty", () => {
    /**
     * The dealership's requirement in one assertion: a name, a category and
     * a description are enough. Price, stock, brand, manufacturer number,
     * country and sourcing are all things an operator may not have to hand,
     * and none of them may block a listing being entered.
     */
    const result = createSparePartSchema.safeParse({
      name: "Toyota Harrier front brake pads",
      categoryId: "cat_brakes",
      condition: "USED",
      availability: "ON_ORDER",
      description: "Genuine pads removed from a low-mileage import, unused.",
      price: "",
      stockQuantity: "",
      brand: "",
      oemPartNumber: "",
      countryOfOrigin: "",
      supplierName: "",
      supplierNotes: "",
    })

    expect(result.success).toBe(true)
    expect(result.data?.pricingMode).toBe("QUOTE_ONLY")
    expect(result.data?.stockQuantity).toBe(0)
    expect(result.data?.brand).toBeUndefined()
    expect(result.data?.countryOfOrigin).toBeUndefined()
  })

  it("refuses negative stock", () => {
    expect(createSparePartSchema.safeParse(validForm({ stockQuantity: "-1" })).success).toBe(false)
  })

  it("refuses a fractional quantity", () => {
    expect(createSparePartSchema.safeParse(validForm({ stockQuantity: "2.5" })).success).toBe(false)
  })

  it("catches a slipped keypress rather than trusting the figure", () => {
    // Not a warehouse limit — a typo detector. An importer does not hold a
    // million of anything, and the figure would otherwise sit on a public
    // page promising stock nobody has.
    expect(createSparePartSchema.safeParse(validForm({ stockQuantity: "1000000" })).success).toBe(false)
  })
})

describe("createSparePartSchema — text fields", () => {
  it("stores an unrecorded optional field as undefined, never an empty string", () => {
    /**
     * The action turns `undefined` into NULL. An empty string would match a
     * search for "" and render a blank line on the listing where a part
     * number should be.
     */
    const result = createSparePartSchema.safeParse(
      validForm({ oemPartNumber: "  ", brand: "", supplierName: "" })
    )

    expect(result.success).toBe(true)
    expect(result.data?.oemPartNumber).toBeUndefined()
    expect(result.data?.brand).toBeUndefined()
    expect(result.data?.supplierName).toBeUndefined()
  })

  it("trims what it does keep", () => {
    const result = createSparePartSchema.safeParse(
      validForm({ name: "  Front brake pads  ", oemPartNumber: " 04465-33471 " })
    )

    expect(result.data?.name).toBe("Front brake pads")
    expect(result.data?.oemPartNumber).toBe("04465-33471")
  })

  it("requires a name and a description that says something", () => {
    expect(createSparePartSchema.safeParse(validForm({ name: "   " })).success).toBe(false)
    expect(createSparePartSchema.safeParse(validForm({ description: "Pads." })).success).toBe(false)
  })

  it("requires a category", () => {
    expect(createSparePartSchema.safeParse(validForm({ categoryId: "" })).success).toBe(false)
  })

  it("reads a blank country as 'not specified' rather than as an error", () => {
    // The select's first option is blank, and a browser sends "" for it.
    // Without this every unset country would be a validation error on a
    // field the operator deliberately left alone.
    const result = createSparePartSchema.safeParse(validForm({ countryOfOrigin: "" }))

    expect(result.success).toBe(true)
    expect(result.data?.countryOfOrigin).toBeUndefined()
  })

  it("still refuses a country that is not a real one", () => {
    expect(createSparePartSchema.safeParse(validForm({ countryOfOrigin: "MARS" })).success).toBe(false)
  })
})

describe("createSparePartSchema — the featured checkbox", () => {
  it("is true only for a real checkbox submission", () => {
    // A browser omits an unchecked box entirely and sends the control's
    // value when checked. `z.coerce.boolean()` would be `Boolean(input)`, so
    // a request carrying `isFeatured=false` would *set* the flag.
    expect(createSparePartSchema.safeParse(validForm({ isFeatured: "true" })).data?.isFeatured).toBe(true)
    expect(createSparePartSchema.safeParse(validForm({ isFeatured: "on" })).data?.isFeatured).toBe(true)
    expect(createSparePartSchema.safeParse(validForm({ isFeatured: "false" })).data?.isFeatured).toBe(false)
    expect(createSparePartSchema.safeParse(validForm({ isFeatured: "0" })).data?.isFeatured).toBe(false)
  })

  it("is false when the box is absent, which is how an unchecked box arrives", () => {
    const result = createSparePartSchema.safeParse(validForm())

    expect(result.success).toBe(true)
    expect(result.data?.isFeatured).toBe(false)
  })
})

describe("createSparePartSchema — what it refuses to accept from the client", () => {
  it("ignores a status, reference or slug supplied by the caller", () => {
    /**
     * All three are decided server-side. A caller choosing its own reference
     * could collide with a real one, and a caller supplying `status:
     * PUBLISHED` would put a listing in front of customers without passing
     * through the separately-permissioned status action.
     */
    const result = createSparePartSchema.safeParse(
      validForm({
        status: "PUBLISHED",
        referenceNumber: "CLM-SP-2026-000001",
        slug: "chosen-by-the-client",
      })
    )

    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty("status")
    expect(result.data).not.toHaveProperty("referenceNumber")
    expect(result.data).not.toHaveProperty("slug")
  })
})

describe("updateSparePartSchema", () => {
  function validUpdate(overrides: Record<string, string> = {}) {
    return {
      id: "part_1",
      expectedUpdatedAt: "2026-09-04T10:00:00.000Z",
      ...validForm(),
      ...overrides,
    }
  }

  it("carries the concurrency token through as a date", () => {
    const result = updateSparePartSchema.safeParse(validUpdate())

    expect(result.success).toBe(true)
    expect(result.data?.expectedUpdatedAt).toBeInstanceOf(Date)
  })

  it("refuses a submission with no concurrency token", () => {
    /**
     * Required rather than optional. Treating its absence as "skip the
     * check" would leave the hole open for any caller that simply omits the
     * field — which is every caller that is not this form — and the failure
     * it guards against is a silent revert of someone else's price change.
     */
    const { expectedUpdatedAt: _omitted, ...withoutToken } = validUpdate()

    expect(updateSparePartSchema.safeParse(withoutToken).success).toBe(false)
  })

  it("refuses an unparseable token rather than treating it as absent", () => {
    expect(updateSparePartSchema.safeParse(validUpdate({ expectedUpdatedAt: "yesterday" })).success).toBe(false)
  })

  it("derives the pricing mode the same way creation does", () => {
    // Clearing the price on an existing part moves it to "price on enquiry"
    // rather than failing — which is also what removes the figure from the
    // row, as `SparePart_pricing_mode_check` requires.
    const cleared = updateSparePartSchema.safeParse(validUpdate({ price: "" }))

    expect(cleared.success).toBe(true)
    expect(cleared.data?.price).toBeUndefined()
    expect(cleared.data?.pricingMode).toBe("QUOTE_ONLY")

    const priced = updateSparePartSchema.safeParse(validUpdate({ price: "120" }))

    expect(priced.data?.price).toBe(120)
    expect(priced.data?.pricingMode).toBe("FIXED")
  })
})

describe("sparePartListFiltersSchema", () => {
  it("falls back to an unfiltered first page for a hand-edited query string", () => {
    // These come from a URL a user can edit. A malformed filter should show
    // an unfiltered list rather than an error page.
    const result = sparePartListFiltersSchema.parse({
      status: "NOT_A_STATUS",
      page: "banana",
    })

    expect(result.status).toBeUndefined()
    expect(result.page).toBe(1)
  })

  it("keeps filters it understands", () => {
    const result = sparePartListFiltersSchema.parse({
      search: "  harrier  ",
      status: "PUBLISHED",
      categoryId: "cat_brakes",
      page: "3",
    })

    expect(result).toMatchObject({
      search: "harrier",
      status: "PUBLISHED",
      categoryId: "cat_brakes",
      page: 3,
    })
  })

  it("reads the out-of-stock flag as a boolean, and only from a real value", () => {
    expect(sparePartListFiltersSchema.parse({ outOfStock: "1" }).outOfStock).toBe(true)
    expect(sparePartListFiltersSchema.parse({ outOfStock: "true" }).outOfStock).toBe(true)
    // Anything else is absent, not false-y-but-present — the filter is
    // either applied or it is not.
    expect(sparePartListFiltersSchema.parse({ outOfStock: "0" }).outOfStock).toBe(false)
    expect(sparePartListFiltersSchema.parse({}).outOfStock).toBe(false)
  })

  it("never lets a page below one through", () => {
    expect(sparePartListFiltersSchema.parse({ page: "0" }).page).toBe(1)
    expect(sparePartListFiltersSchema.parse({ page: "-5" }).page).toBe(1)
  })
})
