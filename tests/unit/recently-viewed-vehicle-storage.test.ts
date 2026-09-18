import { describe, expect, it } from "vitest"

import {
  MAX_RECENTLY_VIEWED_VEHICLES,
  parseStoredRecentlyViewedVehicles,
  recentlyViewedVehicleTitle,
  recordVehicleView,
  removeRecentlyViewedVehicle,
  serializeRecentlyViewedVehicles,
  type RecentlyViewedVehicle,
  type RecentlyViewedVehicleInput,
} from "@/lib/recently-viewed/recently-viewed-vehicle-storage"

/**
 * The vehicle viewing history, as data — the mirror of
 * `recently-viewed-storage.test.ts`.
 *
 * The store around it owns `localStorage` and the React subscription; this is
 * the part where the ordering, the de-duplication and the parsing of whatever
 * happens to be in a customer's browser actually live, which is where the bugs
 * would be and the only part testable without a DOM.
 *
 * Nothing here is security-critical: the list buys nothing, proves nothing and
 * never reaches the server. What it *can* do is crash a render, which is what
 * the parsing tests are about.
 */

function input(overrides: Partial<RecentlyViewedVehicleInput> = {}): RecentlyViewedVehicleInput {
  return {
    slug: "toyota-harrier-2021-clm-v-2026-000123",
    make: "Toyota",
    model: "Harrier",
    year: 2021,
    price: 22_500,
    mileageKm: 42_000,
    imageUrl: "https://example.test/harrier.jpg",
    ...overrides,
  }
}

function entry(overrides: Partial<RecentlyViewedVehicle> = {}): RecentlyViewedVehicle {
  return { ...input(), viewedAt: 1_000, ...overrides }
}

describe("recordVehicleView", () => {
  it("puts a newly viewed vehicle at the front", () => {
    const existing = [entry({ slug: "other", viewedAt: 500 })]

    const next = recordVehicleView(existing, input(), 2_000)

    expect(next.map((e) => e.slug)).toEqual([input().slug, "other"])
    expect(next[0].viewedAt).toBe(2_000)
  })

  it("moves a vehicle already in the list rather than duplicating it", () => {
    const existing = [entry({ slug: "other", viewedAt: 900 }), entry({ viewedAt: 500 })]

    const next = recordVehicleView(existing, input(), 2_000)

    expect(next).toHaveLength(2)
    expect(next[0].slug).toBe(input().slug)
  })

  it("refreshes the stored fields from the page being viewed", () => {
    const existing = [entry({ slug: "other" }), entry({ price: 19_000, viewedAt: 100 })]

    const next = recordVehicleView(existing, input({ price: 21_000 }), 2_000)

    expect(next[0].price).toBe(21_000)
  })

  it("returns the same array when re-viewing the vehicle already at the front", () => {
    // The identity check is what stops a page reload writing to storage and
    // re-rendering the strip for no observable difference.
    const existing = [entry()]

    expect(recordVehicleView(existing, input(), 9_999)).toBe(existing)
  })

  it("does not treat a changed price as unchanged", () => {
    const existing = [entry({ price: 22_500 })]

    expect(recordVehicleView(existing, input({ price: 20_000 }), 2_000)).not.toBe(existing)
  })

  it("keeps the list within its maximum", () => {
    const existing = Array.from({ length: MAX_RECENTLY_VIEWED_VEHICLES }, (_, i) =>
      entry({ slug: `car-${i}`, viewedAt: i })
    )

    const next = recordVehicleView(existing, input(), 99_999)

    expect(next).toHaveLength(MAX_RECENTLY_VIEWED_VEHICLES)
    expect(next[0].slug).toBe(input().slug)
  })
})

describe("parseStoredRecentlyViewedVehicles", () => {
  it("reads back what it wrote", () => {
    const entries = [entry(), entry({ slug: "second", viewedAt: 500 })]

    expect(parseStoredRecentlyViewedVehicles(serializeRecentlyViewedVehicles(entries))).toEqual(entries)
  })

  it("returns nothing for null, junk, or a non-array", () => {
    expect(parseStoredRecentlyViewedVehicles(null)).toEqual([])
    expect(parseStoredRecentlyViewedVehicles("not json{{")).toEqual([])
    expect(parseStoredRecentlyViewedVehicles('{"slug":"x"}')).toEqual([])
  })

  it("drops entries missing an identity and keeps the rest", () => {
    const raw = JSON.stringify([
      { slug: "", make: "Toyota", model: "Harrier", viewedAt: 1 },
      { make: "Toyota", model: "Harrier", viewedAt: 2 },
      { slug: "keep", make: "Toyota", model: "Harrier", viewedAt: 3 },
    ])

    expect(parseStoredRecentlyViewedVehicles(raw).map((e) => e.slug)).toEqual(["keep"])
  })

  it("sorts newest first and de-duplicates by slug", () => {
    const raw = JSON.stringify([
      { slug: "a", make: "Toyota", model: "Harrier", viewedAt: 1 },
      { slug: "b", make: "Nissan", model: "X-Trail", viewedAt: 5 },
      { slug: "a", make: "Toyota", model: "Harrier", viewedAt: 9 },
    ])

    expect(parseStoredRecentlyViewedVehicles(raw).map((e) => e.slug)).toEqual(["b", "a"])
  })

  it("truncates a hand-edited file to the maximum", () => {
    const raw = JSON.stringify(
      Array.from({ length: 200 }, (_, i) => ({ slug: `c-${i}`, make: "Toyota", model: "Harrier", viewedAt: i }))
    )

    expect(parseStoredRecentlyViewedVehicles(raw)).toHaveLength(MAX_RECENTLY_VIEWED_VEHICLES)
  })

  it("normalises nonsensical numbers rather than dropping the vehicle", () => {
    const raw = JSON.stringify([
      { slug: "a", make: "Toyota", model: "Harrier", year: "2021", price: null, mileageKm: NaN, viewedAt: "soon" },
    ])

    expect(parseStoredRecentlyViewedVehicles(raw)).toEqual([
      { slug: "a", make: "Toyota", model: "Harrier", year: null, price: null, mileageKm: null, imageUrl: null, viewedAt: 0 },
    ])
  })
})

describe("removeRecentlyViewedVehicle", () => {
  it("removes only the named slug", () => {
    const entries = [entry({ slug: "a" }), entry({ slug: "b" })]

    expect(removeRecentlyViewedVehicle(entries, "a").map((e) => e.slug)).toEqual(["b"])
  })
})

describe("recentlyViewedVehicleTitle", () => {
  it("reads year, make, model", () => {
    expect(recentlyViewedVehicleTitle(entry())).toBe("2021 Toyota Harrier")
  })

  it("omits a missing year rather than leaving a gap", () => {
    expect(recentlyViewedVehicleTitle(entry({ year: null }))).toBe("Toyota Harrier")
  })
})
