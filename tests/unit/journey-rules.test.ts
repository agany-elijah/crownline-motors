import { describe, expect, it } from "vitest"

import { MilestoneStatus, ShipmentType, TrackingStatus } from "@/generated/prisma/enums"
import {
  currentPosition,
  requiresFullPayment,
  stagesToClose,
  stagesToOpen,
  type JourneyEvent,
  type JourneyStage,
} from "@/lib/tracking/journey-rules"

const { VEHICLE, SPARE_PART } = ShipmentType

function stages(mombasa: MilestoneStatus, final: MilestoneStatus = MilestoneStatus.PENDING): JourneyStage[] {
  return [
    { id: "initial", status: MilestoneStatus.PAID, triggerStatus: null },
    { id: "mombasa", status: mombasa, triggerStatus: TrackingStatus.ARRIVED_AT_MOMBASA },
    { id: "final", status: final, triggerStatus: TrackingStatus.READY_FOR_COLLECTION },
  ]
}

describe("stagesToOpen", () => {
  it("opens a stage when the journey reaches its trigger", () => {
    expect(stagesToOpen(stages(MilestoneStatus.PENDING), VEHICLE, TrackingStatus.ARRIVED_AT_MOMBASA)).toEqual(["mombasa"])
  })

  it("opens a stage whose trigger was skipped", () => {
    expect(stagesToOpen(stages(MilestoneStatus.PENDING), VEHICLE, TrackingStatus.CLEARING)).toEqual(["mombasa"])
    expect(stagesToOpen(stages(MilestoneStatus.PENDING), VEHICLE, TrackingStatus.DELIVERED)).toEqual(["mombasa", "final"])
  })

  it("opens nothing before the trigger", () => {
    expect(stagesToOpen(stages(MilestoneStatus.PENDING), VEHICLE, TrackingStatus.IN_TRANSIT)).toEqual([])
    expect(stagesToOpen(stages(MilestoneStatus.PENDING), VEHICLE, null)).toEqual([])
  })

  it("does not reopen a stage the customer paid early", () => {
    expect(stagesToOpen(stages(MilestoneStatus.PAID), VEHICLE, TrackingStatus.CLEARING)).toEqual([])
  })
})

describe("stagesToClose", () => {
  it("closes a due stage the corrected journey no longer reaches", () => {
    expect(stagesToClose(stages(MilestoneStatus.DUE), VEHICLE, TrackingStatus.IN_TRANSIT)).toEqual(["mombasa"])
    expect(stagesToClose(stages(MilestoneStatus.DUE), VEHICLE, null)).toEqual(["mombasa"])
  })

  it("keeps a due stage the journey still reaches", () => {
    expect(stagesToClose(stages(MilestoneStatus.DUE), VEHICLE, TrackingStatus.CLEARING)).toEqual([])
  })

  it("never closes a stage with money against it, or one no trigger opened", () => {
    expect(stagesToClose(stages(MilestoneStatus.PARTIALLY_PAID), VEHICLE, null)).toEqual([])
    expect(
      stagesToClose([{ id: "initial", status: MilestoneStatus.DUE, triggerStatus: null }], VEHICLE, null)
    ).toEqual([])
  })
})

describe("requiresFullPayment", () => {
  it("lets a vehicle reach Ready for collection unpaid, but not Delivered", () => {
    expect(requiresFullPayment(VEHICLE, TrackingStatus.READY_FOR_COLLECTION)).toBe(false)
    expect(requiresFullPayment(VEHICLE, TrackingStatus.DELIVERED)).toBe(true)
  })

  it("requires parts to be paid before they are packed", () => {
    expect(requiresFullPayment(SPARE_PART, TrackingStatus.PROCESSING)).toBe(false)
    expect(requiresFullPayment(SPARE_PART, TrackingStatus.PACKED)).toBe(true)
    expect(requiresFullPayment(SPARE_PART, TrackingStatus.DELIVERED)).toBe(true)
  })

  it("ignores statuses from the other timeline", () => {
    expect(requiresFullPayment(SPARE_PART, TrackingStatus.CLEARING)).toBe(false)
  })
})

describe("currentPosition", () => {
  const event = (id: string, status: TrackingStatus, date: string, created: string, location: string | null = null) =>
    ({ id, status, location, eventDate: new Date(date), createdAt: new Date(created) }) satisfies JourneyEvent

  it("is the latest event by the date it happened, not the order it was entered", () => {
    const events = [
      event("clearing", TrackingStatus.CLEARING, "2026-09-10", "2026-09-10T08:00:00Z", "Mombasa"),
      event("backdated", TrackingStatus.IN_TRANSIT, "2026-09-01", "2026-09-11T08:00:00Z", "At sea"),
    ]

    expect(currentPosition(events)).toEqual({ eventId: "clearing", status: TrackingStatus.CLEARING, location: "Mombasa" })
  })

  it("breaks a same-day tie by entry order", () => {
    const events = [
      event("first", TrackingStatus.ARRIVED_AT_MOMBASA, "2026-09-10", "2026-09-10T08:00:00Z"),
      event("second", TrackingStatus.CLEARING, "2026-09-10", "2026-09-10T09:00:00Z"),
    ]

    expect(currentPosition(events)?.eventId).toBe("second")
  })

  it("keeps the last known location when the latest event has none", () => {
    const events = [
      event("arrived", TrackingStatus.ARRIVED_AT_MOMBASA, "2026-09-09", "2026-09-09T08:00:00Z", "Mombasa Port"),
      event("clearing", TrackingStatus.CLEARING, "2026-09-10", "2026-09-10T08:00:00Z"),
    ]

    expect(currentPosition(events)?.location).toBe("Mombasa Port")
  })

  it("is null when no live event remains", () => {
    expect(currentPosition([])).toBeNull()
  })
})
