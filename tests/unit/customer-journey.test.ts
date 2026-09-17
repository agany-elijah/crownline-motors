import { describe, expect, it } from "vitest"

import { ShipmentType, TrackingStatus } from "@/generated/prisma/enums"
import { defaultTrackingStages } from "@/lib/settings/tracking-stages"
import { JOURNEY_PHASES, buildCustomerJourney } from "@/lib/tracking/customer-journey"
import { VEHICLE_TRACKING_TIMELINE, SPARE_PART_TRACKING_TIMELINE } from "@/lib/constants/tracking-status"

const day = (n: number) => new Date(Date.UTC(2026, 9, n))

function journey(
  type: ShipmentType,
  currentStatus: TrackingStatus,
  events: { status: TrackingStatus; eventDate: Date }[] = [],
  stages = defaultTrackingStages(type)
) {
  return buildCustomerJourney({ shipmentType: type, currentStatus, events, stages })
}

describe("journey phases", () => {
  it("cover every tracking step exactly once, in timeline order", () => {
    for (const [type, timeline] of [
      [ShipmentType.VEHICLE, VEHICLE_TRACKING_TIMELINE],
      [ShipmentType.SPARE_PART, SPARE_PART_TRACKING_TIMELINE],
    ] as const) {
      expect(JOURNEY_PHASES[type].flatMap((phase) => phase.statuses)).toEqual(timeline)
    }
  })

  it("keep the journey to between three and five major stages", () => {
    expect(JOURNEY_PHASES.VEHICLE).toHaveLength(5)
    expect(JOURNEY_PHASES.SPARE_PART).toHaveLength(4)
  })
})

describe("buildCustomerJourney", () => {
  it("starts a new vehicle order in its first phase, with nothing completed", () => {
    const result = journey(ShipmentType.VEHICLE, TrackingStatus.PURCHASED, [
      { status: TrackingStatus.PURCHASED, eventDate: day(1) },
    ])

    expect(result.current.id).toBe("secured")
    expect(result.phases.map((phase) => phase.state)).toEqual(["current", "upcoming", "upcoming", "upcoming", "upcoming"])
    expect(result.current.date).toEqual(day(1))
    expect(result.next?.id).toBe("shipping")
    expect(result.finished).toBe(false)
  })

  it("groups the detailed steps: in transit is the sea-freight phase", () => {
    const result = journey(ShipmentType.VEHICLE, TrackingStatus.IN_TRANSIT, [
      { status: TrackingStatus.PURCHASED, eventDate: day(1) },
      { status: TrackingStatus.EXPORTED, eventDate: day(5) },
      { status: TrackingStatus.IN_TRANSIT, eventDate: day(8) },
    ])

    expect(result.current.id).toBe("shipping")
    expect(result.currentStage.label).toBe("In transit")
    expect(result.phases[0]).toMatchObject({ state: "complete", date: day(1) })
    expect(result.phases[1]).toMatchObject({ state: "current", date: day(8) })
    // Nothing is dated that has not happened.
    expect(result.phases[2].date).toBeNull()
  })

  it("marks every phase complete once delivered, with nothing next", () => {
    const result = journey(ShipmentType.SPARE_PART, TrackingStatus.DELIVERED)

    expect(result.finished).toBe(true)
    expect(result.next).toBeNull()
    expect(result.phases.every((phase) => phase.state === "complete")).toBe(true)
  })

  it("uses the stage wording configured in Settings", () => {
    const stages = defaultTrackingStages(ShipmentType.SPARE_PART).map((stage) =>
      stage.status === TrackingStatus.PROCESSING ? { ...stage, label: "Being sourced", description: "Custom copy." } : stage
    )
    const result = journey(ShipmentType.SPARE_PART, TrackingStatus.PROCESSING, [], stages)

    expect(result.currentStage).toEqual({ label: "Being sourced", description: "Custom copy." })
  })

  it("never moves backwards when steps between fixed stages are reordered", () => {
    // An operator moved Transport ahead of Clearing. At Clearing the order has
    // already been through Transport, so the road phase is where it is.
    const stages = defaultTrackingStages(ShipmentType.VEHICLE)
    const clearing = stages.findIndex((stage) => stage.status === TrackingStatus.CLEARING)
    const transport = stages.findIndex((stage) => stage.status === TrackingStatus.TRANSPORT_TO_SOUTH_SUDAN)
    ;[stages[clearing], stages[transport]] = [stages[transport], stages[clearing]]

    const result = journey(ShipmentType.VEHICLE, TrackingStatus.CLEARING, [], stages)
    expect(result.current.id).toBe("road")
  })

  it("leaves out a phase whose steps are all switched off, until the order reaches it", () => {
    const stages = defaultTrackingStages(ShipmentType.VEHICLE).map((stage) =>
      stage.status === TrackingStatus.TRANSPORT_TO_SOUTH_SUDAN ? { ...stage, enabled: false } : stage
    )

    expect(journey(ShipmentType.VEHICLE, TrackingStatus.CLEARING, [], stages).phases.map((phase) => phase.id)).not.toContain("road")
    expect(
      journey(ShipmentType.VEHICLE, TrackingStatus.TRANSPORT_TO_SOUTH_SUDAN, [], stages).phases.map((phase) => phase.id)
    ).toContain("road")
  })
})
