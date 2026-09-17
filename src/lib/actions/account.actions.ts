"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { AdminSessionEndReason } from "@/generated/prisma/enums"
import { logSecurityEvent, recordAuditLog, recordAuditLogBestEffort } from "@/lib/audit"
import { authorizeAdmin } from "@/lib/auth/admin-guard"
import {
  endAdminSessionById,
  endAllAdminSessions,
  endOtherAdminSessions,
} from "@/lib/auth/admin-sessions"
import { getEmailLinkOrigin } from "@/lib/auth/email-link-origin"
import {
  PASSWORD_RESET_MAX_ATTEMPTS,
  RATE_LIMIT_SCOPES,
  REAUTH_MAX_ATTEMPTS,
  checkRateLimit,
  clearAttempts,
  consumeRateLimit,
  recordFailedAttempt,
  type RateLimitKey,
} from "@/lib/auth/rate-limit"
import { verifyAdminPassword } from "@/lib/auth/reauthenticate"
import { ADMIN_LOGIN_PATH } from "@/lib/auth/return-path"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { SECURITY_SETTINGS_PATH } from "@/lib/constants/settings-nav"
import { prisma } from "@/lib/prisma"
import { getOperationalSettings } from "@/lib/queries/settings.queries"
import { createClient } from "@/lib/supabase/server"
import {
  adminProfileSchema,
  changePasswordSchema,
  emailChangeSchema,
  sessionIdSchema,
} from "@/lib/validations/security.schema"

/**
 * The signed-in administrator's own account: name, email, sessions and
 * password.
 *
 * Every action acts on the caller and only the caller — the administrator is
 * taken from the verified session, never from the request — so none of these
 * can be pointed at another account. Each is reachable while two-factor setup
 * is pending (`allowTwoFactorSetup`), except where noted: an administrator
 * being made to set up 2FA must still be able to sign out and fix their own
 * details.
 *
 * Changing the email address or the password requires the current password
 * (SECURITY.MD §42): a session left open on a shared computer must not be
 * enough to take the account over.
 */

export interface AccountActionState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Record<string, string[]>
}

const CHECK_FIELDS = "Check the highlighted fields and try again."

function invalid(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }): AccountActionState {
  return { status: "error", message: CHECK_FIELDS, fieldErrors: error.flatten().fieldErrors as Record<string, string[]> }
}

function reauthKeys(adminId: string): RateLimitKey[] {
  return [{ scope: RATE_LIMIT_SCOPES.reauthAdmin, identifier: adminId }]
}

const TOO_MANY_ATTEMPTS = "Too many incorrect passwords. Wait 15 minutes and try again."

function revalidateAccount(): void {
  // The name in the top bar and every security page.
  revalidatePath(ADMIN_BASE_PATH, "layout")
}

/**
 * Confirms the current password, counting failures against the administrator.
 * Returns an error state to hand back, or null when the password is right.
 */
async function confirmCurrentPassword(adminId: string, email: string, password: string): Promise<AccountActionState | null> {
  const keys = reauthKeys(adminId)
  const verdict = await checkRateLimit(keys, { max: REAUTH_MAX_ATTEMPTS })

  if (!verdict.allowed) {
    logSecurityEvent("admin_reauth_rate_limited", {})
    return { status: "error", message: TOO_MANY_ATTEMPTS }
  }

  if (!(await verifyAdminPassword(email, password))) {
    await recordFailedAttempt(keys)
    logSecurityEvent("admin_reauth_failed", {})
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: { currentPassword: ["That password is not correct."] },
    }
  }

  await clearAttempts(keys)
  return null
}

// ─────────────────────────────────────────────────────────────────────
// Name
// ─────────────────────────────────────────────────────────────────────

export async function updateAdminProfileAction(
  _prevState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = adminProfileSchema.safeParse({ displayName: formData.get("displayName") ?? "" })
  if (!parsed.success) return invalid(parsed.error)

  const auth = await authorizeAdmin({ allowTwoFactorSetup: true })
  if (!auth.ok) return { status: "error", message: auth.message }

  const { displayName } = parsed.data
  if (displayName === auth.admin.displayName) {
    return { status: "success", message: "No changes to save." }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminProfile.update({ where: { id: auth.admin.id }, data: { displayName } })
      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "ADMIN_PROFILE_UPDATED",
          entityType: "AdminProfile",
          entityId: auth.admin.id,
          metadata: { changes: [{ field: "Name", from: auth.admin.displayName, to: displayName }] },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[account] failed to update name", error)
    return { status: "error", message: "Could not save your name. Please try again." }
  }

  revalidateAccount()
  return { status: "success", message: "Your name has been updated." }
}

// ─────────────────────────────────────────────────────────────────────
// Email address
// ─────────────────────────────────────────────────────────────────────

/**
 * Starts an email change. Supabase sends confirmation links; the address
 * changes only once they are followed, and /auth/confirm then brings our copy
 * into line (see admin-account.ts).
 */
export async function requestEmailChangeAction(
  _prevState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = emailChangeSchema.safeParse({
    newEmail: formData.get("newEmail") ?? "",
    currentPassword: formData.get("currentPassword") ?? "",
  })
  if (!parsed.success) return invalid(parsed.error)

  const auth = await authorizeAdmin({ allowTwoFactorSetup: true })
  if (!auth.ok) return { status: "error", message: auth.message }

  const { newEmail, currentPassword } = parsed.data

  if (newEmail === auth.admin.email) {
    return { status: "error", message: CHECK_FIELDS, fieldErrors: { newEmail: ["That is already your email address."] } }
  }

  const refusal = await confirmCurrentPassword(auth.admin.id, auth.admin.email, currentPassword)
  if (refusal) return refusal

  const taken = await prisma.adminProfile.findUnique({ where: { email: newEmail }, select: { id: true } })
  if (taken) {
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: { newEmail: ["That address belongs to another administrator account."] },
    }
  }

  const origin = await getEmailLinkOrigin()
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(SECURITY_SETTINGS_PATH)}` }
  )

  if (error) {
    logSecurityEvent("admin_email_change_failed", { reason: error.code ?? "unknown" })
    return {
      status: "error",
      message:
        error.code === "email_exists"
          ? "That address is already used by another account."
          : "Could not start the email change. Please try again.",
    }
  }

  await recordAuditLogBestEffort({
    actorId: auth.admin.id,
    action: "ADMIN_EMAIL_CHANGE_REQUESTED",
    entityType: "AdminProfile",
    entityId: auth.admin.id,
    metadata: { changes: [{ field: "Email", from: auth.admin.email, to: `${newEmail} (awaiting confirmation)` }] },
  })

  return {
    status: "success",
    message: `Confirmation links are on their way. Your email changes to ${newEmail} once the change is confirmed — check both inboxes.`,
  }
}

// ─────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────

/**
 * Signs out every other session. Ended in our own table first, which is what
 * the DAL enforces on the next request from those devices; Supabase then
 * revokes their refresh tokens, so they cannot quietly renew either.
 */
export async function signOutOtherSessionsAction(_prevState: AccountActionState): Promise<AccountActionState> {
  const auth = await authorizeAdmin({ allowTwoFactorSetup: true })
  if (!auth.ok) return { status: "error", message: auth.message }

  let count: number
  try {
    count = await endOtherAdminSessions({
      adminId: auth.admin.id,
      keepAuthSessionId: auth.session.authSessionId,
      reason: AdminSessionEndReason.REVOKED,
    })
  } catch (error) {
    console.error("[account] failed to end other sessions", error)
    return { status: "error", message: "Could not sign out your other sessions. Please try again." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: "others" })
  if (error) {
    // Already refused by the DAL; this only stops their tokens refreshing.
    console.error("[account] Supabase could not revoke other sessions", error.code)
  }

  await recordAuditLogBestEffort({
    actorId: auth.admin.id,
    action: "ADMIN_OTHER_SESSIONS_REVOKED",
    entityType: "AdminProfile",
    entityId: auth.admin.id,
    metadata: { count },
  })

  revalidateAccount()
  return {
    status: "success",
    message: count === 0 ? "You have no other active sessions." : `Signed out of ${count} other session${count === 1 ? "" : "s"}.`,
  }
}

/** Ends one of the caller's other sessions. */
export async function revokeSessionAction(
  _prevState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = sessionIdSchema.safeParse({ sessionId: formData.get("sessionId") ?? "" })
  if (!parsed.success) return { status: "error", message: "That session could not be found." }

  const auth = await authorizeAdmin({ allowTwoFactorSetup: true })
  if (!auth.ok) return { status: "error", message: auth.message }

  if (parsed.data.sessionId === auth.session.id) {
    return { status: "error", message: "That is this device. Use Sign out in your account menu instead." }
  }

  const ended = await endAdminSessionById({
    adminId: auth.admin.id,
    sessionId: parsed.data.sessionId,
    reason: AdminSessionEndReason.REVOKED,
  })

  if (!ended) {
    revalidateAccount()
    return { status: "success", message: "That session had already ended." }
  }

  await recordAuditLogBestEffort({
    actorId: auth.admin.id,
    action: "ADMIN_SESSION_REVOKED",
    entityType: "AdminSession",
    entityId: parsed.data.sessionId,
  })

  revalidateAccount()
  return { status: "success", message: "That session has been signed out." }
}

/** Signs out every session, including this one. */
export async function signOutEverywhereAction(): Promise<void> {
  const auth = await authorizeAdmin({ allowTwoFactorSetup: true })
  if (!auth.ok) redirect(ADMIN_LOGIN_PATH)

  await endAllAdminSessions({ adminId: auth.admin.id, reason: AdminSessionEndReason.REVOKED })

  await recordAuditLogBestEffort({
    actorId: auth.admin.id,
    action: "ADMIN_ALL_SESSIONS_REVOKED",
    entityType: "AdminProfile",
    entityId: auth.admin.id,
  })

  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: "global" })
  if (error) console.error("[account] Supabase could not revoke all sessions", error.code)

  redirect(`${ADMIN_LOGIN_PATH}?notice=signed_out_everywhere`)
}

// ─────────────────────────────────────────────────────────────────────
// Password
// ─────────────────────────────────────────────────────────────────────

/**
 * Changes the password, then ends every session — this one included — the
 * same policy the recovery flow follows (SECURITY.MD §42): nobody stays
 * signed in on a credential that has just been replaced, and the new password
 * is proven at once rather than days later.
 */
export async function changePasswordAction(
  _prevState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    password: formData.get("password") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  })
  if (!parsed.success) return invalid(parsed.error)

  const auth = await authorizeAdmin({ allowTwoFactorSetup: true })
  if (!auth.ok) return { status: "error", message: auth.message }

  const refusal = await confirmCurrentPassword(auth.admin.id, auth.admin.email, parsed.data.currentPassword)
  if (refusal) return refusal

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    // The caller is authenticated, so Supabase's policy message is safe to
    // show — "too weak", "same as the old one".
    return { status: "error", message: error.message, fieldErrors: { password: [error.message] } }
  }

  await recordAuditLogBestEffort({
    actorId: auth.admin.id,
    action: "ADMIN_PASSWORD_CHANGED",
    entityType: "AdminProfile",
    entityId: auth.admin.id,
  })

  try {
    await endAllAdminSessions({ adminId: auth.admin.id, reason: AdminSessionEndReason.PASSWORD_CHANGED })
  } catch (error) {
    // The global sign-out below still revokes every refresh token.
    console.error("[account] failed to end sessions after a password change", error)
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" })
  if (signOutError) console.error("[account] Supabase could not sign out after a password change", signOutError.code)

  redirect(`${ADMIN_LOGIN_PATH}?notice=password_updated`)
}

/** Emails the caller a password-reset link, when recovery is allowed. */
export async function sendPasswordResetLinkAction(_prevState: AccountActionState): Promise<AccountActionState> {
  const auth = await authorizeAdmin({ allowTwoFactorSetup: true })
  if (!auth.ok) return { status: "error", message: auth.message }

  const { security } = await getOperationalSettings()
  if (!security.allowPasswordRecovery) {
    return {
      status: "error",
      message: "Password recovery is turned off in Login & session security, so no reset link can be sent.",
    }
  }

  const verdict = await consumeRateLimit([
    { key: { scope: RATE_LIMIT_SCOPES.passwordResetEmail, identifier: auth.admin.email }, max: PASSWORD_RESET_MAX_ATTEMPTS },
  ])
  if (!verdict.allowed) {
    return { status: "error", message: "Several reset links have been sent recently. Wait 15 minutes and try again." }
  }

  const origin = await getEmailLinkOrigin()
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(auth.admin.email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(`${ADMIN_BASE_PATH}/reset-password`)}`,
  })

  if (error) {
    logSecurityEvent("admin_password_reset_send_failed", { reason: error.code ?? "unknown" })
    return { status: "error", message: "Could not send a reset link just now. Please try again." }
  }

  await recordAuditLogBestEffort({
    actorId: auth.admin.id,
    action: "ADMIN_PASSWORD_RESET_REQUESTED",
    entityType: "AdminProfile",
    entityId: auth.admin.id,
  })

  revalidateAccount()
  return { status: "success", message: `A reset link is on its way to ${auth.admin.email}.` }
}
