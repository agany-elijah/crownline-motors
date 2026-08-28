import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options"

/**
 * Runs before every matched request (see src/proxy.ts).
 *
 * It does two things, and it is important to be precise about which of them
 * is a security control:
 *
 *   1. **Refreshes the session.** Supabase access tokens are short-lived.
 *      Server Components cannot write cookies, so without a refresh here
 *      every rotated token would be computed and then thrown away, and
 *      administrators would be signed out roughly hourly mid-task. This part
 *      is essential.
 *
 *   2. **Redirects unauthenticated requests away from /admin.** This is
 *      *not* a security control. It is there so an expired session produces
 *      a sign-in page instead of a flash of dashboard chrome.
 *
 * Point 2 must never be relied upon. CVE-2025-29927 allowed Next.js
 * middleware to be skipped entirely with a forged `x-middleware-subrequest`
 * header, and Next's own guidance is that proxy checks are "optimistic" and
 * that real checks belong next to the data. Security-files/authentication.md
 * says the same in as many words. The actual enforcement is
 * `requireAdmin()` / `authorizeAdmin()` in src/lib/auth/, which every admin
 * page and action calls, and which verifies the JWT *and* re-reads
 * AdminProfile.isActive from our own database.
 *
 * Deliberately absent here: any database lookup. The proxy only asks
 * "is there a valid session?", never "is this person staff?". Answering the
 * second question here would add a query to every request while changing
 * nothing about what is actually enforced.
 */

/**
 * Cache directive for anything whose response depends on who is asking.
 *
 * Set in the proxy rather than next.config.ts, which loses this particular
 * race: Next.js writes its own `Cache-Control: no-cache, must-revalidate`
 * onto dynamic responses, overriding a configured header. The proxy runs
 * last, so this is the one place the directive survives.
 *
 * `no-store` and `private` are the parts that matter. Cloudflare sits in
 * front of this application in production, and an admin page or an auth
 * callback held in a shared cache would be served to whoever asks next
 * (SECURITY.MD §47).
 */
const NO_STORE = "no-store, no-cache, must-revalidate, private"

/** Admin routes reachable without a session. Everything else under /admin is gated. */
const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
  "/admin/forgot-password",
  // Reached from a one-time recovery link, which establishes the session via
  // /auth/confirm. The page itself gates on that session and the action
  // re-checks the admin profile before writing anything.
  "/admin/reset-password",
]

function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set."
    )
  }

  const supabase = createServerClient(url, publishableKey, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

        response = NextResponse.next({ request })

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Verifies the token's signature — unlike getSession(), which trusts the
  // cookie. Also refreshes the session when it is close to expiry, which is
  // the reason this call has to happen before any redirect below.
  const { data, error } = await supabase.auth.getClaims()
  const hasSession = !error && Boolean(data?.claims?.sub)

  const { pathname } = request.nextUrl
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/")
  const isAuthRoute = pathname.startsWith("/auth/")

  if (isAdminRoute || isAuthRoute) {
    response.headers.set("Cache-Control", NO_STORE)
  }

  if (isAdminRoute && !isPublicAdminPath(pathname) && !hasSession) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/admin/login"
    loginUrl.search = ""
    // `pathname` comes from the router, not from user input, so it is a real
    // same-origin path by construction. It is still re-validated by
    // isSafeReturnPath before any redirect acts on it.
    loginUrl.searchParams.set("next", pathname)

    const redirectResponse = NextResponse.redirect(loginUrl)

    // Carry over any cookies the refresh above just set. Without this, a
    // token rotated on the very request that gets redirected would be
    // discarded, and the admin would be bounced to sign in again for no
    // reason on their next visit.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })

    redirectResponse.headers.set("Cache-Control", NO_STORE)

    return redirectResponse
  }

  return response
}
