import { describe, expect, it } from "vitest"

import {
  SUPABASE_COOKIE_OPTIONS,
  cookieOptionsFor,
} from "@/lib/supabase/cookie-options"

/**
 * The session cookie's attributes are the difference between an XSS bug
 * being a defacement and being a full administrator takeover. They are also
 * three words in an object literal that a well-meaning refactor could drop
 * without any test going red — which is precisely why they get their own.
 *
 * @supabase/ssr ships `httpOnly: false` by default, so this is an override,
 * not an inherited safe default. Anything that resets these options to the
 * library's defaults reopens the hole silently.
 */
describe("supabase session cookie options", () => {
  it("keeps the session cookie out of JavaScript's reach", () => {
    // The whole point. Nothing in this application authenticates
    // client-side, so there is no legitimate reason for document.cookie to
    // see this value.
    expect(SUPABASE_COOKIE_OPTIONS.httpOnly).toBe(true)
  })

  it("requires HTTPS in production", () => {
    // Cannot be observed by running locally, where it is false by design —
    // so it is checked here rather than trusted on inspection. Without it,
    // a session cookie would travel over plain HTTP on any downgrade.
    expect(cookieOptionsFor("production").secure).toBe(true)
  })

  it("does not require HTTPS in development", () => {
    // The other half: if this were unconditionally true, the cookie would
    // never set on http://localhost and sign-in would fail locally with no
    // obvious cause.
    expect(cookieOptionsFor("development").secure).toBe(false)
    expect(cookieOptionsFor("test").secure).toBe(false)
    expect(cookieOptionsFor(undefined).secure).toBe(false)
  })

  it("uses SameSite=lax, not strict", () => {
    // Deliberate. "strict" withholds the cookie on a top-level navigation
    // arriving from another site — which is exactly how an administrator
    // returns from a password-reset email, so it would break recovery.
    // "none" would be worse still: it would permit cross-site sends.
    expect(SUPABASE_COOKIE_OPTIONS.sameSite).toBe("lax")
  })

  it("scopes the cookie to the whole site", () => {
    // The server client and the proxy both write this cookie. A mismatched
    // path would let a refreshed token sit beside a stale one instead of
    // replacing it, and the browser would send both.
    expect(SUPABASE_COOKIE_OPTIONS.path).toBe("/")
  })
})
