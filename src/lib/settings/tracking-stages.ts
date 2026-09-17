import { ShipmentType, TrackingStatus } from "@/generated/prisma/enums"
import {
  SPARE_PART_TRACKING_TIMELINE,
  TRACKING_STATUS_LABELS,
  VEHICLE_TRACKING_TIMELINE,
} from "@/lib/constants/tracking-status"

/**
 * The tracking stages an operator can configure: what each is called, what
 * it tells the customer, whether it is offered, and where it sits.
 *
 * ── The constraint that shapes all of it ──────────────────────────────
 * The timeline's order is not decoration. It is how the order lifecycle
 * decides that a payment is due and that a vehicle may be released:
 *
 *   - the Mombasa payment opens once the journey reaches ARRIVED_AT_MOMBASA
 *     *or any later step*, and the final payment at READY_FOR_COLLECTION;
 *   - DELIVERED (vehicle) and PACKED onwards (parts) require the order to
 *     be paid in full;
 *   - DELIVERED completes the order, and every shipment opens at PURCHASED
 *     or ORDER_CONFIRMED.
 *
 * Free reordering would let a settings screen quietly rewrite those rules —
 * move "Clearing" before "Arrived at Mombasa" and recording it would stop
 * opening the Mombasa payment.
 *
 * So those stages are **anchors**: fixed in place and always enabled. The
 * stages *between* two anchors can be renamed, described, hidden and
 * reordered freely, but never moved past an anchor. Every rule above
 * compares a stage's position with an anchor's, and a reorder that keeps
 * each stage between the same two anchors cannot change the answer to any
 * such comparison. That is why `journey-rules.ts` keeps reading the
 * canonical timeline and needs no knowledge of this file — and
 * tests/unit/tracking-stages.test.ts proves the invariance rather than
 * asserting it.
 *
 * ── Disabled stages ───────────────────────────────────────────────────
 * Hiding a stage stops operators recording it and hides it from a
 * customer's timeline *until it is reached*. It never removes the status
 * from the rules' timeline, so a shipment already sitting on a stage that is
 * later hidden keeps its position, its payment stages and its history.
 */

export const TRACKING_STAGE_ANCHORS: Record<ShipmentType, readonly TrackingStatus[]> = {
  VEHICLE: [
    TrackingStatus.PURCHASED,
    TrackingStatus.ARRIVED_AT_MOMBASA,
    TrackingStatus.READY_FOR_COLLECTION,
    TrackingStatus.DELIVERED,
  ],
  SPARE_PART: [TrackingStatus.ORDER_CONFIRMED, TrackingStatus.PACKED, TrackingStatus.DELIVERED],
}

/** Why an anchor is fixed, in the operator's terms. */
export const TRACKING_ANCHOR_REASONS: Partial<Record<TrackingStatus, string>> = {
  PURCHASED: "Every vehicle shipment starts here.",
  ARRIVED_AT_MOMBASA: "Makes the Mombasa payment due.",
  READY_FOR_COLLECTION: "Makes the final payment due.",
  DELIVERED: "Completes the order, and needs payment in full.",
  ORDER_CONFIRMED: "Every parts shipment starts here.",
  PACKED: "Needs payment in full from this step on.",
}

export const TRACKING_STAGE_LABEL_MAX = 40
export const TRACKING_STAGE_DESCRIPTION_MAX = 160

const DEFAULT_DESCRIPTIONS: Record<ShipmentType, Partial<Record<TrackingStatus, string>>> = {
  VEHICLE: {
    PURCHASED: "Your vehicle has been secured for you at source.",
    INSPECTION_COMPLETED: "The vehicle's condition and documents have been checked.",
    EXPORT_DOCUMENTATION: "Export paperwork is being prepared.",
    EXPORTED: "The vehicle has cleared export and is at the port.",
    LOADED_FOR_SHIPPING: "The vehicle is loaded on board.",
    IN_TRANSIT: "The vehicle is at sea on its way to Mombasa.",
    ARRIVED_AT_MOMBASA: "The vehicle has arrived at the port of Mombasa.",
    CLEARING: "The vehicle is going through port and customs clearance.",
    TRANSPORT_TO_SOUTH_SUDAN: "The vehicle is on the road to South Sudan.",
    READY_FOR_COLLECTION: "Your vehicle is ready to be collected or delivered.",
    DELIVERED: "Your vehicle has been handed over.",
  },
  SPARE_PART: {
    ORDER_CONFIRMED: "Your order is confirmed.",
    PROCESSING: "We are preparing your parts.",
    PACKED: "Your parts are packed and ready to leave.",
    DISPATCHED: "Your parts have left our warehouse.",
    IN_TRANSIT: "Your parts are on their way.",
    OUT_FOR_DELIVERY: "Your parts are out for delivery.",
    DELIVERED: "Your parts have been delivered.",
  },
}

export interface TrackingStageSetting {
  status: TrackingStatus
  label: string
  description: string
  enabled: boolean
}

export type TrackingStageConfig = Record<ShipmentType, TrackingStageSetting[]>

export interface ResolvedTrackingStage extends TrackingStageSetting {
  anchor: boolean
}

export function canonicalTimeline(type: ShipmentType): readonly TrackingStatus[] {
  return type === ShipmentType.VEHICLE ? VEHICLE_TRACKING_TIMELINE : SPARE_PART_TRACKING_TIMELINE
}

export function isTrackingAnchor(type: ShipmentType, status: TrackingStatus): boolean {
  return TRACKING_STAGE_ANCHORS[type].includes(status)
}

export function defaultTrackingStages(type: ShipmentType): TrackingStageSetting[] {
  return canonicalTimeline(type).map((status) => ({
    status,
    label: TRACKING_STATUS_LABELS[status],
    description: DEFAULT_DESCRIPTIONS[type][status] ?? "",
    enabled: true,
  }))
}

export function defaultTrackingStageConfig(): TrackingStageConfig {
  return {
    VEHICLE: defaultTrackingStages(ShipmentType.VEHICLE),
    SPARE_PART: defaultTrackingStages(ShipmentType.SPARE_PART),
  }
}

/** The anchor a status sits after on the canonical timeline, or null before the first. */
function canonicalPrecedingAnchor(type: ShipmentType, status: TrackingStatus): TrackingStatus | null {
  const timeline = canonicalTimeline(type)
  let preceding: TrackingStatus | null = null

  for (const candidate of timeline) {
    if (candidate === status) return isTrackingAnchor(type, status) ? status : preceding
    if (isTrackingAnchor(type, candidate)) preceding = candidate
  }

  return null
}

/**
 * Why a configured order is not acceptable, or null when it is.
 *
 * Accepts exactly the orders described in the module note: a permutation of
 * the canonical timeline in which every anchor is enabled, the anchors keep
 * their canonical order, and every other stage sits after the same anchor it
 * follows canonically.
 */
export function trackingStagesProblem(
  type: ShipmentType,
  stages: readonly TrackingStageSetting[]
): string | null {
  const canonical = canonicalTimeline(type)
  const statuses = stages.map((stage) => stage.status)

  if (statuses.length !== canonical.length || new Set(statuses).size !== canonical.length) {
    return "Every stage must appear exactly once."
  }

  if (statuses.some((status) => !canonical.includes(status))) {
    return "A stage does not belong to this timeline."
  }

  let precedingAnchor: TrackingStatus | null = null

  for (const stage of stages) {
    const anchor = isTrackingAnchor(type, stage.status)

    if (anchor && !stage.enabled) {
      return `“${TRACKING_STATUS_LABELS[stage.status]}” cannot be turned off. ${TRACKING_ANCHOR_REASONS[stage.status] ?? ""}`.trim()
    }

    const expected = canonicalPrecedingAnchor(type, stage.status)

    if (anchor) {
      if (stage.status !== expected) return "Fixed stages cannot be moved."
      // Anchors must also stay in canonical order relative to each other.
      const anchors = TRACKING_STAGE_ANCHORS[type]
      const previousIndex = precedingAnchor === null ? -1 : anchors.indexOf(precedingAnchor)
      if (anchors.indexOf(stage.status) !== previousIndex + 1) return "Fixed stages cannot be moved."
      precedingAnchor = stage.status
      continue
    }

    if (expected !== precedingAnchor) {
      return `“${TRACKING_STATUS_LABELS[stage.status]}” cannot be moved past a fixed stage.`
    }
  }

  return null
}

/** Attaches the anchor flag the editor and the rules need. */
export function withAnchors(type: ShipmentType, stages: readonly TrackingStageSetting[]): ResolvedTrackingStage[] {
  return stages.map((stage) => ({ ...stage, anchor: isTrackingAnchor(type, stage.status) }))
}

/** The customer-facing name of a status on a given shipment type. */
export function trackingStageLabel(
  config: TrackingStageConfig,
  type: ShipmentType,
  status: TrackingStatus
): string {
  return config[type].find((stage) => stage.status === status)?.label ?? TRACKING_STATUS_LABELS[status]
}

/** Statuses an operator may record on a shipment of this type, in display order. */
export function recordableTrackingStages(config: TrackingStageConfig, type: ShipmentType): TrackingStageSetting[] {
  return config[type].filter((stage) => stage.enabled)
}

/**
 * The stages a customer's timeline shows, in display order: every enabled
 * stage, plus any hidden one the shipment has already reached — a customer
 * must never watch a step they were told about vanish from their history.
 */
export function customerTimelineStages(
  config: TrackingStageConfig,
  type: ShipmentType,
  reached: ReadonlySet<TrackingStatus>
): TrackingStageSetting[] {
  return config[type].filter((stage) => stage.enabled || reached.has(stage.status))
}
