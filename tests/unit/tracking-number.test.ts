import { describe, expect, it } from "vitest"

import { parseTrackingLookup, trackingPagePath } from "@/lib/tracking/tracking-number"

describe("parseTrackingLookup", () => {
  it("accepts a tracking number exactly as issued", () => {
    expect(parseTrackingLookup("CLM-2026-000125")).toEqual({ kind: "TRACKING", value: "CLM-2026-000125" })
  })

  it("forgives case, spaces and missing hyphens", () => {
    for (const typed of ["clm-2026-000125", " CLM 2026 000125 ", "CLM2026000125", "clm.2026.000125"]) {
      expect(parseTrackingLookup(typed)).toEqual({ kind: "TRACKING", value: "CLM-2026-000125" })
    }
  })

  it("recognises an order number", () => {
    expect(parseTrackingLookup("clm-o-2026-000012")).toEqual({ kind: "ORDER", value: "CLM-O-2026-000012" })
  })

  it("refuses references of other kinds and malformed input", () => {
    for (const typed of ["CLM-Q-2026-000045", "CLM-V-2026-000123", "CLM-2026-12", "", "hello", "CLM-2026-0001250"]) {
      expect(parseTrackingLookup(typed)).toBeNull()
    }
  })

  it("refuses overly long input before parsing it", () => {
    expect(parseTrackingLookup(`CLM-2026-000125${" ".repeat(40)}`)).toBeNull()
  })
})

describe("trackingPagePath", () => {
  it("links straight to a tracking result", () => {
    expect(trackingPagePath("CLM-2026-000125")).toBe("/track-my-order?number=CLM-2026-000125")
  })

  it("falls back to the search page", () => {
    expect(trackingPagePath()).toBe("/track-my-order")
  })
})
