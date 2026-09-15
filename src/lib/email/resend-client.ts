import "server-only"

import { Resend } from "resend"

/**
 * The one place `RESEND_API_KEY` is read.
 *
 * ── Why lazy and nullable, not a module-level throw ────────────────────
 * This project has no domain yet (see `.env.example`), so during early
 * development the key is legitimately absent. A module that throws at
 * import time would take down every page that transitively imports it;
 * returning `null` instead lets `sendQuoteEmail` fail with one clear,
 * actionable message the operator sees in the dispatch dialog; WhatsApp
 * dispatch is entirely unaffected either way, since it never touches this
 * module.
 */
let cachedClient: Resend | null | undefined

export function getResendClient(): Resend | null {
  if (cachedClient !== undefined) return cachedClient

  const apiKey = process.env.RESEND_API_KEY
  cachedClient = apiKey && apiKey.trim().length > 0 ? new Resend(apiKey.trim()) : null

  return cachedClient
}

export function isEmailSendingConfigured(): boolean {
  return getResendClient() !== null
}

/**
 * The verified sender identity. Falls back to Resend's shared sandbox
 * sender, `onboarding@resend.dev`, which sends without a verified domain —
 * the option for a business (like this one) that has not registered a
 * domain yet. Once a domain is verified in the Resend dashboard, setting
 * `EMAIL_FROM_ADDRESS` is the only change needed; nothing here or in the
 * calling code changes.
 */
export function getEmailFromAddress(): string {
  const value = process.env.EMAIL_FROM_ADDRESS
  return value && value.trim().length > 0 ? value.trim() : "Crownline Motors <onboarding@resend.dev>"
}
