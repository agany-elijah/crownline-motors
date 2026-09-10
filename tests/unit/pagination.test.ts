import { describe, expect, it } from "vitest"

import { paginationRange } from "@/lib/utils/pagination"

/**
 * The pager's window.
 *
 * Worth its own suite because every failure mode here is invisible until
 * the inventory reaches a particular size in production: a duplicated page
 * number, a missing last page, or a control that changes width as the
 * customer steps through it and moves the Next button out from under their
 * thumb.
 */

/** Every entry is either a page in range or a gap marker, never a repeat. */
function assertWellFormed(range: (number | null)[], pageCount: number) {
  const pages = range.filter((value): value is number => value !== null)

  expect(new Set(pages).size).toBe(pages.length)
  expect([...pages].sort((a, b) => a - b)).toEqual(pages)

  for (const value of pages) {
    expect(value).toBeGreaterThanOrEqual(1)
    expect(value).toBeLessThanOrEqual(pageCount)
  }

  // A gap always stands between two real pages — never leading, trailing,
  // or doubled, all of which render as a stray ellipsis.
  range.forEach((value, index) => {
    if (value !== null) return
    expect(range[index - 1]).toBeTypeOf("number")
    expect(range[index + 1]).toBeTypeOf("number")
  })
}

describe("paginationRange", () => {
  it("lists every page while they all fit", () => {
    expect(paginationRange(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(paginationRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("always includes the first and last page", () => {
    for (const page of [1, 2, 10, 25, 49, 50]) {
      const range = paginationRange(page, 50)

      expect(range[0]).toBe(1)
      expect(range[range.length - 1]).toBe(50)
    }
  })

  it("keeps the current page and its neighbours visible", () => {
    expect(paginationRange(10, 50)).toContain(9)
    expect(paginationRange(10, 50)).toContain(10)
    expect(paginationRange(10, 50)).toContain(11)
  })

  it("holds one width wherever the customer is", () => {
    // Otherwise the control resizes as they step through it and Next moves
    // under the thumb that is already reaching for it.
    const widths = [1, 2, 3, 25, 48, 49, 50].map(
      (page) => paginationRange(page, 50).length
    )

    expect(new Set(widths).size).toBe(1)
  })

  it("stays well formed across every position of every size", () => {
    for (let pageCount = 1; pageCount <= 30; pageCount += 1) {
      for (let page = 1; page <= pageCount; page += 1) {
        assertWellFormed(paginationRange(page, pageCount), pageCount)
      }
    }
  })

  it("clamps a page outside the range instead of inventing one", () => {
    // Reachable from a hand-edited URL between the server clamping and the
    // pager rendering.
    assertWellFormed(paginationRange(0, 10), 10)
    assertWellFormed(paginationRange(99, 10), 10)
    expect(paginationRange(-3, 4)).toEqual([1, 2, 3, 4])
  })

  it("renders nothing for a list that cannot be paged", () => {
    expect(paginationRange(1, 0)).toEqual([])
    expect(paginationRange(1, -2)).toEqual([])
  })
})
