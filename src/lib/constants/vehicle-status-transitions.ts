import { VehicleStatus } from "@/generated/prisma/enums"

/**
 * Which status a vehicle may move to, from where.
 *
 * ── Why this lives in its own module ──────────────────────────────────
 * It used to live inside `vehicle-status-control.tsx`, which is a
 * `"use client"` component — so the rule shipped to the browser and nowhere
 * else. The Server Action accepted any status from any status, and a crafted
 * POST (or a stale tab, or a future API caller) could move a SOLD vehicle
 * back to PUBLISHED and put a car someone has already paid a deposit on back
 * on the public marketplace.
 *
 * CLAUDE.md rule 8 and SECURITY.MD §6.2 both say the same thing: a control
 * that only exists in the UI is not a control. So the matrix lives here —
 * pure data, no `server-only` marker, no Next.js import — and both sides
 * read it: the client to decide which buttons to render, the action to
 * decide whether to write. One definition, so they cannot drift.
 *
 * ── Why it is not a strict state machine ──────────────────────────────
 * An importer's reality is messier than a diagram. A sale falls through
 * often enough that RESERVED must be able to return to PUBLISHED, and a
 * listing withdrawn in error must be recoverable. What this prevents is the
 * transitions that are always mistakes: re-drafting or re-publishing a sold
 * vehicle, and moving an archived one straight back to live without a
 * deliberate pass through DRAFT — where its price and photographs get
 * checked before customers see them again.
 *
 * ── What this enum is not ─────────────────────────────────────────────
 * It is the state of a *listing*, never the position of a car on its way to
 * Juba. IN_TRANSIT and DELIVERED belong to `TrackingStatus`, on
 * Shipment/TrackingEvent, and are recorded as tracking events by the
 * operations side — see the note on `enum VehicleStatus` in
 * prisma/schema.prisma. A vehicle that is shipping is SOLD here; adding a
 * shipping state to this table would give the marketplace card and the
 * customer's tracking page two separate answers to "where is my car".
 *
 * ── Wave B / Phase 11 note ────────────────────────────────────────────
 * Once orders exist, SOLD stops being a label an operator applies and
 * becomes a consequence of a confirmed payment. The transitions *out* of
 * SOLD are deliberately narrow now so that tightening them further later is
 * a change to this table alone.
 */
export const ALLOWED_VEHICLE_TRANSITIONS: Record<
  VehicleStatus,
  readonly VehicleStatus[]
> = {
  DRAFT: [VehicleStatus.PUBLISHED, VehicleStatus.ARCHIVED],
  PUBLISHED: [VehicleStatus.RESERVED, VehicleStatus.SOLD, VehicleStatus.ARCHIVED],
  RESERVED: [VehicleStatus.PUBLISHED, VehicleStatus.SOLD, VehicleStatus.ARCHIVED],
  SOLD: [VehicleStatus.ARCHIVED],
  // Back to draft, never straight to live: an archived listing has usually
  // been away long enough that its price and photographs want checking.
  ARCHIVED: [VehicleStatus.DRAFT],
}

/**
 * May this vehicle move from `from` to `to`?
 *
 * A move to the status it already holds returns false. That is not the same
 * as "forbidden" and callers must not report it as such — the action treats
 * it as a no-op (most often a double submit) and says nothing, rather than
 * writing a second audit row claiming a change that did not happen.
 */
export function canTransitionVehicleStatus(
  from: VehicleStatus,
  to: VehicleStatus
): boolean {
  return ALLOWED_VEHICLE_TRANSITIONS[from].includes(to)
}

/**
 * The message shown when a transition is refused.
 *
 * Names both states rather than saying "invalid status". The only people who
 * can reach this are administrators, and the two situations that produce it
 * — a stale tab whose buttons predate someone else's change, and a crafted
 * request — are both better served by being told what the vehicle's status
 * actually is now.
 */
export function describeRefusedTransition(
  from: VehicleStatus,
  to: VehicleStatus
): string {
  return `This vehicle is ${from.toLowerCase()} and cannot be moved straight to ${to.toLowerCase()}. Reload the page to see the actions available now.`
}
