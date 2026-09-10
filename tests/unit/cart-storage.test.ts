import { describe, expect, it } from "vitest"

import {
  MAX_CART_LINES,
  MAX_ITEM_QUANTITY,
  addToCart,
  cartItemCount,
  cartSubtotal,
  clampQuantity,
  parseStoredCart,
  removeFromCart,
  serializeCart,
  setCartQuantity,
  type CartItem,
  type CartItemInput,
} from "@/lib/cart/cart-storage"

/**
 * The spare-parts basket.
 *
 * Two things are being protected here, and only one of them is arithmetic.
 *
 * The first is that a basket read back out of `localStorage` cannot crash a
 * render. That storage is the customer's: it survives deploys, it can be
 * edited by hand, it can be left behind by an older build, and it can be
 * truncated by a browser that ran out of quota mid-write. Every one of those
 * produces a value this code has to survive, and the failure mode of not
 * surviving it is a blank page on the catalogue.
 *
 * The second is that the figures a customer is shown are right — a line
 * quantity that cannot silently become 4,000, and a subtotal that never
 * quietly omits a line.
 */

function input(overrides: Partial<CartItemInput> = {}): CartItemInput {
  return {
    slug: "toyota-harrier-front-brake-pads-clm-sp-2026-000001",
    name: "Toyota Harrier front brake pads",
    referenceNumber: "CLM-SP-2026-000001",
    price: 120,
    imageUrl: "https://example.test/pads.webp",
    ...overrides,
  }
}

function line(overrides: Partial<CartItem> = {}): CartItem {
  return { ...input(), quantity: 1, ...overrides }
}

describe("clampQuantity", () => {
  it("keeps a quantity inside the range a line may hold", () => {
    expect(clampQuantity(1)).toBe(1)
    expect(clampQuantity(7)).toBe(7)
    expect(clampQuantity(MAX_ITEM_QUANTITY)).toBe(MAX_ITEM_QUANTITY)
  })

  it("refuses zero, negatives and fractions", () => {
    // A stepper never produces these; a hand-edited storage value does. A
    // zero-quantity line renders as a part in the basket that contributes
    // nothing to the total, which is a basket that disagrees with itself.
    expect(clampQuantity(0)).toBe(1)
    expect(clampQuantity(-4)).toBe(1)
    expect(clampQuantity(2.7)).toBe(2)
  })

  it("caps a figure that is obviously a typo", () => {
    expect(clampQuantity(100_000)).toBe(MAX_ITEM_QUANTITY)
  })

  it("survives values that are not real numbers", () => {
    // Both fall back to one rather than to the ceiling. NaN and Infinity only
    // ever arrive from a hand-edited storage value, and the safe reading of
    // an unusable quantity is the smallest one, not the largest.
    expect(clampQuantity(Number.NaN)).toBe(1)
    expect(clampQuantity(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe("parseStoredCart", () => {
  it("reads back exactly what was written", () => {
    const items = [line(), line({ slug: "other", referenceNumber: "CLM-SP-2", quantity: 3 })]

    expect(parseStoredCart(serializeCart(items))).toEqual(items)
  })

  it("treats missing and unparseable storage as an empty basket", () => {
    expect(parseStoredCart(null)).toEqual([])
    expect(parseStoredCart("")).toEqual([])
    expect(parseStoredCart("{not json")).toEqual([])
    // A truncated write — the shape a browser leaves behind when it runs out
    // of quota partway through.
    expect(parseStoredCart('[{"slug":"a","name":')).toEqual([])
  })

  it("ignores a stored value that is not a list", () => {
    expect(parseStoredCart('{"slug":"a"}')).toEqual([])
    expect(parseStoredCart('"a string"')).toEqual([])
    expect(parseStoredCart("null")).toEqual([])
  })

  it("drops a malformed line and keeps the rest", () => {
    // Someone with five parts whose third line is corrupt keeps four. The
    // alternative — discarding the whole basket — punishes them for a fault
    // that is not theirs.
    const raw = JSON.stringify([
      line(),
      { slug: "no-name", referenceNumber: "CLM-SP-2" },
      line({ slug: "third", referenceNumber: "CLM-SP-3" }),
    ])

    const parsed = parseStoredCart(raw)

    expect(parsed).toHaveLength(2)
    expect(parsed.map((item) => item.slug)).toEqual([line().slug, "third"])
  })

  it("keeps only the first line for a repeated part", () => {
    // Two lines for one part would render two steppers, and the second would
    // silently win on the next write.
    const raw = JSON.stringify([line({ quantity: 2 }), line({ quantity: 9 })])

    const parsed = parseStoredCart(raw)

    expect(parsed).toHaveLength(1)
    expect(parsed[0].quantity).toBe(2)
  })

  it("clamps a stored quantity rather than trusting it", () => {
    const raw = JSON.stringify([line({ quantity: 100_000 })])

    expect(parseStoredCart(raw)[0].quantity).toBe(MAX_ITEM_QUANTITY)
  })

  it("normalises a missing or non-numeric price to 'on enquiry'", () => {
    // Null is meaningful — it is how a quoted part says it has no listed
    // price — so anything unusable has to become null rather than zero, which
    // would render as free.
    const raw = JSON.stringify([
      { ...line(), price: "120" },
      { ...line({ slug: "b", referenceNumber: "CLM-SP-2" }), price: undefined },
    ])

    expect(parseStoredCart(raw).map((item) => item.price)).toEqual([null, null])
  })

  it("drops properties it does not recognise", () => {
    // The returned object is built field by field rather than spread, so a
    // stored value cannot smuggle extra keys into a rendered basket.
    const raw = JSON.stringify([{ ...line(), evil: "<script>" }])

    expect(Object.keys(parseStoredCart(raw)[0]).sort()).toEqual([
      "imageUrl",
      "name",
      "price",
      "quantity",
      "referenceNumber",
      "slug",
    ])
  })

  it("stops at the line ceiling", () => {
    const raw = JSON.stringify(
      Array.from({ length: MAX_CART_LINES + 10 }, (_, index) =>
        line({ slug: `part-${index}`, referenceNumber: `CLM-SP-${index}` })
      )
    )

    expect(parseStoredCart(raw)).toHaveLength(MAX_CART_LINES)
  })
})

describe("addToCart", () => {
  it("adds a part that is not there yet", () => {
    const items = addToCart([], input(), 2)

    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(2)
  })

  it("tops up an existing line rather than replacing it", () => {
    // Someone who adds two, browses on, and adds one more meant three.
    const items = addToCart([line({ quantity: 2 })], input(), 1)

    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(3)
  })

  it("refreshes the line's details from the newer copy", () => {
    // The catalogue may have been re-rendered since; the price and name the
    // customer has just been looking at are the ones to keep.
    const items = addToCart([line({ price: 100, name: "Old name" })], input(), 1)

    expect(items[0].price).toBe(120)
    expect(items[0].name).toBe("Toyota Harrier front brake pads")
  })

  it("caps a topped-up line at the maximum", () => {
    const items = addToCart([line({ quantity: MAX_ITEM_QUANTITY })], input(), 5)

    expect(items[0].quantity).toBe(MAX_ITEM_QUANTITY)
  })

  it("returns the same array when the basket is full", () => {
    // Identity is the signal the provider uses to tell the customer nothing
    // happened, so it has to be the *same* array, not an equal one.
    const full = Array.from({ length: MAX_CART_LINES }, (_, index) =>
      line({ slug: `part-${index}`, referenceNumber: `CLM-SP-${index}` })
    )

    expect(addToCart(full, input({ slug: "one-too-many" }))).toBe(full)
  })

  it("still tops up an existing line when the basket is full", () => {
    const full = Array.from({ length: MAX_CART_LINES }, (_, index) =>
      line({ slug: `part-${index}`, referenceNumber: `CLM-SP-${index}` })
    )

    const items = addToCart(full, input({ slug: "part-0" }), 2)

    expect(items).not.toBe(full)
    expect(items[0].quantity).toBe(3)
  })

  it("never mutates the array it was given", () => {
    const before = [line({ quantity: 1 })]
    const snapshot = structuredClone(before)

    addToCart(before, input(), 4)

    expect(before).toEqual(snapshot)
  })
})

describe("setCartQuantity", () => {
  it("sets an exact quantity", () => {
    expect(setCartQuantity([line()], line().slug, 6)[0].quantity).toBe(6)
  })

  it("removes the line at zero", () => {
    expect(setCartQuantity([line()], line().slug, 0)).toEqual([])
  })

  it("leaves other lines alone", () => {
    const items = [line(), line({ slug: "b", referenceNumber: "CLM-SP-2", quantity: 4 })]

    expect(setCartQuantity(items, line().slug, 2)[1].quantity).toBe(4)
  })
})

describe("removeFromCart", () => {
  it("removes only the named line", () => {
    const items = [line(), line({ slug: "b", referenceNumber: "CLM-SP-2" })]

    expect(removeFromCart(items, "b").map((item) => item.slug)).toEqual([line().slug])
  })
})

describe("cartItemCount", () => {
  it("counts units, not lines", () => {
    const items = [
      line({ quantity: 2 }),
      line({ slug: "b", referenceNumber: "CLM-SP-2", quantity: 3 }),
    ]

    expect(cartItemCount(items)).toBe(5)
  })
})

describe("cartSubtotal", () => {
  it("multiplies each line and adds them", () => {
    const items = [
      line({ price: 120, quantity: 2 }),
      line({ slug: "b", referenceNumber: "CLM-SP-2", price: 45.5, quantity: 1 }),
    ]

    expect(cartSubtotal(items)).toEqual({ total: 285.5, quotedLines: 0 })
  })

  it("excludes quoted lines and says how many there were", () => {
    // Treating them as zero would understate what the customer is asking for
    // — the one direction a figure shown to a customer must never be wrong in.
    const items = [
      line({ price: 120, quantity: 1 }),
      line({ slug: "b", referenceNumber: "CLM-SP-2", price: null, quantity: 3 }),
    ]

    expect(cartSubtotal(items)).toEqual({ total: 120, quotedLines: 1 })
  })

  it("does not accumulate floating-point noise", () => {
    // 0.1 + 0.2 arithmetic on a page whose whole job is to look like a real
    // company. A subtotal reading $120.30000000000001 is the sort of detail
    // that costs trust.
    const items = [
      line({ price: 0.1, quantity: 1 }),
      line({ slug: "b", referenceNumber: "CLM-SP-2", price: 0.2, quantity: 1 }),
    ]

    expect(cartSubtotal(items).total).toBe(0.3)
  })

  it("is zero for an empty basket", () => {
    expect(cartSubtotal([])).toEqual({ total: 0, quotedLines: 0 })
  })
})
