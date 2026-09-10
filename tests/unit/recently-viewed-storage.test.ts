import { describe, expect, it } from "vitest"

import {
  MAX_RECENTLY_VIEWED,
  parseStoredRecentlyViewed,
  recordView,
  removeRecentlyViewed,
  serializeRecentlyViewed,
  type RecentlyViewedInput,
  type RecentlyViewedPart,
} from "@/lib/recently-viewed/recently-viewed-storage"

/**
 * The viewing history, as data.
 *
 * The store around it owns `localStorage` and the React subscription; this is
 * the part where the ordering, the de-duplication and the parsing of whatever
 * happens to be in a customer's browser actually live — which is where the
 * bugs would be, and the only part that can be tested without a DOM.
 *
 * Nothing here is security-critical: the list buys nothing, proves nothing and
 * never reaches the server. What it *can* do is crash a render, which is what
 * the parsing tests are about.
 */

function input(overrides: Partial<RecentlyViewedInput> = {}): RecentlyViewedInput {
  return {
    slug: "front-brake-pads-clm-sp-2026-000045",
    name: "Toyota Harrier front brake pads",
    price: 120,
    imageUrl: "https://example.test/pads.jpg",
    ...overrides,
  }
}

function entry(overrides: Partial<RecentlyViewedPart> = {}): RecentlyViewedPart {
  return { ...input(), viewedAt: 1_000, ...overrides }
}

describe("recordView", () => {
  it("puts a newly viewed part at the front", () => {
    const entries = recordView([entry({ slug: "a" })], input({ slug: "b" }), 2_000)

    expect(entries.map((item) => item.slug)).toEqual(["b", "a"])
  })

  it("moves a re-viewed part rather than listing it twice", () => {
    const start = [entry({ slug: "a" }), entry({ slug: "b" }), entry({ slug: "c" })]

    const entries = recordView(start, input({ slug: "c" }), 5_000)

    expect(entries.map((item) => item.slug)).toEqual(["c", "a", "b"])
    expect(entries).toHaveLength(3)
  })

  it("refreshes the stored copy from the page being looked at", () => {
    /**
     * An entry is a snapshot, so it can go stale — a price changed since the
     * customer last looked. Re-viewing is the moment we have a fresher copy,
     * and taking it is what keeps the staleness window one visit wide.
     */
    const start = [entry({ slug: "a", price: 120, name: "Old name" })]

    const entries = recordView(
      start,
      input({ slug: "a", price: 95, name: "New name" }),
      2_000
    )

    expect(entries[0].price).toBe(95)
    expect(entries[0].name).toBe("New name")
  })

  it("returns the same array when nothing about the front entry changed", () => {
    /**
     * Identity, not equality. The store skips its `localStorage` write and its
     * re-render on this exact check, so a reload of the part already at the
     * front must not churn either.
     */
    const start = [entry({ slug: "a" })]

    expect(recordView(start, input({ slug: "a" }), 9_999)).toBe(start)
  })

  it("still records a re-view when the part is not already at the front", () => {
    const start = [entry({ slug: "a" }), entry({ slug: "b" })]

    expect(recordView(start, input({ slug: "b" }), 2_000)).not.toBe(start)
  })

  it("drops the oldest once the list is full", () => {
    /**
     * The list is newest-first — `parseStoredRecentlyViewed` sorts it that
     * way and `recordView` prepends — so the fixture is built in that order
     * too, and `part-last` is the entry at the far end that falls off.
     * Truncating by position is only correct *because* of that invariant.
     */
    const start = Array.from({ length: MAX_RECENTLY_VIEWED }, (_, index) =>
      entry({ slug: `part-${index}`, viewedAt: 10_000 - index })
    )
    const oldest = start[start.length - 1].slug

    const entries = recordView(start, input({ slug: "newest" }), 99_999)

    expect(entries).toHaveLength(MAX_RECENTLY_VIEWED)
    expect(entries[0].slug).toBe("newest")
    expect(entries.some((item) => item.slug === oldest)).toBe(false)
  })
})

describe("removeRecentlyViewed", () => {
  it("removes only the named part", () => {
    const entries = removeRecentlyViewed(
      [entry({ slug: "a" }), entry({ slug: "b" })],
      "a"
    )

    expect(entries.map((item) => item.slug)).toEqual(["b"])
  })
})

describe("parseStoredRecentlyViewed", () => {
  it("reads back what was written", () => {
    const entries = [entry({ slug: "a", viewedAt: 2 }), entry({ slug: "b", viewedAt: 1 })]

    expect(parseStoredRecentlyViewed(serializeRecentlyViewed(entries))).toEqual(entries)
  })

  it("returns an empty list for nothing, for rubbish, and for the wrong shape", () => {
    // All three are reachable: a first visit, a hand edit, and a value left
    // behind by an older build under the same key.
    expect(parseStoredRecentlyViewed(null)).toEqual([])
    expect(parseStoredRecentlyViewed("not json at all")).toEqual([])
    expect(parseStoredRecentlyViewed('{"slug":"a"}')).toEqual([])
  })

  it("drops a malformed entry and keeps the rest", () => {
    /**
     * Losing one line of a history is a shrug; throwing the whole list away
     * because one object lost its name is a worse answer to the same
     * corruption.
     */
    const raw = JSON.stringify([
      entry({ slug: "good", viewedAt: 2 }),
      { slug: "no-name", viewedAt: 3 },
      null,
      "a string",
    ])

    const entries = parseStoredRecentlyViewed(raw)

    expect(entries.map((item) => item.slug)).toEqual(["good"])
  })

  it("de-duplicates a repeated slug", () => {
    const raw = JSON.stringify([
      entry({ slug: "a", viewedAt: 2 }),
      entry({ slug: "a", viewedAt: 1 }),
    ])

    expect(parseStoredRecentlyViewed(raw)).toHaveLength(1)
  })

  it("sorts newest first, whatever order the stored array was in", () => {
    const raw = JSON.stringify([
      entry({ slug: "old", viewedAt: 1 }),
      entry({ slug: "new", viewedAt: 3 }),
      entry({ slug: "middle", viewedAt: 2 }),
    ])

    expect(parseStoredRecentlyViewed(raw).map((item) => item.slug)).toEqual([
      "new",
      "middle",
      "old",
    ])
  })

  it("keeps an entry with no usable timestamp, sorted to the end", () => {
    // The part is still something the customer looked at; the only thing lost
    // is its exact position.
    const raw = JSON.stringify([
      { ...entry({ slug: "undated" }), viewedAt: "yesterday" },
      entry({ slug: "dated", viewedAt: 5 }),
    ])

    expect(parseStoredRecentlyViewed(raw).map((item) => item.slug)).toEqual([
      "dated",
      "undated",
    ])
  })

  it("truncates a hand-edited list that is far too long", () => {
    const raw = JSON.stringify(
      Array.from({ length: 200 }, (_, index) =>
        entry({ slug: `part-${index}`, viewedAt: index })
      )
    )

    expect(parseStoredRecentlyViewed(raw)).toHaveLength(MAX_RECENTLY_VIEWED)
  })

  it("normalises a missing price to null rather than dropping the entry", () => {
    // A part priced on enquiry has no figure, and that is a normal listing —
    // not a corrupt one.
    const raw = JSON.stringify([{ ...entry(), price: undefined }])

    expect(parseStoredRecentlyViewed(raw)[0].price).toBeNull()
  })
})
