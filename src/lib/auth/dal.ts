import "server-only"

import { cache } from "react"

import { checkAdminSession, type ActiveAdminSession } from "@/lib/auth/admin-sessions"
import { prisma } from "@/lib/prisma"
import { getOperationalSettings } from "@/lib/queries/settings.queries"
import { createClient } from "@/lib/supabase/server"
import type { AdminRole } from "@/generated/prisma/enums"

/**
 * Data Access Layer — the authorisation boundary for this application.
 *
 * Next.js is explicit that a layout is *not* a place to enforce access
 * (node_modules/next/dist/docs/01-app/02-guides/authentication.md, "Layouts
 * and auth checks"), and the proxy is no better: CVE-2025-29927 showed
 * middleware could be bypassed with a spoofed header. So authorisation lives
 * here, next to the data, and every admin page and action calls into it.
 * `cache()` deduplicates the work within a request.
 *
 * ── What "signed in" means here ───────────────────────────────────────
 * Five conditions, all of which must hold, checked in this order:
 *
 *   1. A signature-verified Supabase token.
 *   2. An AdminProfile for that identity, and it is active. Being able to
 *      sign in is not being an administrator, and deactivation must revoke
 *      access at once rather than when the token expires.
 *   3. The token's session is one Crownline still accepts — not ended from
 *      another device, not older than the configured timeout
 *      (Settings → Admin users & security). See AdminSession.
 *   4. If the administrator has two-factor authentication, the token proves
 *      it: its `aal` claim is `aal2`. The claim is signed; the requirement
 *      comes from our own `twoFactorEnabledAt`. Neither alone would do.
 *   5. If Settings requires two-factor for everyone and this administrator
 *      has not set it up, they may reach the setup page and nothing else.
 *
 * Every check fails closed: a database error throws, and a thrown error is
 * never an "allowed".
 */

/** The authenticated Supabase identity. Says nothing about permissions. */
export interface SessionUser {
  id: string
  email: string | null
  /** Supabase's session identifier, from the signed token. */
  sessionId: string | null
  /** The assurance level the session has proven — "aal2" after a 2FA code. */
  aal: string | null
}

/**
 * What an authenticated administrator is allowed to be described as.
 *
 * A deliberate DTO rather than the Prisma row: admin pages pass this into
 * client components, and returning the whole record would ship any future
 * internal column into the browser bundle.
 */
export interface AdminProfileDTO {
  id: string
  email: string
  displayName: string
  role: AdminRole
  twoFactorEnabled: boolean
}

export type { ActiveAdminSession }

export type AdminAccess =
  | { status: "SIGNED_OUT" }
  /** The session was ended from another device, or aged past the timeout. */
  | { status: "SESSION_ENDED"; reason: "ENDED" | "EXPIRED" }
  /** Password accepted; the authenticator code has not been given yet. */
  | { status: "TWO_FACTOR_REQUIRED"; admin: AdminProfileDTO }
  /** Two-factor is required for everyone and this administrator has none. */
  | { status: "TWO_FACTOR_SETUP_REQUIRED"; admin: AdminProfileDTO; session: ActiveAdminSession }
  | { status: "OK"; admin: AdminProfileDTO; session: ActiveAdminSession }

/**
 * Verifies the caller's JWT and returns the identity it asserts.
 *
 * `getClaims()` — not `getSession()` — because only `getClaims()` verifies the
 * token's signature. `getSession()` trusts the cookie, which is a value the
 * client controls.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) {
    return null
  }

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
    sessionId: typeof data.claims.session_id === "string" ? data.claims.session_id : null,
    aal: typeof data.claims.aal === "string" ? data.claims.aal : null,
  }
})

export const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  const user = await getSessionUser()
  if (!user) return { status: "SIGNED_OUT" }

  const profile = await prisma.adminProfile.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      isActive: true,
      twoFactorEnabledAt: true,
    },
  })

  if (!profile || !profile.isActive) return { status: "SIGNED_OUT" }

  // Every Supabase access token carries a session id. One without cannot be
  // tied to a session this application can end, so it is not accepted.
  if (!user.sessionId) return { status: "SIGNED_OUT" }

  const { security } = await getOperationalSettings()

  const verdict = await checkAdminSession({
    adminId: profile.id,
    authSessionId: user.sessionId,
    timeoutHours: security.sessionTimeoutHours,
  })

  if (verdict.status !== "ACTIVE") return { status: "SESSION_ENDED", reason: verdict.status }

  const admin: AdminProfileDTO = {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
    twoFactorEnabled: profile.twoFactorEnabledAt !== null,
  }

  if (admin.twoFactorEnabled && user.aal !== "aal2") {
    return { status: "TWO_FACTOR_REQUIRED", admin }
  }

  if (security.requireTwoFactor && !admin.twoFactorEnabled) {
    return { status: "TWO_FACTOR_SETUP_REQUIRED", admin, session: verdict.session }
  }

  return { status: "OK", admin, session: verdict.session }
})

/**
 * The signed-in administrator with full access, or null.
 *
 * Null for every state short of OK — including a session waiting on its
 * two-factor code — so a caller that only asks "is someone fully signed in?"
 * can never mistake a half-authenticated session for a whole one.
 */
export const getAdminProfile = cache(async (): Promise<AdminProfileDTO | null> => {
  const access = await getAdminAccess()
  return access.status === "OK" ? access.admin : null
})
