import type { CookieOptions } from "@supabase/ssr"

/**
 * Cookie attributes for the Supabase session, shared by every client that
 * writes one.
 *
 * These MUST be identical in src/lib/supabase/server.ts and
 * src/lib/supabase/proxy.ts. Cookies are keyed by name + domain + path, so a
 * mismatch in `path` would let the proxy's refreshed token sit alongside the
 * server's stale one instead of replacing it, and the browser would send
 * both.
 *
 * ── Why override @supabase/ssr's defaults ─────────────────────────────
 * The library ships `httpOnly: false` and no `secure`. That default exists
 * for applications whose browser-side `createBrowserClient` needs to read
 * the session out of the cookie to hydrate itself.
 *
 * This application has no such code path: authentication happens entirely in
 * Server Actions and the DAL, and nothing under a "use client" directive
 * touches Supabase. So the default buys us nothing and costs real
 * protection — a readable session cookie turns any single XSS anywhere on
 * the site into full administrator account takeover, which is exactly what
 * Security-files/authentication.md warns about under "Session & Token
 * Storage" and what SECURITY.MD §27 requires.
 *
 * ⚠️ If a future phase introduces a browser-side Supabase client — Realtime
 * subscriptions, or client-side auth state for customer accounts in Wave B —
 * it will not be able to read this cookie, and that is the intended
 * behaviour, not a bug to fix by flipping httpOnly back. Pass the session to
 * client components from a Server Component instead.
 */
/**
 * Built by a function of the environment rather than written inline, so the
 * production branch is reachable from a unit test. `secure` is the one
 * attribute here that cannot be checked by running the app locally — it is
 * false by design in development — which makes it exactly the one worth
 * pinning in a test rather than trusting on inspection.
 */
export function cookieOptionsFor(nodeEnv: string | undefined): CookieOptions {
  return {
    path: "/",

    // Invisible to JavaScript, sent automatically by the browser.
    httpOnly: true,

    // HTTPS only in production. Left off in development so the flow works on
    // plain-http localhost; production is fronted by Cloudflare and Vercel,
    // both HTTPS-only, so nothing legitimate is excluded.
    secure: nodeEnv === "production",

    // "lax" rather than "strict": the session must survive a top-level
    // navigation arriving from elsewhere, which is precisely how an
    // administrator returns from a password-reset email. "strict" would
    // withhold the cookie on that first request and bounce them to sign in.
    sameSite: "lax",
  }
}

export const SUPABASE_COOKIE_OPTIONS: CookieOptions = cookieOptionsFor(
  process.env.NODE_ENV
)
