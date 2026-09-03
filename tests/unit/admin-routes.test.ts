import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import {
  ADMIN_BASE_PATH,
  adminPath,
  isAdminPath,
} from "@/lib/constants/admin-routes"

/**
 * The dashboard's address exists in two places that TypeScript cannot
 * reconcile for us: `ADMIN_BASE_PATH`, and a directory name under
 * `src/app/(admin)/`. Next.js builds routes from the filesystem, so a
 * mismatch compiles cleanly and then 404s every internal link in the admin
 * area — the sort of failure that is obvious in production and invisible in
 * review.
 *
 * This suite is the reconciliation. It reads the directory listing rather
 * than restating the expected name, so it fails on a rename of either side
 * and passes on a rename of both.
 */
describe("ADMIN_BASE_PATH", () => {
  it("matches the route folder Next.js actually serves", () => {
    const adminGroup = fileURLToPath(
      new URL("../../src/app/(admin)", import.meta.url)
    )

    // Exactly one segment folder under the (admin) route group. Route groups
    // are parenthesised and contribute no URL segment, so anything else here
    // would mean a second admin base path had been introduced.
    const segments = readdirSync(adminGroup, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("("))
      .map((entry) => entry.name)

    expect(segments).toEqual([ADMIN_BASE_PATH.slice(1)])
  })

  it("is not the default /admin that scanners probe", () => {
    // The whole point of the move. If someone reverts the constant without
    // reverting the intent, this is the line that says so.
    expect(ADMIN_BASE_PATH).not.toBe("/admin")
    expect(ADMIN_BASE_PATH.startsWith("/")).toBe(true)
    expect(ADMIN_BASE_PATH.endsWith("/")).toBe(false)
  })
})

describe("adminPath", () => {
  it("returns the base path when given nothing", () => {
    expect(adminPath()).toBe(ADMIN_BASE_PATH)
  })

  it("appends a subpath verbatim", () => {
    expect(adminPath("/vehicles")).toBe(`${ADMIN_BASE_PATH}/vehicles`)
    expect(adminPath("/vehicles/new")).toBe(`${ADMIN_BASE_PATH}/vehicles/new`)
  })
})

describe("isAdminPath", () => {
  it("matches the base path and anything beneath it", () => {
    expect(isAdminPath(ADMIN_BASE_PATH)).toBe(true)
    expect(isAdminPath(`${ADMIN_BASE_PATH}/settings`)).toBe(true)
    expect(isAdminPath(`${ADMIN_BASE_PATH}/vehicles/abc-123`)).toBe(true)
  })

  it("does not match a sibling route sharing the prefix", () => {
    // The proxy sets no-store headers and gates access on this answer, so a
    // prefix match rather than a segment match would pull an unrelated
    // public route into the admin treatment.
    expect(isAdminPath(`${ADMIN_BASE_PATH}-news`)).toBe(false)
    expect(isAdminPath(`${ADMIN_BASE_PATH}x`)).toBe(false)
  })

  it("no longer matches the old /admin prefix", () => {
    expect(isAdminPath("/admin")).toBe(false)
    expect(isAdminPath("/admin/vehicles")).toBe(false)
  })
})
