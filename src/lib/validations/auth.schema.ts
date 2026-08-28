import { z } from "zod"

/**
 * Runtime validation for every authentication input.
 *
 * These schemas are the server's boundary, not the form's convenience.
 * TypeScript types vanish at runtime, and a Server Action compiles to a
 * public POST endpoint that anyone can call with curl — so the shape of
 * whatever arrives is not guaranteed by the UI that normally sends it
 * (Security-files/authentication.md, "Server Actions Are Public Endpoints").
 *
 * Client-side validation is a convenience layer on top of this and never a
 * substitute for it (SECURITY.MD §9).
 */

/**
 * Email, normalised.
 *
 * Trimmed and lowercased because Supabase stores addresses lowercased: a
 * caller typing `Santos@Example.com` must resolve to the same account as
 * `santos@example.com`, and comparing an un-normalised value against
 * AdminProfile.email would produce a spurious "not an administrator".
 *
 * The 254-character cap is the RFC 5321 limit — it exists to stop a
 * megabyte of text reaching the auth provider, not to police addresses.
 */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."))

/**
 * Password rules for sign-IN are deliberately minimal: presence and a sane
 * maximum. Enforcing complexity at the sign-in step tells an attacker which
 * guesses are structurally impossible, which narrows their search for free,
 * and it locks out any existing account whose password predates the rule.
 * Strength is enforced where a password is chosen — see `newPasswordField`.
 *
 * The 72-byte ceiling is bcrypt's: input beyond it is silently ignored by
 * the hash, so accepting more would mean two different passwords could
 * unlock the same account.
 */
const currentPasswordField = z
  .string()
  .min(1, "Enter your password.")
  .max(72, "That password is too long.")

/**
 * Password rules for CHOOSING a password.
 *
 * 12 characters minimum with no composition rules ("must contain a symbol"),
 * which is the current NIST guidance and produces stronger passwords in
 * practice than short-but-fussy requirements: length is the property that
 * actually resists offline cracking, and composition rules mostly produce
 * predictable substitutions.
 *
 * Supabase enforces its own project-level minimum as well. This is the
 * stricter of the two and runs first, so the user gets a specific message
 * from us instead of a generic one from the auth provider.
 */
const newPasswordField = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(72, "Use no more than 72 characters.")

export const signInSchema = z.object({
  email: emailField,
  password: currentPasswordField,
  /**
   * Where to send the administrator after a successful sign-in.
   *
   * Optional, and never trusted: admin-guard's `isSafeReturnPath` re-checks
   * it before any redirect happens. Validating the string here does not make
   * the destination safe — only the path check does.
   */
  next: z.string().max(512).optional(),
})

export type SignInInput = z.infer<typeof signInSchema>

export const passwordResetRequestSchema = z.object({
  email: emailField,
})

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>

export const updatePasswordSchema = z
  .object({
    password: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Both passwords must match.",
    path: ["confirmPassword"],
  })

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>
