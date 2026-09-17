import { describe, expect, it } from "vitest"

import { ShipmentType, TrackingStatus } from "@/generated/prisma/enums"
import {
  TRACKING_STAGE_ANCHORS,
  canonicalTimeline,
  customerTimelineStages,
  defaultTrackingStageConfig,
  defaultTrackingStages,
  isTrackingAnchor,
  trackingStagesProblem,
  type TrackingStageSetting,
} from "@/lib/settings/tracking-stages"
import { resolveTrackingStageConfig, trackingStageConfigSchema } from "@/lib/validations/settings.schema"

const TYPES = [ShipmentType.VEHICLE, ShipmentType.SPARE_PART] as const

/** The stages with each run between two anchors reversed — the most any valid reorder can move. */
function reverseEverySegment(type: ShipmentType): TrackingStageSetting[] {
  const result: TrackingStageSetting[] = []
  let run: TrackingStageSetting[] = []

  for (const stage of defaultTrackingStages(type)) {
    if (isTrackingAnchor(type, stage.status)) {
      result.push(...run.reverse(), stage)
      run = []
    } else {
      run.push(stage)
    }
  }

  return [...result, ...run.reverse()]
}

function move(stages: TrackingStageSetting[], status: TrackingStatus, to: number): TrackingStageSetting[] {
  const next = stages.filter((stage) => stage.status !== status)
  next.splice(to, 0, stages.find((stage) => stage.status === status)!)
  return next
}

describe("tracking stage configuration", () => {
  it.each(TYPES)("accepts the built-in %s timeline", (type) => {
    expect(trackingStagesProblem(type, defaultTrackingStages(type))).toBeNull()
  })

  it.each(TYPES)("accepts reordering stages between the same two fixed stages (%s)", (type) => {
    expect(trackingStagesProblem(type, reverseEverySegment(type))).toBeNull()
  })

  it("refuses moving a stage past a fixed one", () => {
    const stages = defaultTrackingStages(ShipmentType.VEHICLE)
    // Clearing belongs after Arrived at Mombasa; before it, recording it would
    // no longer open the Mombasa payment.
    const mombasa = stages.findIndex((stage) => stage.status === TrackingStatus.ARRIVED_AT_MOMBASA)
    expect(trackingStagesProblem(ShipmentType.VEHICLE, move(stages, TrackingStatus.CLEARING, mombasa))).toMatch(
      /fixed stage/
    )
  })

  it("refuses moving a fixed stage", () => {
    const stages = defaultTrackingStages(ShipmentType.SPARE_PART)
    expect(trackingStagesProblem(ShipmentType.SPARE_PART, move(stages, TrackingStatus.PACKED, 1))).not.toBeNull()
  })

  it.each(TYPES)("refuses turning off a fixed stage (%s)", (type) => {
    for (const anchor of TRACKING_STAGE_ANCHORS[type]) {
      const stages = defaultTrackingStages(type).map((stage) =>
        stage.status === anchor ? { ...stage, enabled: false } : stage
      )
      expect(trackingStagesProblem(type, stages), anchor).toMatch(/cannot be turned off/)
    }
  })

  it("allows turning off a stage that carries no rule", () => {
    const stages = defaultTrackingStages(ShipmentType.VEHICLE).map((stage) =>
      stage.status === TrackingStatus.EXPORT_DOCUMENTATION ? { ...stage, enabled: false } : stage
    )
    expect(trackingStagesProblem(ShipmentType.VEHICLE, stages)).toBeNull()
  })

  it("refuses a list with a stage missing, duplicated or from the other timeline", () => {
    const stages = defaultTrackingStages(ShipmentType.VEHICLE)
    expect(trackingStagesProblem(ShipmentType.VEHICLE, stages.slice(1))).not.toBeNull()
    expect(trackingStagesProblem(ShipmentType.VEHICLE, [...stages.slice(1), stages[1]])).not.toBeNull()
    expect(
      trackingStagesProblem(ShipmentType.VEHICLE, [
        ...stages.slice(0, -1),
        { ...stages[0], status: TrackingStatus.PACKED },
      ])
    ).not.toBeNull()
  })

  /**
   * The property that lets journey-rules.ts keep reading the canonical
   * timeline: for every stage and every anchor, "is the stage before the
   * anchor?" has the same answer in any accepted order. Payment triggers and
   * the paid-in-full rule are all such comparisons.
   */
  it.each(TYPES)("never changes which side of a fixed stage any stage is on (%s)", (type) => {
    const canonical = canonicalTimeline(type)
    const configured = reverseEverySegment(type).map((stage) => stage.status)

    for (const status of canonical) {
      for (const anchor of TRACKING_STAGE_ANCHORS[type]) {
        const before = canonical.indexOf(status) <= canonical.indexOf(anchor)
        const stillBefore = configured.indexOf(status) <= configured.indexOf(anchor)
        expect(stillBefore, `${status} vs ${anchor}`).toBe(before)
      }
    }
  })

  it("keeps a hidden stage on a customer's timeline once it has been reached", () => {
    const config = defaultTrackingStageConfig()
    config.VEHICLE = config.VEHICLE.map((stage) =>
      stage.status === TrackingStatus.INSPECTION_COMPLETED ? { ...stage, enabled: false } : stage
    )

    const unreached = customerTimelineStages(config, ShipmentType.VEHICLE, new Set())
    const reached = customerTimelineStages(
      config,
      ShipmentType.VEHICLE,
      new Set([TrackingStatus.INSPECTION_COMPLETED])
    )

    expect(unreached.map((stage) => stage.status)).not.toContain(TrackingStatus.INSPECTION_COMPLETED)
    expect(reached.map((stage) => stage.status)).toContain(TrackingStatus.INSPECTION_COMPLETED)
  })
})

describe("stored tracking stages", () => {
  it("falls back to the built-in timeline when nothing is stored", () => {
    expect(resolveTrackingStageConfig(null)).toEqual(defaultTrackingStageConfig())
  })

  it("falls back per type, keeping a valid list beside an invalid one", () => {
    const renamed = defaultTrackingStages(ShipmentType.VEHICLE).map((stage) =>
      stage.status === TrackingStatus.CLEARING ? { ...stage, label: "Customs clearance" } : stage
    )

    const resolved = resolveTrackingStageConfig({ VEHICLE: renamed, SPARE_PART: [{ status: "nonsense" }] })

    expect(resolved.VEHICLE.find((stage) => stage.status === TrackingStatus.CLEARING)?.label).toBe(
      "Customs clearance"
    )
    expect(resolved.SPARE_PART).toEqual(defaultTrackingStages(ShipmentType.SPARE_PART))
  })

  it("validates a submitted configuration with the same rules", () => {
    const config = defaultTrackingStageConfig()
    expect(trackingStageConfigSchema.safeParse(config).success).toBe(true)

    config.SPARE_PART = config.SPARE_PART.map((stage) =>
      stage.status === TrackingStatus.DELIVERED ? { ...stage, enabled: false } : stage
    )
    expect(trackingStageConfigSchema.safeParse(config).success).toBe(false)
  })
})
