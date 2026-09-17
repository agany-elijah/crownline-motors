import { ShipmentType, TrackingStatus } from "@/generated/prisma/enums"
import type { TrackingStageSetting } from "@/lib/settings/tracking-stages"

/**
 * The customer's view of an order's journey: a handful of major phases
 * rather than every operational step.
 *
 * Staff record a vehicle's progress in eleven steps (Settings → Orders &
 * tracking). A customer does not need eleven — they need to know which of a
 * few big moments their order is in, when it got there, and what comes next.
 * So the steps are grouped into five phases for a vehicle and four for parts,
 * and Track My Order draws the phases, naming the precise step only inside the
 * current one.
 *
 * ── Progress follows the configured order ─────────────────────────────
 * An operator may reorder the steps between two fixed stages. A phase is
 * therefore reached when *any step at or before the current one, in the
 * configured order*, belongs to it — never by looking at the current step
 * alone. That keeps progress moving forwards only, whatever order the steps
 * were arranged in.
 *
 * Pure and client-safe: the explainer and the result both render from it,
 * and it is unit tested directly.
 */

export type JourneyIcon = "shield" | "ship" | "anchor" | "truck" | "key" | "check" | "package" | "route" | "home"

export interface JourneyPhaseDefinition {
  id: string
  title: string
  /** One or two sentences: what happens in this phase. */
  summary: string
  /** The steps that belong to it. */
  statuses: readonly TrackingStatus[]
  icon: JourneyIcon
  /**
   * Where an optional photograph for this phase lives under `public/`. The
   * page shows it when the file exists and falls back to the icon when it
   * does not, so a photograph can be added without a code change.
   */
  image: string
}

export const JOURNEY_PHASES: Record<ShipmentType, readonly JourneyPhaseDefinition[]> = {
  [ShipmentType.VEHICLE]: [
    {
      id: "secured",
      title: "Secured & inspected",
      summary: "Your deposit is confirmed and the vehicle is secured for you. We inspect it and check its documents.",
      statuses: [TrackingStatus.PURCHASED, TrackingStatus.INSPECTION_COMPLETED],
      icon: "shield",
      image: "/images/journey/vehicle-secured.jpg",
    },
    {
      id: "shipping",
      title: "Export & sea freight",
      summary: "The vehicle clears export, is loaded at the port and sails for Mombasa, Kenya.",
      statuses: [
        TrackingStatus.EXPORT_DOCUMENTATION,
        TrackingStatus.EXPORTED,
        TrackingStatus.LOADED_FOR_SHIPPING,
        TrackingStatus.IN_TRANSIT,
      ],
      icon: "ship",
      image: "/images/journey/vehicle-shipping.jpg",
    },
    {
      id: "mombasa",
      title: "Arrival & clearing",
      summary: "It arrives in Mombasa and passes port and customs clearing. Your Mombasa payment falls due on arrival.",
      statuses: [TrackingStatus.ARRIVED_AT_MOMBASA, TrackingStatus.CLEARING],
      icon: "anchor",
      image: "/images/journey/vehicle-mombasa.jpg",
    },
    {
      id: "road",
      title: "On the road to South Sudan",
      summary: "Cleared and on its overland journey from Mombasa to South Sudan.",
      statuses: [TrackingStatus.TRANSPORT_TO_SOUTH_SUDAN],
      icon: "truck",
      image: "/images/journey/vehicle-road.jpg",
    },
    {
      id: "handover",
      title: "Ready for handover",
      summary: "Your vehicle is ready. Once the final payment is made, the keys are handed over to you.",
      statuses: [TrackingStatus.READY_FOR_COLLECTION, TrackingStatus.DELIVERED],
      icon: "key",
      image: "/images/journey/vehicle-handover.jpg",
    },
  ],
  [ShipmentType.SPARE_PART]: [
    {
      id: "confirmed",
      title: "Order confirmed",
      summary: "Your payment is confirmed, and your parts are sourced and prepared.",
      statuses: [TrackingStatus.ORDER_CONFIRMED, TrackingStatus.PROCESSING],
      icon: "check",
      image: "/images/journey/parts-confirmed.jpg",
    },
    {
      id: "packed",
      title: "Packed & dispatched",
      summary: "Checked against your order, packed securely and handed over for delivery.",
      statuses: [TrackingStatus.PACKED, TrackingStatus.DISPATCHED],
      icon: "package",
      image: "/images/journey/parts-packed.jpg",
    },
    {
      id: "transit",
      title: "On its way",
      summary: "Travelling to South Sudan, then out for delivery to you.",
      statuses: [TrackingStatus.IN_TRANSIT, TrackingStatus.OUT_FOR_DELIVERY],
      icon: "route",
      image: "/images/journey/parts-on-the-way.jpg",
    },
    {
      id: "delivered",
      title: "Delivered",
      summary: "Your parts are delivered, or waiting for you to collect.",
      statuses: [TrackingStatus.DELIVERED],
      icon: "home",
      image: "/images/journey/parts-delivered.jpg",
    },
  ],
}

export type JourneyPhaseState = "complete" | "current" | "upcoming"

export interface CustomerJourneyPhase {
  id: string
  title: string
  summary: string
  icon: JourneyIcon
  image: string
  state: JourneyPhaseState
  /** When the phase was last moved on — the latest recorded step in it. Null before it is reached. */
  date: Date | null
}

export interface CustomerJourney {
  phases: CustomerJourneyPhase[]
  /** The phase the order is in now (the last one once delivered). */
  current: CustomerJourneyPhase
  /** The precise step inside the current phase, with the wording from Settings. */
  currentStage: { label: string; description: string }
  /** The phase after the current one, or null once the order is in its last. */
  next: CustomerJourneyPhase | null
  /** True once the order has reached its final step. */
  finished: boolean
}

interface JourneyInput {
  shipmentType: ShipmentType
  currentStatus: TrackingStatus
  events: readonly { status: TrackingStatus; eventDate: Date }[]
  /** Settings → Orders & tracking, for this shipment type, in configured order. */
  stages: readonly TrackingStageSetting[]
}

export function buildCustomerJourney(input: JourneyInput): CustomerJourney {
  const definitions = JOURNEY_PHASES[input.shipmentType]
  const reached = new Set<TrackingStatus>([input.currentStatus, ...input.events.map((event) => event.status)])

  // Enabled steps, plus any hidden one the order has been through.
  const stages = input.stages.filter((stage) => stage.enabled || reached.has(stage.status))
  const phaseOf = (status: TrackingStatus) => definitions.findIndex((phase) => phase.statuses.includes(status))

  const currentPosition = Math.max(
    0,
    stages.findIndex((stage) => stage.status === input.currentStatus)
  )
  const currentPhaseIndex = Math.max(
    0,
    ...stages.slice(0, currentPosition + 1).map((stage) => phaseOf(stage.status))
  )
  // Both journeys end at DELIVERED, a fixed stage that is always last.
  const finished = input.currentStatus === TrackingStatus.DELIVERED

  const visibleStatuses = new Set(stages.map((stage) => stage.status))

  const phases: CustomerJourneyPhase[] = definitions.flatMap((definition, index) => {
    // A phase whose every step is switched off is left out — unless the order
    // is already past it, when it stays so the history does not skip.
    const shown = index <= currentPhaseIndex || definition.statuses.some((status) => visibleStatuses.has(status))
    if (!shown) return []

    const state: JourneyPhaseState =
      index < currentPhaseIndex || (finished && index === currentPhaseIndex)
        ? "complete"
        : index === currentPhaseIndex
          ? "current"
          : "upcoming"

    const dates = input.events
      .filter((event) => definition.statuses.includes(event.status))
      .map((event) => event.eventDate.getTime())

    return [
      {
        id: definition.id,
        title: definition.title,
        summary: definition.summary,
        icon: definition.icon,
        image: definition.image,
        state,
        date: state !== "upcoming" && dates.length > 0 ? new Date(Math.max(...dates)) : null,
      },
    ]
  })

  const currentIndex = phases.findIndex((phase) => phase.id === definitions[currentPhaseIndex].id)
  const current = phases[currentIndex]
  const stage = stages[currentPosition]

  return {
    phases,
    current,
    currentStage: { label: stage?.label ?? "", description: stage?.description ?? "" },
    next: finished ? null : (phases[currentIndex + 1] ?? null),
    finished,
  }
}
