/**
 * Reads what a customer typed into "Track My Order".
 *
 * Customers copy a tracking number out of an email or a WhatsApp message and
 * type it on a phone, so case, spaces and missing hyphens are forgiven —
 * `clm 2026 000125` and `CLM2026000125` both mean `CLM-2026-000125`. Anything
 * that is not the shape of a reference this system issues is refused before
 * it reaches the database.
 *
 * An order number (`CLM-O-2026-000012`) is accepted too, so a customer who
 * only has their order confirmation can still be told whether tracking has
 * started yet.
 *
 * ── Why any prefix is accepted, not only the configured one ───────────
 * The letters before the year are configurable in Settings, and a tracking
 * number keeps the prefix it was issued with. A customer holding a number
 * from before a change must still be able to use it, so the parser accepts
 * the *shape* — 2 to 6 letters, a year, six digits — and the exact-match
 * database lookup decides whether it exists. What is refused is the handful
 * of prefixes other references use, which is also why Settings forbids an
 * operator from choosing one of them.
 */

export type TrackingLookup =
  | { kind: "TRACKING"; value: string }
  | { kind: "ORDER"; value: string }

/**
 * Prefixes that belong to other references once hyphens are dropped:
 * orders (CLM-O), vehicle and part listings (CLM-V, CLM-SP) and quotes
 * (CLM-Q). The database carries the same list in a CHECK constraint.
 */
export const RESERVED_TRACKING_PREFIXES = ["CLMO", "CLMV", "CLMQ", "CLMSP"] as const

/** Longer than any reference we issue, so a pasted paragraph is refused cheaply. */
const MAX_INPUT_LENGTH = 40

export function parseTrackingLookup(raw: string): TrackingLookup | null {
  if (raw.length > MAX_INPUT_LENGTH) return null

  const compact = raw.toUpperCase().replace(/[\s\-_.]/g, "")

  // Checked first: `CLMO…` is an order number, never a tracking prefix.
  const order = /^CLMO(\d{4})(\d{6})$/.exec(compact)
  if (order) {
    return { kind: "ORDER", value: `CLM-O-${order[1]}-${order[2]}` }
  }

  const tracking = /^([A-Z]{2,6})(\d{4})(\d{6})$/.exec(compact)
  if (tracking && !(RESERVED_TRACKING_PREFIXES as readonly string[]).includes(tracking[1])) {
    return { kind: "TRACKING", value: `${tracking[1]}-${tracking[2]}-${tracking[3]}` }
  }

  return null
}

/** An example number in the configured format, for help text. */
export function exampleTrackingNumber(prefix: string, year: number = new Date().getFullYear()): string {
  return `${prefix}-${year}-000125`
}

/** The public page a tracking number opens, e.g. in a customer email. */
export function trackingPagePath(trackingNumber?: string): string {
  return trackingNumber
    ? `/track-my-order?number=${encodeURIComponent(trackingNumber)}`
    : "/track-my-order"
}
