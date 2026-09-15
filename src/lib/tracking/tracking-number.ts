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
 */

export type TrackingLookup =
  | { kind: "TRACKING"; value: string }
  | { kind: "ORDER"; value: string }

/** Longer than any reference we issue, so a pasted paragraph is refused cheaply. */
const MAX_INPUT_LENGTH = 40

export function parseTrackingLookup(raw: string): TrackingLookup | null {
  if (raw.length > MAX_INPUT_LENGTH) return null

  const compact = raw.toUpperCase().replace(/[\s\-_.]/g, "")

  const tracking = /^CLM(\d{4})(\d{6})$/.exec(compact)
  if (tracking) {
    return { kind: "TRACKING", value: `CLM-${tracking[1]}-${tracking[2]}` }
  }

  const order = /^CLMO(\d{4})(\d{6})$/.exec(compact)
  if (order) {
    return { kind: "ORDER", value: `CLM-O-${order[1]}-${order[2]}` }
  }

  return null
}

/** The public page a tracking number opens, e.g. in a customer email. */
export function trackingPagePath(trackingNumber?: string): string {
  return trackingNumber
    ? `/track-my-order?number=${encodeURIComponent(trackingNumber)}`
    : "/track-my-order"
}
