import { describe, expect, it } from "vitest"

import {
  ADMIN_HOME_PATH,
  ADMIN_LOGIN_PATH,
  isSafeReturnPath,
  loginPathWithReturn,
  resolveReturnPath,
} from "@/lib/auth/return-path"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

/**
 * These tests exist because `isSafeReturnPath` is the only thing standing
 * between the sign-in flow and an open redirect. The redirect it guards
 * happens immediately after a session is issued, so a bypass would hand an
 * attacker a page that is genuinely reached from the real domain, with the
 * administrator genuinely signed in — the ideal shape for a phishing follow-up.
 *
 * Written negative-first on purpose (SECURITY.MD §63): the interesting cases
 * are the ones that must be refused.
 *
 * Paths are built from ADMIN_BASE_PATH rather than written out, so these
 * assertions keep testing the real boundary if the dashboard is relocated
 * again — a suite hard-coding "/admin" would go green against a guard that
 * no longer protects anything.
 */
describe("isSafeReturnPath", () => {
  it("accepts the admin home and paths beneath it", () => {
    expect(isSafeReturnPath(ADMIN_BASE_PATH)).toBe(true)
    expect(isSafeReturnPath(`${ADMIN_BASE_PATH}/vehicles`)).toBe(true)
    expect(isSafeReturnPath(`${ADMIN_BASE_PATH}/orders/abc-123`)).toBe(true)
  })

  it("rejects absolute URLs to other origins", () => {
    expect(isSafeReturnPath(`https://evil.example${ADMIN_BASE_PATH}`)).toBe(false)
    expect(isSafeReturnPath("http://evil.example")).toBe(false)
  })

  it("rejects protocol-relative URLs", () => {
    // The classic bypass: these begin with "/" and so pass any naive
    // "starts with a slash" check, but a browser treats them as
    // scheme-relative and navigates straight off-site.
    expect(isSafeReturnPath("//evil.example")).toBe(false)
    expect(isSafeReturnPath(`//evil.example${ADMIN_BASE_PATH}`)).toBe(false)
  })

  it("rejects backslash-prefixed URLs", () => {
    // Several browsers normalise "\" to "/" in the authority position, so
    // "/\evil.example" behaves exactly like "//evil.example".
    expect(isSafeReturnPath("/\\evil.example")).toBe(false)
    expect(isSafeReturnPath("/\\/evil.example")).toBe(false)
  })

  it("rejects same-origin paths outside the admin area", () => {
    // Not a redirect to an attacker, but still not somewhere a staff
    // sign-in should land — and narrowing the allowed set is what keeps
    // this function simple enough to be obviously correct.
    expect(isSafeReturnPath("/")).toBe(false)
    expect(isSafeReturnPath("/cars")).toBe(false)
    expect(isSafeReturnPath("/get-a-quote")).toBe(false)
  })

  it("rejects a path that merely shares a prefix with the admin base", () => {
    // A sibling route whose name begins with the same characters is a
    // different route entirely; the check must be on a segment boundary.
    expect(isSafeReturnPath(`${ADMIN_BASE_PATH}-portal`)).toBe(false)
    expect(isSafeReturnPath(`${ADMIN_BASE_PATH}x`)).toBe(false)
    // The path the dashboard used to live at must no longer be accepted.
    expect(isSafeReturnPath("/admin")).toBe(false)
    expect(isSafeReturnPath("/admin/vehicles")).toBe(false)
  })

  it("rejects empty and non-path values", () => {
    expect(isSafeReturnPath("")).toBe(false)
    expect(isSafeReturnPath(ADMIN_BASE_PATH.slice(1))).toBe(false)
    expect(isSafeReturnPath("javascript:alert(1)")).toBe(false)
  })
})

describe("loginPathWithReturn", () => {
  it("returns the bare login path when there is nothing to return to", () => {
    expect(loginPathWithReturn()).toBe(ADMIN_LOGIN_PATH)
    expect(loginPathWithReturn(undefined)).toBe(ADMIN_LOGIN_PATH)
  })

  it("drops an unsafe return path rather than carrying it", () => {
    // Silently dropping is right here: the caller still reaches a working
    // login page, and nothing an attacker supplied survives the round trip.
    expect(loginPathWithReturn("//evil.example")).toBe(ADMIN_LOGIN_PATH)
    expect(loginPathWithReturn("https://evil.example")).toBe(ADMIN_LOGIN_PATH)
  })

  it("encodes a safe return path", () => {
    expect(loginPathWithReturn(`${ADMIN_BASE_PATH}/vehicles`)).toBe(
      `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(`${ADMIN_BASE_PATH}/vehicles`)}`
    )
  })

  it("percent-encodes the return path rather than concatenating it", () => {
    // The base path contains "@", which is legal in a path but must not be
    // allowed to sit raw inside a query-string value.
    const encoded = loginPathWithReturn(`${ADMIN_BASE_PATH}/vehicles`)

    expect(encoded).toContain("next=%2F")
    expect(encoded.split("next=")[1]).not.toContain("/")
  })
})

describe("resolveReturnPath", () => {
  it("falls back to the admin home for anything unsafe or absent", () => {
    expect(resolveReturnPath(undefined)).toBe(ADMIN_HOME_PATH)
    expect(resolveReturnPath("")).toBe(ADMIN_HOME_PATH)
    expect(resolveReturnPath("//evil.example")).toBe(ADMIN_HOME_PATH)
    expect(resolveReturnPath("/cars")).toBe(ADMIN_HOME_PATH)
  })

  it("passes a safe path through unchanged", () => {
    expect(resolveReturnPath(`${ADMIN_BASE_PATH}/orders`)).toBe(
      `${ADMIN_BASE_PATH}/orders`
    )
  })
})
