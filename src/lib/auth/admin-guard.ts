import "server-only"

import { redirect } from "next/navigation"

import { getAdminAccess, type ActiveAdminSession, type AdminProfileDTO } from "@/lib/auth/dal"
import { can, type AdminPermission } from "@/lib/auth/permissions"
import {
  ADMIN_FORBIDDEN_PATH,
  ADMIN_LOGIN_PATH,
  ADMIN_TWO_FACTOR_CHALLENGE_PATH,
  loginPathWithReturn,
} from "@/lib/auth/return-path"
import { TWO_FACTOR_SETTINGS_PATH } from "@/lib/constants/settings-nav"

/**
 * Enforcement built on the DAL (src/lib/auth/dal.ts) and the permission
 * matrix (src/lib/auth/permissions.ts).
 *
 * Two families of guard, because pages and server actions fail differently:
 *
 *   require*   — for Server Components. Never returns when access is denied;
 *                it redirects to the place that resolves the refusal.
 *   authorize* — for Server Actions and Route Handlers. Returns a
 *                discriminated result the caller must narrow.
 *
 * ── allowTwoFactorSetup ───────────────────────────────────────────────
 * When Settings requires two-factor for everyone, an administrator without it
 * may reach exactly the pages and actions that set it up (and the chrome
 * around them). Everything else sends them there. The option is opt-in per
 * call site, so a new page is locked until someone decides otherwise.
 */

export interface GuardOptions {
  returnTo?: string
  allowTwoFactorSetup?: boolean
}

/** Server Components: requires an administrator with full access, any role. */
export async function requireAdmin(options: GuardOptions = {}): Promise<AdminProfileDTO> {
  const access = await getAdminAccess()

  switch (access.status) {
    case "OK":
      return access.admin
    case "TWO_FACTOR_SETUP_REQUIRED":
      if (options.allowTwoFactorSetup) return access.admin
      redirect(`${TWO_FACTOR_SETTINGS_PATH}?required=1`)
    case "TWO_FACTOR_REQUIRED":
      redirect(ADMIN_TWO_FACTOR_CHALLENGE_PATH)
    case "SESSION_ENDED":
      redirect(`${ADMIN_LOGIN_PATH}?notice=${access.reason === "EXPIRED" ? "session_expired" : "session_ended"}`)
    case "SIGNED_OUT":
      redirect(loginPathWithReturn(options.returnTo))
  }
}

/** Server Components: requires an administrator holding `permission`. */
export async function requirePermission(
  permission: AdminPermission,
  options: GuardOptions = {}
): Promise<AdminProfileDTO> {
  const admin = await requireAdmin(options)

  if (!can(admin.role, permission)) {
    // A signed-in admin who lacks a permission gets a different destination
    // from an anonymous visitor: the login page would read as "your session
    // expired" and send them round a loop they can never complete.
    redirect(ADMIN_FORBIDDEN_PATH)
  }

  return admin
}

/** The shape every authorize* guard returns. */
export type AuthorizationResult =
  | { ok: true; admin: AdminProfileDTO; session: ActiveAdminSession }
  | { ok: false; reason: "UNAUTHENTICATED" | "FORBIDDEN"; message: string }

/**
 * Server Actions / Route Handlers: requires an administrator with full access.
 *
 * The messages are intentionally generic, with no detail about which check
 * failed (SECURITY.MD §5.4, §37).
 */
export async function authorizeAdmin(options: Pick<GuardOptions, "allowTwoFactorSetup"> = {}): Promise<AuthorizationResult> {
  const access = await getAdminAccess()

  if (access.status === "OK") {
    return { ok: true, admin: access.admin, session: access.session }
  }

  if (access.status === "TWO_FACTOR_SETUP_REQUIRED") {
    return options.allowTwoFactorSetup
      ? { ok: true, admin: access.admin, session: access.session }
      : {
          ok: false,
          reason: "FORBIDDEN",
          message: "Set up two-factor authentication for your account before continuing.",
        }
  }

  return {
    ok: false,
    reason: "UNAUTHENTICATED",
    message: "Your session has expired. Please sign in again.",
  }
}

/** Server Actions / Route Handlers: requires an administrator holding `permission`. */
export async function authorizePermission(
  permission: AdminPermission,
  options: Pick<GuardOptions, "allowTwoFactorSetup"> = {}
): Promise<AuthorizationResult> {
  const result = await authorizeAdmin(options)

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
