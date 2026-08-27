// Builds contextual wa.me deep links
// Security notes:
// - The phone number is sanitized to digits-only before it ever reaches a
//   URL. It comes from an env var an admin controls, so this isn't a
//   defense against a hostile actor — it's a guard against a misconfigured
//   value (stray spaces, dashes, a leading "+") silently producing a
//   broken or malformed wa.me link.
// - The message text is never string-concatenated into the URL. It always
//   goes through URLSearchParams, which percent-encodes it — so a message
//   containing "&", "#", or other URL-meaningful characters can't break out
//   of the query string or inject extra parameters.

const WHATSAPP_BASE_URL = "https://wa.me/"

function sanitizePhoneNumber(rawNumber: string): string {
  return rawNumber.replace(/[^\d]/g, "")
}

export interface BuildWhatsAppUrlOptions {
  /** Raw phone number, e.g. straight from NEXT_PUBLIC_WHATSAPP_NUMBER.
   *  May include a leading "+", spaces, or dashes — stripped automatically. */
  phoneNumber: string
  /** Pre-filled message shown in the WhatsApp chat composer. */
  message?: string
}

/**
 * Returns a `https://wa.me/<number>?text=<encoded>` URL, or `null` if the
 * phone number has no digits left after sanitizing (missing/misconfigured
 * env var). Callers must treat `null` as "don't render the WhatsApp
 * action" rather than linking to a broken wa.me URL.
 */
export function buildWhatsAppUrl({ phoneNumber, message }: BuildWhatsAppUrlOptions): string | null {
  const digitsOnly = sanitizePhoneNumber(phoneNumber)

  if (digitsOnly.length === 0) {
    return null
  }

  const url = new URL(`${WHATSAPP_BASE_URL}${digitsOnly}`)

  if (message && message.trim().length > 0) {
    url.searchParams.set("text", message.trim())
  }

  return url.toString()
}

/** Generic message for contexts with no specific vehicle, part, or order
 *  to reference yet (header/footer/floating button). Vehicle-specific and
 *  part-specific message builders arrive alongside those respective pages
 *  — no need to build them ahead of the content that would use them. */
export function buildGeneralWhatsAppMessage(siteName: string): string {
  return `Hello ${siteName}, I'd like to enquire about a vehicle.`
}