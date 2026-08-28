import "server-only"

import { redirect } from "next/navigation"

import { getAdminProfile, type AdminProfileDTO } from "@/lib/auth/dal"
import { can, type AdminPermission } from "@/lib/auth/permissions"
import { ADMIN_FORBIDDEN_PATH, loginPathWithReturn } from "@/lib/auth/return-path"

/**
 * Enforcement built on the DAL (src/lib/auth/dal.ts) and the permission
 * matrix (src/lib/auth/permissions.ts).
 *
 * Two families of guard, because pages and server actions fail differently:
 *
 *   require*   — for Server Components. Never returns when access is
 *                denied; it redirects. Correct for a page, wrong for an
 *                action, where a redirect thrown mid-mutation is
 *                indistinguishable from success to the caller.
 *
 *   authorize* — for Server Actions and Route Handlers. Returns a
 *                discriminated result the caller must narrow, so the
 *                type system forces the check to be handled rather than
 *                letting a missing `await` slip through.
 *
 * Every admin page calls a require*; every admin action calls an
 * authorize*. The admin layout may also call one, but never *only* the
 * layout — see the note at the top of dal.ts for why that is not a
 * boundary in the App Router.
 */

/**
 * Server Components: requires an active administrator, any role.
 *
 * Returns the profile so the caller does not need a second lookup — the
 * DAL's cache() makes it the same request either way, but returning it
 * keeps call sites to one line.
 */
export async function requireAdmin(returnTo?: string): Promise<AdminProfileDTO> {
  const admin = await getAdminProfile()

  if (!admin) {
    redirect(loginPathWithReturn(returnTo))
  }

  return admin
}

/** Server Components: requires an active administrator holding `permission`. */
export async function requirePermission(
  permission: AdminPermission,
  returnTo?: string
): Promise<AdminProfileDTO> {
  const admin = await requireAdmin(returnTo)

  if (!can(admin.role, permission)) {
    // A signed-in admin who lacks a permission is a different situation
    // from an anonymous visitor, and gets a different destination: bouncing
    // them to the login page would read as "your session expired" and send
    // them round a loop they can never complete.
    redirect(ADMIN_FORBIDDEN_PATH)
  }

  return admin
}

/** The shape every authorize* guard returns. */
export type AuthorizationResult =
  | { ok: true; admin: AdminProfileDTO }
  | { ok: false; reason: "UNAUTHENTICATED" | "FORBIDDEN"; message: string }

/**
 * Server Actions / Route Handlers: requires an active administrator.
 *
 * The messages are intentionally the ones that would be shown to the
 * caller — generic, with no detail about which check failed or whether the
 * account exists (SECURITY.MD §5.4, §37).
 */
export async function authorizeAdmin(): Promise<AuthorizationResult> {
  const admin = await getAdminProfile()

  if (!admin) {
    return {
      ok: false,
      reason: "UNAUTHENTICATED",
      message: "Your session has expired. Please sign in again.",
    }
  }

  return { ok: true, admin }
}

/** Server Actions / Route Handlers: requires an administrator holding `permission`. */
export async function authorizePermission(
  permission: AdminPermission
): Promise<AuthorizationResult> {
  const result = await authorizeAdmin()

  if (!result.ok) {
    return result
  }

  if (!can(result.admin.role, permission)) {
    return {
      ok: false,
      reason: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    }
  }

  return result
}
