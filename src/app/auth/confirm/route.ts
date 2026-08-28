import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { ADMIN_LOGIN_PATH, resolveReturnPath } from "@/lib/auth/return-path"
import { createClient } from "@/lib/supabase/server"

/**
 * Exchanges a one-time email token for a session.
 *
 * Every Supabase authentication email — password recovery, and the invite
 * that provisions a new administrator — links here with a `token_hash` and a
 * `type`. This handler verifies that token server-side and, on success,
 * sets the session cookies before forwarding the browser onward.
 *
 * Why a server route rather than letting the client handle it: the older
 * Supabase pattern delivered tokens in the URL *fragment* for client-side
 * JavaScript to pick up. A fragment never reaches the server, so the session
 * could only be established in the browser — and any script on the page
 * could read the token on its way past. Verifying here keeps the token out
 * of client JavaScript entirely and the resulting session in HttpOnly
 * cookies (SECURITY.MD §5.3, §27).
 *
 * The token is single-use and short-lived: `verifyOtp` consumes it, so a
 * recovery link that has already been followed — or captured from a mail
 * server later — is inert (§43).
 */

/**
 * Redirects to a path on the same origin, without naming that origin.
 *
 * `NextResponse.redirect()` demands an absolute URL, and the obvious way to
 * build one — `new URL(path, request.url)` — is wrong behind a reverse
 * proxy. `request.url` carries the host and port Next.js is actually
 * listening on, so a proxied request produces a Location that mixes the
 * external protocol with the internal port: `https://example.com:3000/…`,
 * which resolves to nothing. Codespaces' port forwarding and Vercel both
 * front the app this way, so this is the normal case, not an edge one.
 *
 * A relative Location avoids the question entirely. RFC 7231 §7.1.2 permits
 * it and every browser resolves it against the request URL — which is the
 * externally-visible one, by definition. That makes this correct on
 * localhost, in a Codespace, and in production without any of them needing
 * to be detected.
 */
function redirectToPath(path: string): NextResponse {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: path },
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next")

  // Where to land after a successful exchange. Re-validated rather than
  // trusted: this URL arrives from an email, and an attacker who can get a
  // crafted link in front of an administrator would otherwise have an open
  // redirect that carries a freshly minted session with it.
  const destination = resolveReturnPath(next ?? undefined)

  if (!tokenHash || !type) {
    return redirectToPath(`${ADMIN_LOGIN_PATH}?error=invalid_link`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

  if (error) {
    // Expired, already used, or forged — all the same from here. The login
    // page renders one neutral message for this code; distinguishing the
    // cases would confirm to a stranger that a given token was once real.
    return redirectToPath(`${ADMIN_LOGIN_PATH}?error=invalid_link`)
  }

  return redirectToPath(destination)
}
