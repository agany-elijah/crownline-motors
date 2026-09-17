import { describe, expect, it } from "vitest"

import {
  SETTINGS_SEARCH_ENTRIES,
  SUGGESTED_SETTINGS,
  editDistance,
  searchSettings,
} from "@/lib/settings/settings-search"

const top = (query: string) => searchSettings(SETTINGS_SEARCH_ENTRIES, query)[0]?.id

describe("settings search", () => {
  it("finds a setting by its own name", () => {
    expect(top("whatsapp number")).toBe("whatsapp")
    expect(top("tracking prefix")).toBe("tracking-prefix")
  })

  it("forgives typos", () => {
    expect(top("whatsap")).toBe("whatsapp")
    expect(top("pasword")).toBe("change-password")
    expect(top("trakcing stages")).toBe("tracking-stages")
  })

  it("matches as the word is typed", () => {
    expect(searchSettings(SETTINGS_SEARCH_ENTRIES, "notif").map((entry) => entry.id)).toContain("admin-notifications")
  })

  it("understands the words people use instead of our labels", () => {
    expect(top("deposit")).toBe("payment-schedule")
    expect(top("2fa")).toBe("two-factor")
    expect(top("dark mode")).toBe("theme")
    expect(searchSettings(SETTINGS_SEARCH_ENTRIES, "hide price").map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["vehicle-visibility", "part-visibility"])
    )
  })

  it("returns nothing for an empty query or gibberish", () => {
    expect(searchSettings(SETTINGS_SEARCH_ENTRIES, "  ")).toEqual([])
    expect(searchSettings(SETTINGS_SEARCH_ENTRIES, "qzxv")).toEqual([])
  })

  it("links every entry to a settings page and suggests only real entries", () => {
    const ids = new Set(SETTINGS_SEARCH_ENTRIES.map((entry) => entry.id))
    expect(ids.size).toBe(SETTINGS_SEARCH_ENTRIES.length)
    for (const id of SUGGESTED_SETTINGS) expect(ids.has(id)).toBe(true)
    for (const entry of SETTINGS_SEARCH_ENTRIES) expect(entry.href).toMatch(/\/settings(\/[a-z-]+)*#[A-Za-z-]+$/)
  })

  it("caps edit distance instead of computing it in full", () => {
    expect(editDistance("password", "pasword", 1)).toBe(1)
    expect(editDistance("tracking", "trakcing", 1)).toBe(1)
    expect(editDistance("logo", "notifications", 2)).toBe(3)
  })
})
