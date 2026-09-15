import { describe, expect, it } from "vitest"

import { MilestoneStatus, TrackingStatus } from "@/generated/prisma/enums"
import {
  assessMilestonePayment,
  hasMilestoneOpened,
  milestoneToOpenAfterSettlement,
  type MilestoneProgress,
} from "@/lib/orders/payment-recording"

describe("assessMilestonePayment", () => {
  it("accepts an amount up to the stage balance", () => {
    expect(assessMilestonePayment({ amountDue: 11_250, amountPaid: 5_000, amount: 6_250 })).toEqual({
      ok: true,
      amountPaidAfter: 11_250,
      balanceAfter: 0,
    })
  })

  it("refuses an amount larger than the stage balance and reports the balance", () => {
    expect(assessMilestonePayment({ amountDue: 11_250, amountPaid: 5_000, amount: 6_250.01 })).toEqual({
      ok: false,
      balance: 6_250,
    })
  })

  it("does its arithmetic in cents, not floats", () => {
    expect(assessMilestonePayment({ amountDue: 0.3, amountPaid: 0.1, amount: 0.2 })).toEqual({
      ok: true,
      amountPaidAfter: 0.3,
      balanceAfter: 0,
    })
  })

  it("refuses anything on a stage that is already settled", () => {
    expect(assessMilestonePayment({ amountDue: 100, amountPaid: 100, amount: 1 })).toEqual({ ok: false, balance: 0 })
  })

  it("throws on a non-positive amount", () => {
    expect(() => assessMilestonePayment({ amountDue: 100, amountPaid: 0, amount: 0 })).toThrow(RangeError)
  })
})

describe("hasMilestoneOpened", () => {
  it("treats the first stage as owed from the start", () => {
    expect(hasMilestoneOpened({ sequence: 1, status: MilestoneStatus.PAID, becameDueAt: null })).toBe(true)
  })

  it("treats a later stage as owed only once something opened it", () => {
    expect(hasMilestoneOpened({ sequence: 2, status: MilestoneStatus.PARTIALLY_PAID, becameDueAt: null })).toBe(false)
    expect(hasMilestoneOpened({ sequence: 2, status: MilestoneStatus.PAID, becameDueAt: new Date() })).toBe(true)
    expect(hasMilestoneOpened({ sequence: 3, status: MilestoneStatus.DUE, becameDueAt: null })).toBe(true)
  })
})

function stage(overrides: Partial<MilestoneProgress> & Pick<MilestoneProgress, "id" | "sequence">): MilestoneProgress {
  return {
    amountDue: 100,
    amountPaid: 0,
    status: MilestoneStatus.PENDING,
    triggerStatus: null,
    ...overrides,
  }
}

describe("milestoneToOpenAfterSettlement", () => {
  it("does not open a stage tied to a tracking event", () => {
    const vehicle = [
      stage({ id: "initial", sequence: 1, amountPaid: 100, status: MilestoneStatus.PAID }),
      stage({ id: "mombasa", sequence: 2, triggerStatus: TrackingStatus.ARRIVED_AT_MOMBASA }),
      stage({ id: "final", sequence: 3, triggerStatus: TrackingStatus.READY_FOR_COLLECTION }),
    ]

    expect(milestoneToOpenAfterSettlement(vehicle)).toBeNull()
  })

  it("opens the next pending stage that has no trigger", () => {
    const stages = [
      stage({ id: "one", sequence: 1, amountPaid: 100, status: MilestoneStatus.PAID }),
      stage({ id: "two", sequence: 2 }),
    ]

    expect(milestoneToOpenAfterSettlement(stages)).toBe("two")
  })

  it("opens nothing while an earlier stage is still owed", () => {
    const stages = [
      stage({ id: "one", sequence: 1, amountPaid: 40, status: MilestoneStatus.PARTIALLY_PAID }),
      stage({ id: "two", sequence: 2 }),
    ]

    expect(milestoneToOpenAfterSettlement(stages)).toBeNull()
  })

  it("opens nothing once every stage is settled", () => {
    expect(
      milestoneToOpenAfterSettlement([stage({ id: "one", sequence: 1, amountPaid: 100, status: MilestoneStatus.PAID })])
    ).toBeNull()
  })
})

