import { z } from "zod"

import { SESSION_TIMEOUT_OPTIONS } from "@/lib/constants/security-options"

/**
 * Validation for the administrator's own account and the security controls.
 */

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter an email address.")
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."))

/** The current password is never checked for shape beyond "present" — the proof is Supabase's. */
const currentPasswordField = z.string().min(1, "Enter your current password.").max(72, "That password is too long.")

/** Matches the recovery flow's rule in auth.schema.ts. */
const newPasswordField = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(72, "Use no more than 72 characters.")

const formSwitch = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean())

export const adminProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(80, "Keep your name under 80 characters."),
})

export const emailChangeSchema = z.object({
  newEmail: emailField,
  currentPassword: currentPasswordField,
})

export const changePasswordSchema = z
  .object({
    currentPassword: currentPasswordField,
    password: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Both new passwords must match.",
    path: ["confirmPassword"],
  })
  .refine((values) => values.password !== values.currentPassword, {
    message: "Choose a password different from your current one.",
    path: ["password"],
  })

/**
 * A six-digit authenticator code. Spaces are removed first, because
 * authenticator apps display the code as "123 456" and people type what they
 * see.
 */
export const totpCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Enter the six-digit code from your authenticator app."))

export const twoFactorCodeSchema = z.object({ code: totpCodeSchema })

export const twoFactorEnrollmentSchema = z.object({
  // Supabase factor ids are UUIDs; the bound only stops a pasted essay.
  factorId: z.string().trim().min(1).max(64),
  code: totpCodeSchema,
})

export const twoFactorSignInSchema = z.object({
  code: totpCodeSchema,
  next: z.string().max(512).optional(),
})

export const sessionIdSchema = z.object({
  sessionId: z.string().trim().min(1).max(64),
})

export const securityControlsSchema = z.object({
  requireTwoFactor: formSwitch,
  allowPasswordRecovery: formSwitch,
  sessionTimeoutHours: z.coerce
    .number({ error: "Choose a session timeout." })
    .refine((hours) => SESSION_TIMEOUT_OPTIONS.some((option) => option.hours === hours), {
      message: "Choose a session timeout from the list.",
    }),
})

export type SecurityControlsInput = z.infer<typeof securityControlsSchema>
