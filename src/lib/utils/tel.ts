/**
 * A dialable `tel:` URI from a phone number as it is displayed.
 *
 * Correctness, not a security boundary: the display form carries spaces and
 * punctuation a dialer would choke on. Shared by server and client components,
 * so it lives in a plain module rather than beside either.
 */
export function toTelHref(displayNumber: string): string {
  return `tel:${displayNumber.replace(/[^\d+]/g, "")}`
}
