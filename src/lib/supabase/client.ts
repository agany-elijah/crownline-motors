import { createBrowserClient } from "@supabase/ssr"

/**
 * Supabase client for the browser.
 *
 * ⚠️ Currently unused, and it cannot read the session.
 *
 * The session cookie is written with `httpOnly: true` (see
 * src/lib/supabase/cookie-options.ts), which is deliberate: nothing in this
 * application authenticates client-side, so a JavaScript-readable session
 * cookie would be pure downside — one XSS anywhere on the site would hand an
 * attacker an administrator session.
 *
 * That means a client created here starts signed out and stays that way. If
 * you reached for this to get the current user inside a Client Component,
 * that is the wrong tool: fetch it in a parent Server Component via
 * src/lib/auth/dal.ts and pass it down as props. Client Components cannot
 * import the DAL, and that boundary is the point.
 *
 * This client remains useful for things that are genuinely anonymous and
 * genuinely browser-side — Realtime subscriptions on public data, for
 * example. Do not flip `httpOnly` back to make it authenticate.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set."
    )
  }

  return createBrowserClient(url, publishableKey)
}
