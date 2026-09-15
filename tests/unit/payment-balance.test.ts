import { describe, expect, it } from "vitest"

import { MilestoneStatus, PaymentStatus } from "@/generated/prisma/enums"
import { planMilestones, vehicleMilestoneTemplates } from "@/lib/orders/milestones"
import { nextMilestoneStatus, summarizeOrderFinance } from "@/lib/orders/order-finance"

const MILESTONES = [
  { id: "m1", sequence: 1, label: "Initial payment (50%)", amountDue: 11_000, status: MilestoneStatus.PAID },
  { id: "m2", sequence: 2, label: "Mombasa payment (25%)", amountDue: 5_500, status: MilestoneStatus.PENDING },
  { id: "m3", sequence: 3, label: "Final payment (25%)", amountDue: 5_500, status: MilestoneStatus.PENDING },
]

describe("order balance", () => {
  it("counts only CONFIRMED payments toward amountPaid", () => {
    const finance = summarizeOrderFinance({
      totalAmount: 22_000,
      milestones: MILESTONES,
      payments: [
        { amount: 11_000, status: PaymentStatus.CONFIRMED, milestoneId: "m1" },
        { amount: 5_500, status: PaymentStatus.SUBMITTED, milestoneId: "m2" },
        { amount: 2_000, status: PaymentStatus.REJECTED, milestoneId: "m2" },
        { amount: 1_000, status: PaymentStatus.REFUNDED, milestoneId: "m3" },
      ],
    })

    expect(finance.amountPaid).toBe(11_000)
    expect(finance.milestones.map((milestone) => milestone.amountPaid)).toEqual([11_000, 0, 0])
  })

  it("derives balance as totalAmount minus amountPaid, never a stored column", () => {
    const finance = summarizeOrderFinance({
      totalAmount: 22_000,
      milestones: MILESTONES,
      payments: [{ amount: 11_000, status: PaymentStatus.CONFIRMED, milestoneId: "m1" }],
    })

    expect(finance.balance).toBe(11_000)
    expect(finance.financialStatus).toBe("DEPOSIT_PAID")
  })

  it("splits milestones 50/25/25 from the percentages locked in at order creation", () => {
    const planned = planMilestones(22_000.01, vehicleMilestoneTemplates({ initial: 50, mombasa: 25, final: 25 }))

    expect(planned.map((milestone) => milestone.amountDue)).toEqual([11_000, 5_500, 5_500.01])
    expect(planned.map((milestone) => milestone.label)).toEqual([
      "Initial payment (50%)",
      "Mombasa payment (25%)",
      "Final payment (25%)",
    ])
  })

  it("reports the lowest-sequence unpaid milestone as currently due", () => {
    const fallback = summarizeOrderFinance({ totalAmount: 22_000, milestones: MILESTONES, payments: [] })
    expect(fallback.currentlyDue?.id).toBe("m2")

    const explicit = summarizeOrderFinance({
      totalAmount: 22_000,
      milestones: MILESTONES.map((milestone) =>
        milestone.id === "m3" ? { ...milestone, status: MilestoneStatus.DUE } : milestone
      ),
      payments: [],
    })
    expect(explicit.currentlyDue?.id).toBe("m3")
  })
})

describe("nextMilestoneStatus", () => {
  it("marks a stage paid once its amount is covered", () => {
    expect(nextMilestoneStatus({ amountDue: 100, amountPaid: 100, wasDue: true })).toBe(MilestoneStatus.PAID)
  })

  it("marks a stage part paid while something is still owed", () => {
    expect(nextMilestoneStatus({ amountDue: 100, amountPaid: 0.01, wasDue: false })).toBe(MilestoneStatus.PARTIALLY_PAID)
  })

  it("returns an unpaid stage to due or pending depending on whether it had opened", () => {
    expect(nextMilestoneStatus({ amountDue: 100, amountPaid: 0, wasDue: true })).toBe(MilestoneStatus.DUE)
    expect(nextMilestoneStatus({ amountDue: 100, amountPaid: 0, wasDue: false })).toBe(MilestoneStatus.PENDING)
  })
})
