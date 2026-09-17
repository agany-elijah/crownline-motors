"use server"

import { randomBytes } from "node:crypto"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { AdminLoginEventKind } from "@/generated/prisma/enums"
import { logSecurityEvent, recordAuditLog, recordAuditLogBestEffort } from "@/lib/audit"
import { authorizeAdmin } from "@/lib/auth/admin-guard"
import { recordAdminLoginEvent } from "@/lib/auth/admin-sessions"
import { getClientIp } from "@/lib/auth/client-ip"
import { getAdminAccess } from "@/lib/auth/dal"
import {
  RATE_LIMIT_SCOPES,
  TWO_FACTOR_MAX_ATTEMPTS,
  checkRateLimit,
  clearAttempts,
  recordFailedAttempt,
  type RateLimitKey,
} from "@/lib/auth/rate-limit"
import { resolveReturnPath } from "@/lib/auth/return-path"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { prisma } from "@/lib/prisma"
import { getOperationalSettings, getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { createClient } from "@/lib/supabase/server"
import {
  twoFactorCodeSchema,
  twoFactorEnrollmentSchema,
  twoFactorSignInSchema,
} from "@/lib/validations/security.schema"

/**
 * Two-factor authentication with an authenticator app (TOTP).
 *
 * The factor and its secret live in Supabase Auth, never in this database.
 * What lives here is `AdminProfile.twoFactorEnabledAt`, written only after a
 * code has been verified server-side — and that column is what the DAL reads
 * to decide a session must be at AAL2. See dal.ts.
 *
 * Every code check is rate limited: six digits is a million possibilities,
 * which a limit of five attempts per fifteen minutes turns into a search
 * measured in years.
 */

export interface TwoFactorActionState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Record<string, string[]>
}

export interface TwoFactorEnrollmentState {
  status: "idle" | "ready" | "error"
  message?: string
  factorId?: string
  /** An SVG data URL of the QR code, from Supabase. */
  qrCode?: string
  /** The same secret in text, for typing into an app by hand. */
  secret?: string
}

const WRONG_CODE = "That code did not match. Use the newest code in your authenticator app — codes change every 30 seconds."
const TOO_MANY_CODES = "Too many incorrect codes. Wait 15 minutes and try again."

function codeKeys(adminId: string, ip: string | null): RateLimitKey[] {
  const keys: RateLimitKey[] = [{ scope: RATE_LIMIT_SCOPES.twoFactorAdmin, identifier: adminId }]
  if (ip) keys.push({ scope: RATE_LIMIT_SCOPES.twoFactorIp, identifier: ip })
  return keys
}

async function verifiedTotpFactorIds(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string[] | null> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) {
    console.error("[two-factor] could not list factors", error.code)
    return null
  }
  return data.totp.filter((factor) => factor.status === "verified").map((factor) => factor.id)
}

// ─────────────────────────────────────────────────────────────────────
// Setting it up
// ─────────────────────────────────────────────────────────────────────

/**
 * Registers a new authenticator and returns its QR code. Nothing is switched
 * on until `confirmTwoFactorEnrollmentAction` has verified a code from it.
 */
export async function startTwoFactorEnrollmentAction(
  _prevState: TwoFactorEnrollmentState
): Promise<TwoFactorEnrollmentState> {
  const auth = await authorizeAdmin({ allowTwoFactorSetup: true })
  if (!auth.ok) return { status: "error", message: auth.message }

  if (auth.admin.twoFactorEnabled) {
    return { status: "error", message: "Two-factor authentication is already on for your account." }
  }

  const supabase = await createClient()
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()

  if (listError) {
    console.error("[two-factor] could not list factors before enrolment", listError.code)
    return { status: "error", message: "Could not start setup. Please try again." }
  }

  if (factors.totp.some((factor) => factor.status === "verified")) {
    // Our record says off, the provider says on — a write that failed after a
    // verification. Refusing is safer than guessing which is right.
    logSecurityEvent("admin_two_factor_state_mismatch", {})
    return {
      status: "error",
      message:
        "An authenticator is already registered for this account but not recorded here. Ask your technical contact to reset two-factor authentication (npm run admin:reset-2fa).",
    }
  }

  // Abandoned set-ups leave unverified factors behind; clear them so this one
  // is the only candidate.
  for (const factor of factors.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (error) console.error("[two-factor] could not remove an abandoned factor", error.code)
    }
  }

  const { businessName } = await getPublicSiteSettings()
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    // Friendly names must be unique per user; the suffix keeps a retried
    // setup from colliding with one Supabase has not finished removing.
    friendlyName: `${businessName} dashboard ${randomBytes(3).toString("hex")}`,
    issuer: businessName,
  })

  if (error) {
    console.error("[two-factor] enrolment failed", error.code)
    return { status: "error", message: "Could not start setup. Please try again." }
  }

  return { status: "ready", factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function confirmTwoFactorEnrollmentAction(
  _prevState: TwoFactorActionState,
  formData: FormData
): Promise<TwoFactorActionState> {
  const parsed = twoFactorEnrollmentSchema.safeParse({
    factorId: formData.get("factorId") ?? "",
    code: formData.get("code") ?? "",
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the code and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const auth = await authorizeAdmin({ allowTwoFactorSetup: true })
  if (!auth.ok) return { status: "error", message: auth.message }

  if (auth.admin.twoFactorEnabled) {
    return { status: "success", message: "Two-factor authentication is already on." }
  }

  const keys = codeKeys(auth.admin.id, await getClientIp())
  if (!(await checkRateLimit(keys, { max: TWO_FACTOR_MAX_ATTEMPTS })).allowed) {
    return { status: "error", message: TOO_MANY_CODES }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  })

  if (error) {
    await recordFailedAttempt(keys)
    return { status: "error", message: WRONG_CODE, fieldErrors: { code: [WRONG_CODE] } }
  }

  // Verified against this session's own factors, so the id cannot belong to
  // another account — confirmed anyway before anything is switched on.
  const verified = await verifiedTotpFactorIds(supabase)
  if (!verified?.includes(parsed.data.factorId)) {
    return { status: "error", message: "Setup could not be confirmed. Please start again." }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminProfile.updateMany({
        where: { id: auth.admin.id, twoFactorEnabledAt: null },
        data: { twoFactorEnabledAt: new Date() },
      })
      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "ADMIN_TWO_FACTOR_ENABLED",
          entityType: "AdminProfile",
          entityId: auth.admin.id,
        },
        tx
      )
    })
  } catch (error) {
    console.error("[two-factor] failed to record enabled 2FA", error)
    return { status: "error", message: "Your code was accepted but the change could not be saved. Please try again." }
  }

  await clearAttempts(keys)
  revalidatePath(ADMIN_BASE_PATH, "layout")

  return {
    status: "success",
    message: "Two-factor authentication is on. You will be asked for a code from your app each time you sign in.",
  }
}

// ─────────────────────────────────────────────────────────────────────
// Turning it off
// ─────────────────────────────────────────────────────────────────────

/**
 * Removes the authenticator. Needs a current code — possession of the phone,
 * not just of a signed-in browser — and is refused while Settings requires
 * two-factor for everyone. Requires a fully authenticated (AAL2) session.
 */
export async function disableTwoFactorAction(
  _prevState: TwoFactorActionState,
  formData: FormData
): Promise<TwoFactorActionState> {
  const parsed = twoFactorCodeSchema.safeParse({ code: formData.get("code") ?? "" })
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the code and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const auth = await authorizeAdmin()
  if (!auth.ok) return { status: "error", message: auth.message }

  if (!auth.admin.twoFactorEnabled) {
    return { status: "success", message: "Two-factor authentication is already off." }
  }

  const { security } = await getOperationalSettings()
  if (security.requireTwoFactor) {
    return {
      status: "error",
      message: "Two-factor authentication is required for every administrator. Turn off “Require 2FA” in Login & session security first.",
    }
  }

  const keys = codeKeys(auth.admin.id, await getClientIp())
  if (!(await checkRateLimit(keys, { max: TWO_FACTOR_MAX_ATTEMPTS })).allowed) {
    return { status: "error", message: TOO_MANY_CODES }
  }

  const supabase = await createClient()
  const factorIds = await verifiedTotpFactorIds(supabase)
  if (factorIds === null) return { status: "error", message: "Could not reach the authentication service. Please try again." }

  if (factorIds.length > 0) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factorIds[0], code: parsed.data.code })
    if (error) {
      await recordFailedAttempt(keys)
      return { status: "error", message: WRONG_CODE, fieldErrors: { code: [WRONG_CODE] } }
    }

    for (const factorId of factorIds) {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId })
      if (unenrollError) {
        console.error("[two-factor] could not remove the authenticator", unenrollError.code)
        return { status: "error", message: "Could not remove the authenticator. Please try again." }
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminProfile.update({ where: { id: auth.admin.id }, data: { twoFactorEnabledAt: null } })
      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "ADMIN_TWO_FACTOR_DISABLED",
          entityType: "AdminProfile",
          entityId: auth.admin.id,
        },
        tx
      )
    })
  } catch (error) {
    console.error("[two-factor] failed to record disabled 2FA", error)
    return { status: "error", message: "The authenticator was removed but the change could not be saved. Please try again." }
  }

  await clearAttempts(keys)
  revalidatePath(ADMIN_BASE_PATH, "layout")

  return { status: "success", message: "Two-factor authentication is off." }
}

// ─────────────────────────────────────────────────────────────────────
// Signing in
// ─────────────────────────────────────────────────────────────────────

/**
 * The second step of signing in: the password was accepted, and this proves
 * the authenticator. On success the session is upgraded to AAL2 by Supabase,
 * and only then is the sign-in recorded as successful.
 */
export async function verifyTwoFactorSignInAction(
  _prevState: TwoFactorActionState,
  formData: FormData
): Promise<TwoFactorActionState> {
  const parsed = twoFactorSignInSchema.safeParse({
    code: formData.get("code") ?? "",
    next: formData.get("next") ?? undefined,
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter the six-digit code from your authenticator app.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const destination = resolveReturnPath(parsed.data.next)
  const access = await getAdminAccess()

  if (access.status === "OK") redirect(destination)
  if (access.status !== "TWO_FACTOR_REQUIRED") {
    return { status: "error", message: "Your sign-in has expired. Go back and sign in again." }
  }

  const { admin } = access
  const keys = codeKeys(admin.id, await getClientIp())

  if (!(await checkRateLimit(keys, { max: TWO_FACTOR_MAX_ATTEMPTS })).allowed) {
    logSecurityEvent("admin_two_factor_rate_limited", {})
    return { status: "error", message: TOO_MANY_CODES }
  }

  const supabase = await createClient()
  const factorIds = await verifiedTotpFactorIds(supabase)

  if (!factorIds || factorIds.length === 0) {
    logSecurityEvent("admin_two_factor_no_factor", {})
    return {
      status: "error",
      message: "Two-factor authentication is not set up correctly for this account. Contact your technical contact.",
    }
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factorIds[0], code: parsed.data.code })

  if (error) {
    await recordFailedAttempt(keys)
    await recordAdminLoginEvent({ adminId: admin.id, kind: AdminLoginEventKind.TWO_FACTOR_FAILED })
    logSecurityEvent("admin_two_factor_failed", {})
    return { status: "error", message: WRONG_CODE, fieldErrors: { code: [WRONG_CODE] } }
  }

  await clearAttempts(keys)
  await recordAuditLogBestEffort({
    actorId: admin.id,
    action: "ADMIN_SIGNED_IN",
    entityType: "AdminProfile",
    entityId: admin.id,
  })
  await recordAdminLoginEvent({ adminId: admin.id, kind: AdminLoginEventKind.SIGN_IN_SUCCEEDED })

  redirect(destination)
}
