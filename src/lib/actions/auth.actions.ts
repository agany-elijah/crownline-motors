"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { logSecurityEvent, recordAuditLogBestEffort, redactEmail } from "@/lib/audit"
import { getSessionUser } from "@/lib/auth/dal"
import {
  ADMIN_LOGIN_PATH,
  resolveReturnPath,
} from "@/lib/auth/return-path"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { siteConfig } from "@/config/site"
import {
  passwordResetRequestSchema,
  signInSchema,
  updatePasswordSchema,
} from "@/lib/validations/auth.schema"

/**
 * Authentication actions for the administrator dashboard.
 *
 * Every action follows the same three-step opening required by
 * Security-files/authentication.md — validate input, establish identity,
 * check authorisation — because a Server Action is a public POST endpoint
 * that anyone can invoke directly, with no form and no browser involved.
 *
 * Customer authentication (Wave B) will add its own actions alongside these
 * rather than parameterising them: an admin sign-in that silently accepts a
 * customer, or vice versa, is precisely the confusion that produces
 * privilege escalation.
 */

/** Shape returned to `useActionState` in the forms. */
export interface AuthFormState {
  /** Message shown above the form. Always safe to display to an anonymous caller. */
  error?: string
  /** Per-field validation messages, keyed by field name. */
  fieldErrors?: Record<string, string[]>
  /** Non-error confirmation, used by the password-reset request form. */
  notice?: string
}

/**
 * One message for every sign-in failure, whatever the cause.
 *
 * Wrong password, unknown address, unconfirmed email, an auth user who was
 * never made an administrator, a deactivated administrator — all identical
 * from outside. Distinguishing them would let anyone with the public
 * publishable key enumerate which addresses hold staff accounts, which is
 * the first step of a targeted phishing or credential-stuffing campaign
 * (SECURITY.MD §5.4, §36).
 */
const GENERIC_SIGN_IN_ERROR =
  "Those details did not match an active administrator account."

/**
 * Absolute origin for links embedded in authentication emails.
 *
 * NEXT_PUBLIC_SITE_URL wins whenever it is set, and in production it is the
 * only accepted source. Deriving the origin from the request's Host header
 * in production would allow password-reset poisoning: an attacker sends a
 * reset request with a forged Host, and the victim receives a genuine
 * Supabase email whose link points at the attacker's domain, carrying a
 * live recovery token.
 *
 * The header fallback exists so the flow is testable in a Codespace or on
 * localhost, where no fixed public URL exists. Supabase's redirect
 * allow-list remains the backstop in both cases.
 */
async function getEmailLinkOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
  }

  if (process.env.NODE_ENV === "production") {
    // Falling back to the Host header here is the vulnerability described
    // above, so refuse instead. A missing NEXT_PUBLIC_SITE_URL in
    // production is a deployment misconfiguration, not a runtime condition
    // to paper over.
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set in production — authentication email links cannot be built from request headers."
    )
  }

  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const protocol = headerList.get("x-forwarded-proto") ?? "http"

  return host ? `${protocol}://${host}` : siteConfig.url.replace(/\/$/, "")
}

/**
 * Signs an administrator in with email and password.
 *
 * Authenticating with Supabase is only half the check. Supabase answers
 * "are these credentials valid for some user in this project?" — it cannot
 * answer "is this person staff at Crownline Motors?", because that lives in
 * our own AdminProfile table. So a successful password check is followed by
 * a mandatory profile lookup, and a session that fails it is torn down
 * immediately rather than left in the cookie jar for the DAL to reject on
 * every subsequent request.
 *
 * Self-signup is disabled in the Supabase dashboard, which is what stops
 * strangers creating accounts at all. This check is the second layer: it is
 * what keeps the dashboard closed if that setting is ever flipped back.
 */
export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  })

  if (!parsed.success) {
    return {
      error: "Check the details below and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { email, password, next } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    // Supabase applies its own per-IP and per-account rate limiting to this
    // endpoint, which is the brute-force control for Wave A (SECURITY.MD
    // §5.5). Application-level limiting arrives with Upstash in Phase 2
    // rather than being bolted on here; the roadmap defers that
    // infrastructure deliberately.
    logSecurityEvent("admin_sign_in_failed", {
      email: redactEmail(email),
      reason: error?.code ?? "no_user",
    })

    return { error: GENERIC_SIGN_IN_ERROR }
  }

  const profile = await prisma.adminProfile.findUnique({
    where: { id: data.user.id },
    select: { id: true, isActive: true },
  })

  if (!profile || !profile.isActive) {
    // Valid credentials, but not an active administrator. Destroy the
    // session rather than leaving the caller holding one: an authenticated
    // non-admin session is a foothold, and Wave B will add customer routes
    // that a session obtained this way must not silently reach.
    await supabase.auth.signOut()

    logSecurityEvent("admin_sign_in_rejected_not_admin", {
      email: redactEmail(email),
      reason: profile ? "inactive_profile" : "no_admin_profile",
    })

    return { error: GENERIC_SIGN_IN_ERROR }
  }

  await recordAuditLogBestEffort({
    actorId: profile.id,
    action: "ADMIN_SIGNED_IN",
    entityType: "AdminProfile",
    entityId: profile.id,
  })

  // `next` came from a query string the caller controls, so it is re-checked
  // here even though the login page already filtered it. Validating once, at
  // the point of use, is what actually prevents the open redirect.
  const destination = resolveReturnPath(next)

  // Outside the try/catch above on purpose: redirect() signals by throwing,
  // and catching it would turn a successful sign-in into a swallowed error.
  redirect(destination)
}

/** Signs the current administrator out and returns them to the login page. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  const user = await getSessionUser()

  if (user) {
    const profile = await prisma.adminProfile.findUnique({
      where: { id: user.id },
      select: { id: true },
    })

    if (profile) {
      await recordAuditLogBestEffort({
        actorId: profile.id,
        action: "ADMIN_SIGNED_OUT",
        entityType: "AdminProfile",
        entityId: profile.id,
      })
    }
  }

  // "local" revokes this session only. "global" would sign the admin out of
  // every device, which is the right response to a suspected compromise but
  // the wrong default for someone closing a laptop lid at the office.
  await supabase.auth.signOut({ scope: "local" })

  redirect(ADMIN_LOGIN_PATH)
}

/**
 * Sends a password-reset email — but only to an address that belongs to an
 * active administrator.
 *
 * The response is identical either way. Confirming that an address does or
 * does not receive a reset email is account enumeration by another route,
 * and §43 requires recovery to be designed as carefully as login.
 */
export async function requestPasswordResetAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  })

  if (!parsed.success) {
    return {
      error: "Check the details below and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { email } = parsed.data
  const genericNotice =
    "If that address belongs to an administrator account, a password reset link is on its way."

  const profile = await prisma.adminProfile.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  })

  if (!profile || !profile.isActive) {
    logSecurityEvent("admin_password_reset_ignored", {
      email: redactEmail(email),
      reason: profile ? "inactive_profile" : "no_admin_profile",
    })

    // Same message, same shape, no timing games worth playing at this scale.
    return { notice: genericNotice }
  }

  const origin = await getEmailLinkOrigin()
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Supabase sends a one-time token to this URL; /auth/confirm exchanges
    // it for a recovery session and then forwards to the form below.
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/admin/reset-password")}`,
  })

  if (error) {
    logSecurityEvent("admin_password_reset_send_failed", {
      email: redactEmail(email),
      reason: error.code ?? "unknown",
    })

    // Still the generic notice. A "we could not send that email" response
    // distinguishes a real administrator address from an unknown one just
    // as effectively as a success message would.
    return { notice: genericNotice }
  }

  await recordAuditLogBestEffort({
    actorId: profile.id,
    action: "ADMIN_PASSWORD_RESET_REQUESTED",
    entityType: "AdminProfile",
    entityId: profile.id,
  })

  return { notice: genericNotice }
}

/**
 * Sets a new password for the administrator holding the current recovery
 * session.
 *
 * Reachable only with a session, which in this flow comes from a one-time
 * recovery token that /auth/confirm has already exchanged. The admin-profile
 * check is repeated rather than assumed: this action is a public endpoint
 * like any other, and a session obtained by some other means must not be
 * able to set a staff password.
 */
export async function updatePasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  })

  if (!parsed.success) {
    return {
      error: "Check the details below and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const user = await getSessionUser()

  if (!user) {
    return {
      error: "That password reset link has expired. Request a new one and try again.",
    }
  }

  const supabase = await createClient()

  const profile = await prisma.adminProfile.findUnique({
    where: { id: user.id },
    select: { id: true, isActive: true },
  })

  if (!profile || !profile.isActive) {
    await supabase.auth.signOut()

    logSecurityEvent("admin_password_update_rejected", {
      reason: profile ? "inactive_profile" : "no_admin_profile",
    })

    return { error: "That password reset link is no longer valid." }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    // Supabase rejects passwords that fail its own project-level policy or
    // that match the current one. Its message is safe to surface here — the
    // caller is already authenticated, so there is nothing left to enumerate.
    return { error: error.message }
  }

  await recordAuditLogBestEffort({
    actorId: profile.id,
    action: "ADMIN_PASSWORD_CHANGED",
    entityType: "AdminProfile",
    entityId: profile.id,
  })

  /**
   * Every session ends here, including this one.
   *
   * SECURITY.MD §42 requires session invalidation after a sensitive account
   * change, and a password change is the definitive example. `scope:
   * "global"` revokes the refresh tokens for every device and clears the
   * cookie in this browser too.
   *
   * Keeping the current session alive — the obvious, friendlier choice —
   * has two problems. It leaves the administrator authenticated on a
   * credential they have just replaced, which is precisely the state §42
   * exists to end; and it means nobody ever finds out whether the new
   * password actually works until the next time they sign in, possibly days
   * later, possibly on a different machine.
   *
   * The cost is one extra sign-in immediately after a reset. That is a fair
   * price, and it is the moment the person is most prepared to pay it.
   */
  await supabase.auth.signOut({ scope: "global" })

  // The notice is why this is not a mysterious bounce back to the login
  // form: the page explains what happened and what to do next.
  redirect(`${ADMIN_LOGIN_PATH}?notice=password_updated`)
}
