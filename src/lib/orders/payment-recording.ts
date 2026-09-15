import { MilestoneStatus, type TrackingStatus } from "@/generated/prisma/enums"
import { fromCents, toCents } from "@/lib/utils/money"

/**
 * The rules applied when an operator records or reverses a payment.
 *
 * Pure, so the money rules are unit-tested (tests/unit/payment-recording.test.ts)
 * rather than trusted; `payment.actions.ts` applies them inside the
 * transaction that locks the stage being paid.
 */

export type MilestonePaymentAssessment =
  | { ok: true; amountPaidAfter: number; balanceAfter: number }
  | { ok: false; balance: number }

/**
 * Does `amount` fit what is still owed on a stage?
 *
 * An amount larger than the stage's balance is refused rather than silently
 * spilling into the next stage: the operator records the excess against the
 * stage it belongs to, so every stage's figures stay explainable to the
 * customer.
 */
export function assessMilestonePayment(input: {
  amountDue: number
  amountPaid: number
  amount: number
}): MilestonePaymentAssessment {
  const due = toCents(input.amountDue)
  const paid = toCents(input.amountPaid)
  const amount = toCents(input.amount)

  if (amount <= 0) {
    throw new RangeError("A payment must be greater than zero.")
  }

  const balance = Math.max(0, due - paid)

  if (amount > balance) {
    return { ok: false, balance: fromCents(balance) }
  }

  return { ok: true, amountPaidAfter: fromCents(paid + amount), balanceAfter: fromCents(balance - amount) }
}

/**
 * Whether a stage has ever been owed. The first stage is owed from the moment
 * the order exists; later ones once something opened them (`becameDueAt`).
 * Decides whether a stage whose payments are all reversed goes back to DUE or
 * to PENDING — see `nextMilestoneStatus`.
 */
export function hasMilestoneOpened(milestone: {
  sequence: number
  status: MilestoneStatus
  becameDueAt: Date | null
}): boolean {
  return milestone.sequence === 1 || milestone.status === MilestoneStatus.DUE || milestone.becameDueAt !== null
}

export interface MilestoneProgress {
  id: string
  sequence: number
  amountDue: number
  amountPaid: number
  status: MilestoneStatus
  triggerStatus: TrackingStatus | null
}

/**
 * The stage to open once the stages before it are settled, or null.
 *
 * Only a stage with no tracking trigger opens this way. A stage tied to a
 * point in the journey — the Mombasa payment, the final payment before
 * release — opens when that tracking event is recorded, because that is when
 * the business rule says the customer owes it.
 */
export function milestoneToOpenAfterSettlement(milestones: readonly MilestoneProgress[]): string | null {
  const next = [...milestones]
    .sort((a, b) => a.sequence - b.sequence)
    .find((milestone) => toCents(milestone.amountPaid) < toCents(milestone.amountDue))

  if (!next || next.status !== MilestoneStatus.PENDING || next.triggerStatus !== null) {
    return null
  }

  return next.id
}

