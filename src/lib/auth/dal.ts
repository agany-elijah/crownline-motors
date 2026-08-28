import "server-only"

import { cache } from "react"

import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import type { AdminRole } from "@/generated/prisma/enums"

/**
 * Data Access Layer — the authorisation boundary for this application.
 *
 * Next.js is explicit that a layout is *not* a place to enforce access
 * (see node_modules/next/dist/docs/01-app/02-guides/authentication.md,
 * "Layouts and auth checks"): route segments are rendered by the router,
 * so a layout that redirects does not stop its children from running or
 * from appearing in the RSC payload. Partial Rendering compounds it —
 * layouts don't re-render on navigation, so a check placed there wouldn't
 * even run again on a route change.
 *
 * The proxy is no better as a boundary: CVE-2025-29927 showed Next.js
 * middleware could be bypassed outright with a spoofed header, and
 * Security-files/authentication.md requires auth to be re-verified in
 * Server Actions, Route Handlers and data access regardless. The proxy in
 * proxy.ts is therefore session refresh plus a UX redirect, nothing more.
 *
 * So authorisation lives here, next to the data, and every admin page and
 * every admin server action calls into it. `cache()` deduplicates the work
 * within a single render pass, which is what makes "check it everywhere"
 * cost one JWT verification and one indexed row read per request rather
 * than one per call site.
 *
 * ── Wave B note ───────────────────────────────────────────────────────
 * Customer accounts reuse `getSessionUser()` unchanged and add a sibling
 * `getCustomerProfile()` alongside `getAdminProfile()`. The session
 * primitive is deliberately role-agnostic for that reason; nothing below
 * it assumes the authenticated user is staff.
 */

/** The authenticated Supabase identity. Says nothing about permissions. */
export interface SessionUser {
  id: string
  email: string | null
}

/**
 * What an authenticated administrator is allowed to be described as.
 *
 * A deliberate DTO rather than the Prisma row: admin pages pass this into
 * client components (the account menu), and returning the whole record
 * would ship `createdAt`/`updatedAt` and any future internal column into
 * the browser bundle. Adding a sensitive column to AdminProfile must not
 * silently expose it — so fields are listed rather than spread.
 */
export interface AdminProfileDTO {
  id: string
  email: string
  displayName: string
  role: AdminRole
}

/**
 * Verifies the caller's JWT and returns the identity it asserts.
 *
 * `getClaims()` — not `getSession()` — because only `getClaims()` verifies
 * the token's signature. `getSession()` reads the cookie and trusts it,
 * which for a cookie-based store means trusting a value the client
 * controls. Supabase's own type docs carry that warning verbatim.
 *
 * Returns null for anonymous callers instead of throwing: the login page
 * and the proxy both need to ask "is anyone signed in?" without that
 * question being an error.
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
  }
})

/**
 * Resolves the signed-in identity to an active administrator, or null.
 *
 * Two independent conditions must hold, and both matter:
 *
 *   1. An AdminProfile row exists whose id equals the Supabase auth UID.
 *      Being able to sign in is not being an administrator. Self-signup is
 *      disabled in the Supabase dashboard, but this check is what makes
 *      that a defence-in-depth measure rather than the only thing standing
 *      between a stray auth user and the dashboard.
 *
 *   2. `isActive` is true. Admins are deactivated, never deleted, because
 *      Payment.verifiedByAdminId and TrackingEvent.createdByAdminId are
 *      Restrict foreign keys — the audit trail depends on those rows
 *      surviving. Checking the flag on every request is therefore what
 *      actually revokes access, and it revokes it immediately: a
 *      deactivated admin's JWT stays cryptographically valid until it
 *      expires, so a signature check alone would leave them working for
 *      up to an hour.
 */
export const getAdminProfile = cache(async (): Promise<AdminProfileDTO | null> => {
  const user = await getSessionUser()

  if (!user) {
    return null
  }

  const profile = await prisma.adminProfile.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      isActive: true,
    },
  })

  if (!profile || !profile.isActive) {
    return null
  }

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
  }
})
