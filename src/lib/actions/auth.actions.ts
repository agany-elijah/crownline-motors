"use server"

import { redirect } from "next/navigation"

import { AdminLoginEventKind, AdminSessionEndReason } from "@/generated/prisma/enums"
import { logSecurityEvent, recordAuditLogBestEffort, redactEmail } from "@/lib/audit"
import {
  currentDeviceLabel,
  endAdminSession,
  endAllAdminSessions,
  recordAdminLoginEvent,
  registerAdminSession,
  sessionIdFromAccessToken,
} from "@/lib/auth/admin-sessions"
import { getClientIp } from "@/lib/auth/client-ip"
import { getSessionUser } from "@/lib/auth/dal"
import { getEmailLinkOrigin } from "@/lib/auth/email-link-origin"
import {
  ADMIN_LOGIN_RATE_LIMITED_MESSAGE,
  PASSWORD_RESET_MAX_ATTEMPTS,
  RATE_LIMIT_SCOPES,
  checkRateLimit,
  clearAttempts,
  consumeRateLimit,
  pruneExpiredAttempts,
  recordFailedAttempt,
  type RateLimitKey,
} from "@/lib/auth/rate-limit"
import {
  ADMIN_LOGIN_PATH,
  ADMIN_TWO_FACTOR_CHALLENGE_PATH,
  resolveReturnPath,
} from "@/lib/auth/return-path"
import { prisma } from "@/lib/prisma"
import { getOperationalSettings } from "@/lib/queries/settings.queries"
import { createClient } from "@/lib/supabase/server"
import {
  passwordResetRequestSchema,
  signInSchema,
  updatePasswordSchema,
} from "@/lib/validations/auth.schema"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

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
  /**
   * The address that was submitted, echoed back.
   *
   * React resets a `<form action={fn}>` to its `defaultValue`s once the
   * action settles — on failure as much as on success — so without this a
   * mistyped password clears the email field too, and every retry starts
   * from an empty form.
   *
   * The password is deliberately *never* echoed. It is a credential; the
   * server has no business handing it back into a page, and clearing it on
   * a failed attempt is the behaviour a browser's password manager and the
   * user both expect.
   */
  email?: string
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
 * The keys one sign-in attempt is counted against.
 *
 * The email is lower-cased and trimmed by the Zod schema before it gets
 * here, so "Admin@Crownline.com" and "admin@crownline.com " land in the same
 * bucket rather than buying an attacker a fresh budget per capitalisation.
 *
 * The IP key is omitted entirely when no address can be read, rather than
 * bucketed under a placeholder — see the note in client-ip.ts. In that state
 * the email counter is the whole limit, which is the correct degradation:
 * still bounded, just not additionally bounded by origin.
 */
async function buildLoginRateLimitKeys(email: string): Promise<RateLimitKey[]> {
  const keys: RateLimitKey[] = [
    { scope: RATE_LIMIT_SCOPES.adminLoginEmail, identifier: email },
  ]

  const ip = await getClientIp()
  if (ip) {
    keys.push({ scope: RATE_LIMIT_SCOPES.adminLoginIp, identifier: ip })
  }

  return keys
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

  const submittedEmail = formData.get("email")

  if (!parsed.success) {
    return {
      error: "Check the details below and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      email: typeof submittedEmail === "string" ? submittedEmail.slice(0, 320) : undefined,
    }
  }

  const { email, password, next } = parsed.data
  const rateLimitKeys = await buildLoginRateLimitKeys(email)

  /**
   * Checked before the credentials are, and that order matters.
   *
   * Verifying the password first would make the endpoint a password oracle
   * that happens to be slow: an attacker could keep testing candidates and
   * simply read the timing or the eventual success, with the limit only
   * deciding how loudly it complained afterwards. Refusing before any
   * credential is examined is what makes the budget mean something.
   *
   * The refusal is deliberately distinguishable from a wrong password, and
   * that is not an enumeration leak: it is keyed on how many attempts this
   * address or host has made, which the attacker already knows, and it tells
   * them nothing about whether the account exists. The trade is worth it —
   * the alternative leaves a locked-out administrator retyping a password
   * that is already correct.
   */
  const verdict = await checkRateLimit(rateLimitKeys)

  if (!verdict.allowed) {
    logSecurityEvent("admin_sign_in_rate_limited", {
      email: redactEmail(email),
      reason: "attempt_limit_reached",
    })

    return { error: ADMIN_LOGIN_RATE_LIMITED_MESSAGE, email }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    // Supabase applies its own per-IP and per-account limiting to this
    // endpoint as well. The counter below is Crownline's own layer: seven
    // attempts per fifteen minutes, per address and per host, with a message
    // the operator can act on. See lib/auth/rate-limit.ts.
    await recordFailedAttempt(rateLimitKeys)
    // Housekeeping rides on the failure path, where one extra statement on
    // an already-failing request is free, and never on the success path.
    await pruneExpiredAttempts()

    // Shown to that administrator under Login & session security. Nothing is
    // recorded for an address that is not an administrator's, and the
    // response below is identical either way, so this reveals nothing.
    const target = await prisma.adminProfile.findUnique({ where: { email }, select: { id: true, isActive: true } })
    if (target?.isActive) {
      await recordAdminLoginEvent({ adminId: target.id, kind: AdminLoginEventKind.SIGN_IN_FAILED })
    }

    logSecurityEvent("admin_sign_in_failed", {
      email: redactEmail(email),
      reason: error?.code ?? "no_user",
    })

    return { error: GENERIC_SIGN_IN_ERROR, email }
  }

  const profile = await prisma.adminProfile.findUnique({
    where: { id: data.user.id },
    select: { id: true, isActive: true, twoFactorEnabledAt: true },
  })

  if (!profile || !profile.isActive) {
    // Valid credentials, but not an active administrator. Destroy the
    // session rather than leaving the caller holding one: an authenticated
    // non-admin session is a foothold, and Wave B will add customer routes
    // that a session obtained this way must not silently reach.
    await supabase.auth.signOut()

    /**
     * Counted as a failure, and the counters are NOT cleared.
     *
     * The credentials were valid, so Supabase is satisfied — but they do not
     * belong to an administrator. That is the signature of a leftover or
     * compromised auth user being probed against the staff entrance, which
     * is exactly the traffic the limit exists to stop. Treating it as a
     * success because the password matched would hand an attacker an
     * unlimited budget on precisely the account worth attacking.
     */
    await recordFailedAttempt(rateLimitKeys)

    logSecurityEvent("admin_sign_in_rejected_not_admin", {
      email: redactEmail(email),
      reason: profile ? "inactive_profile" : "no_admin_profile",
    })

    return { error: GENERIC_SIGN_IN_ERROR, email }
  }

  // A genuine administrator signed in: the earlier failures were this
  // person mistyping, not an attack, so the slate is wiped for both keys.
  // Without this, an admin who fumbles a password six times and then
  // succeeds is one mistake away from a lockout for the rest of the window.
  await clearAttempts(rateLimitKeys)

  // The session is recorded now, so the timeout counts from the password and
  // the session appears in the administrator's list from its first request.
  const authSessionId = data.session ? sessionIdFromAccessToken(data.session.access_token) : null
  if (authSessionId) {
    await registerAdminSession({ adminId: profile.id, authSessionId, deviceLabel: await currentDeviceLabel() })
  }

  // `next` came from a query string the caller controls, so it is re-checked
  // here even though the login page already filtered it. Validating once, at
  // the point of use, is what actually prevents the open redirect.
  const destination = resolveReturnPath(next)

  /**
   * An administrator with two-factor authentication is not signed in yet.
   * Their session is at AAL1, which the DAL refuses for them; the code page
   * upgrades it, and records the sign-in when it does.
   */
  if (profile.twoFactorEnabledAt) {
    redirect(`${ADMIN_TWO_FACTOR_CHALLENGE_PATH}?next=${encodeURIComponent(destination)}`)
  }

  await recordAuditLogBestEffort({
    actorId: profile.id,
    action: "ADMIN_SIGNED_IN",
    entityType: "AdminProfile",
    entityId: profile.id,
  })
  await recordAdminLoginEvent({ adminId: profile.id, kind: AdminLoginEventKind.SIGN_IN_SUCCEEDED })

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
      await recordAdminLoginEvent({ adminId: profile.id, kind: AdminLoginEventKind.SIGNED_OUT })

      if (user.sessionId) {
        try {
          await endAdminSession({
            adminId: profile.id,
            authSessionId: user.sessionId,
            reason: AdminSessionEndReason.SIGNED_OUT,
          })
        } catch (error) {
          // Supabase's sign-out below still revokes the session itself.
          console.error("[auth] failed to record the end of a session", error)
        }
      }
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
  const submittedEmail = formData.get("email")

  const parsed = passwordResetRequestSchema.safeParse({ email: submittedEmail })

  if (!parsed.success) {
    return {
      error: "Check the details below and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      email: typeof submittedEmail === "string" ? submittedEmail.slice(0, 320) : undefined,
    }
  }

  const { email } = parsed.data
  const genericNotice =
    "If that address belongs to an administrator account, a password reset link is on its way."

  /**
   * Throttled per address and per host, and counted on every request.
   *
   * Each accepted request makes Supabase send a real email. Unthrottled,
   * this form is a way to flood a staff inbox from anywhere, and to exhaust
   * the project's hourly email allowance so that a genuine reset cannot be
   * sent when it is needed.
   *
   * The refusal is the *same* generic notice, not a "too many requests"
   * message. Unlike sign-in, the person on the other end gains nothing from
   * knowing — they cannot retry their way to a result — and an identical
   * response keeps the throttle from becoming a second way to tell staff
   * addresses from strangers'. Every address is counted, known or not, for
   * the same reason.
   */
  const resetKeys: RateLimitKey[] = [
    { scope: RATE_LIMIT_SCOPES.passwordResetEmail, identifier: email },
  ]
  const resetIp = await getClientIp()
  if (resetIp) {
    resetKeys.push({ scope: RATE_LIMIT_SCOPES.passwordResetIp, identifier: resetIp })
  }

  const resetVerdict = await consumeRateLimit(
    resetKeys.map((key) => ({ key, max: PASSWORD_RESET_MAX_ATTEMPTS }))
  )

  if (!resetVerdict.allowed) {
    logSecurityEvent("admin_password_reset_rate_limited", {
      email: redactEmail(email),
    })

    return { notice: genericNotice }
  }

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

  /**
   * Settings → Login & session security → "Allow password recovery", off.
   * The same notice again: whether recovery is on is not something to
   * confirm to whoever is typing addresses into this form.
   */
  if (!(await getOperationalSettings()).security.allowPasswordRecovery) {
    logSecurityEvent("admin_password_reset_disabled", { email: redactEmail(email) })
    return { notice: genericNotice }
  }

  const origin = await getEmailLinkOrigin()
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Supabase sends a one-time token to this URL; /auth/confirm exchanges
    // it for a recovery session and then forwards to the form below.
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(`${ADMIN_BASE_PATH}/reset-password`)}`,
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
  try {
    await endAllAdminSessions({ adminId: profile.id, reason: AdminSessionEndReason.PASSWORD_CHANGED })
  } catch (error) {
    // The global sign-out below still revokes every refresh token.
    console.error("[auth] failed to end sessions after a password reset", error)
  }

  await supabase.auth.signOut({ scope: "global" })

  // The notice is why this is not a mysterious bounce back to the login
  // form: the page explains what happened and what to do next.
  redirect(`${ADMIN_LOGIN_PATH}?notice=password_updated`)
}
