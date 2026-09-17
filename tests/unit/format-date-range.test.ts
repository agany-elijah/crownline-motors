import { describe, expect, it } from "vitest"

import { formatDateRange } from "@/lib/utils/format-date-range"

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day))

describe("formatDateRange", () => {
  it("shares the month and year inside one month", () => {
    expect(formatDateRange(d(2026, 10, 17), d(2026, 10, 30))).toBe("17–30 October 2026")
  })

  it("names both months across a month boundary", () => {
    expect(formatDateRange(d(2026, 9, 28), d(2026, 10, 5))).toBe("28 September – 5 October 2026")
  })

  it("names both years across a year boundary", () => {
    expect(formatDateRange(d(2026, 12, 28), d(2027, 1, 6))).toBe("28 December 2026 – 6 January 2027")
  })

  it("is a single date without an end, or with the same day as the end", () => {
    expect(formatDateRange(d(2026, 10, 17), null)).toBe("17 October 2026")
    expect(formatDateRange(d(2026, 10, 17), d(2026, 10, 17))).toBe("17 October 2026")
  })

  it("does not shift a day for a reader west of UTC", () => {
    // Stored as midnight UTC; formatting in local time would print the 16th.
    expect(formatDateRange(d(2026, 10, 17), null)).toContain("17")
  })
})
