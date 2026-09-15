import { MilestoneStatus, ShipmentType, TrackingStatus } from "@/generated/prisma/enums"
import { trackingTimelineFor } from "@/lib/constants/tracking-status"

/**
 * The rules that tie a shipment's journey to the order behind it.
 *
 * Pure, so they are unit-tested (tests/unit/journey-rules.test.ts) rather
 * than trusted; `journey-sync.ts` applies them inside the transaction that
 * records or voids a tracking event.
 *
 * ── Positions are timeline positions, not exact statuses ──────────────
 * An operator does not always record every step. A car can be logged at
 * "Clearing" without anyone having recorded "Arrived at Mombasa" first, and
 * the Mombasa payment is still owed — the car is plainly past Mombasa. So a
 * payment stage opens once the journey has reached its trigger *or any later
 * step*, and closes again only if a correction moves the journey back before
 * it.
 */

/** Where a status sits on its shipment's timeline, or -1 if it is not on it. */
export function timelineIndex(type: ShipmentType, status: TrackingStatus): number {
  return trackingTimelineFor(type).indexOf(status)
}

export interface JourneyStage {
  id: string
  status: MilestoneStatus
  triggerStatus: TrackingStatus | null
}

/**
 * Stages still PENDING whose trigger the journey has now reached or passed.
 * A stage paid early is not PENDING, so it is never reopened as owed.
 */
export function stagesToOpen(
  stages: readonly JourneyStage[],
  type: ShipmentType,
  current: TrackingStatus | null
): string[] {
  if (current === null) return []

  const reached = timelineIndex(type, current)
  if (reached < 0) return []

  return stages
    .filter((stage) => {
      if (stage.status !== MilestoneStatus.PENDING || stage.triggerStatus === null) return false
      const trigger = timelineIndex(type, stage.triggerStatus)
      return trigger >= 0 && trigger <= reached
    })
    .map((stage) => stage.id)
}

/**
 * Stages a tracking trigger made DUE whose trigger the journey no longer
 * reaches — after a mistaken event is voided. Only DUE stages close: one
 * with money against it (PARTIALLY_PAID, PAID) keeps its status, because the
 * payment is real whatever happened to the event.
 */
export function stagesToClose(
  stages: readonly JourneyStage[],
  type: ShipmentType,
  current: TrackingStatus | null
): string[] {
  const reached = current === null ? -1 : timelineIndex(type, current)

  return stages
    .filter((stage) => {
      if (stage.status !== MilestoneStatus.DUE || stage.triggerStatus === null) return false
      const trigger = timelineIndex(type, stage.triggerStatus)
      return trigger >= 0 && trigger > reached
    })
    .map((stage) => stage.id)
}

/**
 * The first step that may only be recorded on an order paid in full.
 *
 * A vehicle is handed over only once 100% of the agreed price is paid (the
 * payment policy's final 25% is due *before release*) — "Ready for
 * collection" is what makes that final payment due, so it cannot itself
 * require it. A parts order is paid in full before it is packed.
 */
const FULL_PAYMENT_REQUIRED_FROM: Record<ShipmentType, TrackingStatus> = {
  VEHICLE: TrackingStatus.DELIVERED,
  SPARE_PART: TrackingStatus.PACKED,
}

export function requiresFullPayment(type: ShipmentType, status: TrackingStatus): boolean {
  const at = timelineIndex(type, status)
  return at >= 0 && at >= timelineIndex(type, FULL_PAYMENT_REQUIRED_FROM[type])
}

export interface JourneyEvent {
  id: string
  status: TrackingStatus
  location: string | null
  eventDate: Date
  createdAt: Date
}

export interface JourneyPosition {
  /** The event the shipment's current status comes from. */
  eventId: string
  status: TrackingStatus
  /** The most recent location recorded on any live event. */
  location: string | null
}

/**
 * Where a shipment is, from its live (non-voided) events: the latest by the
 * date it happened, ties broken by the order they were entered. Null when no
 * live event remains.
 *
 * Latest by `eventDate`, not by insertion: an operator backdating an update
 * that happened offline yesterday is filling in history, not announcing
 * where the car is now.
 */
export function currentPosition(events: readonly JourneyEvent[]): JourneyPosition | null {
  if (events.length === 0) return null

  const ordered = [...events].sort(
    (a, b) => b.eventDate.getTime() - a.eventDate.getTime() || b.createdAt.getTime() - a.createdAt.getTime()
  )
  const latest = ordered[0]

  return {
    eventId: latest.id,
    status: latest.status,
    location: ordered.find((event) => event.location)?.location ?? null,
  }
}
