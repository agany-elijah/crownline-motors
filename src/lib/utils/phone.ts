/**
 * Phone numbers, as customers type them and as the business needs them.
 *
 * ── Why numbers are normalised at the door ────────────────────────────
 * Two things downstream depend on a phone number being in one canonical
 * shape, and neither works with what people actually type:
 *
 *   1. Customer deduplication. `Customer.phone` is indexed but deliberately
 *      not unique (see the schema), so every public form must look an
 *      existing customer up by normalised phone before creating one. "0912
 *      345 678", "+211 912-345-678" and "00211912345678" are one person, and
 *      comparing them as typed would file them as three.
 *   2. WhatsApp. A wa.me link needs the full international number in digits.
 *      A South Sudanese customer types the national form with a leading 0,
 *      and wa.me/0912345678 opens a chat with nobody.
 *
 * So the form asks for the country separately, and this module turns
 * (country, typed number) into E.164 — `+211912345678` — once, on the server,
 * before anything is stored.
 *
 * Pure: no React, no server imports. The form and the server action share the
 * dial-code list, and the normalisation is the part worth testing.
 */

export interface DialCode {
  /** ISO 3166-1 alpha-2, used as the option value. */
  country: string
  label: string
  /** Digits only, no plus. */
  code: string
}

/**
 * The markets the brief names, in the order a customer is likely to need
 * them: South Sudan first, then the neighbours listed as future markets
 * (brief §20), then the countries the cars come from — an importer's
 * customers include people buying from abroad for family in Juba.
 *
 * Deliberately short. A two-hundred-entry list is a worse control for the
 * people who will use this form, and anyone elsewhere can type their number
 * in full international form, which `normalizePhoneNumber` accepts from any
 * country.
 */
export const DIAL_CODES: readonly DialCode[] = [
  { country: "SS", label: "South Sudan", code: "211" },
  { country: "UG", label: "Uganda", code: "256" },
  { country: "KE", label: "Kenya", code: "254" },
  { country: "RW", label: "Rwanda", code: "250" },
  { country: "TZ", label: "Tanzania", code: "255" },
  { country: "ET", label: "Ethiopia", code: "251" },
  { country: "SD", label: "Sudan", code: "249" },
  { country: "AE", label: "United Arab Emirates", code: "971" },
  { country: "JP", label: "Japan", code: "81" },
  { country: "KR", label: "South Korea", code: "82" },
] as const

export const DEFAULT_DIAL_COUNTRY = "SS"

export function findDialCode(country: string | null | undefined): DialCode | null {
  return DIAL_CODES.find((entry) => entry.country === country) ?? null
}

/** E.164 allows at most 15 digits including the country code. */
const MAX_E164_DIGITS = 15
/** Shorter than this is a typo, not a phone number anywhere in the region. */
const MIN_E164_DIGITS = 8

/**
 * Turns a typed number into E.164, or null if it cannot be one.
 *
 * Rules, in order:
 *   - Spaces, dashes, dots and brackets are formatting and are dropped.
 *   - A leading "+" or "00" means the customer typed the international form
 *     themselves, and the country select is ignored — that is what lets a
 *     customer anywhere use the form without their country being listed.
 *   - Otherwise the number is national: one leading trunk "0" is removed and
 *     the selected country's code is prefixed.
 *   - A number typed *with* the selected country's code but without the plus
 *     ("211912345678") is recognised rather than prefixed twice.
 *
 * Anything containing letters, or landing outside 8–15 digits, is refused.
 * Refusing is right: a number we cannot reach is worse than asking again.
 */
export function normalizePhoneNumber(
  raw: string,
  country: string = DEFAULT_DIAL_COUNTRY
): string | null {
  const trimmed = raw.trim()

  if (trimmed.length === 0 || trimmed.length > 32) return null

  // Anything other than digits and formatting characters is not a number.
  if (!/^[+\d\s().-]+$/.test(trimmed)) return null

  const compact = trimmed.replace(/[\s().-]/g, "")

  let digits: string

  if (compact.startsWith("+")) {
    digits = compact.slice(1)
  } else if (compact.startsWith("00")) {
    digits = compact.slice(2)
  } else {
    const dial = findDialCode(country)
    if (!dial) return null

    if (compact.startsWith(dial.code) && compact.length - dial.code.length >= 7) {
      digits = compact
    } else {
      digits = `${dial.code}${compact.replace(/^0/, "")}`
    }
  }

  // A "+" anywhere but the front, or nothing left, is not a number.
  if (!/^\d+$/.test(digits)) return null
  if (digits.startsWith("0")) return null
  if (digits.length < MIN_E164_DIGITS || digits.length > MAX_E164_DIGITS) return null

  return `+${digits}`
}

/**
 * An E.164 number grouped for reading: `+211 912 345 678`.
 *
 * Display only — nothing is ever parsed back out of this. The grouping is a
 * readability aid rather than each country's official format, which would
 * need a numbering-plan library for no gain on a form confirmation.
 */
export function formatPhoneForDisplay(e164: string): string {
  if (!e164.startsWith("+")) return e164

  const digits = e164.slice(1)
  const dial = DIAL_CODES.find((entry) => digits.startsWith(entry.code))
  const codeLength = dial ? dial.code.length : Math.min(3, digits.length - 6)

  const code = digits.slice(0, codeLength)
  const rest = digits.slice(codeLength)
  const groups = rest.match(/.{1,3}/g) ?? []

  return `+${code} ${groups.join(" ")}`.trim()
}
