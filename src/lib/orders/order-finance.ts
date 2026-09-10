import { MilestoneStatus, PaymentStatus } from "@/generated/prisma/enums"
import { fromCents, toCents } from "@/lib/utils/money"

/**
 * An order's financial position, derived from its payment ledger.
 *
 * ── The one rule that matters ─────────────────────────────────────────
 * Nothing here is read from a stored "amount paid" or "balance" column,
 * because there is none: the schema documentation calls this the most
 * safety-critical number in the system and requires it to be computed live
 * from CONFIRMED payments on every read. A stored copy drifts the first time
 * any code path forgets to update it — and the customer it drifts for is
 * either chased for money they paid or handed a car they have not.
 *
 * Only CONFIRMED payments count. A payment a customer says they made is
 * SUBMITTED; one an operator is checking is UNDER_VERIFICATION; neither is
 * money the dealership holds.
 *
 * Pure, so the arithmetic is unit-tested (tests/unit/payment-balance.test.ts)
 * and shared by the order screens and the payment action.
 */

export type FinancialStatus = "UNPAID" | "PARTIALLY_PAID" | "DEPOSIT_PAID" | "PAID_IN_FULL"

export const FINANCIAL_STATUS_LABELS: Record<FinancialStatus, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  DEPOSIT_PAID: "Deposit paid",
  PAID_IN_FULL: "Paid in full",
}

export interface FinanceMilestoneInput {
  id: string
  sequence: number
  label: string
  amountDue: number
  status: MilestoneStatus
}

export interface FinancePaymentInput {
  amount: number
  status: PaymentStatus
  milestoneId: string | null
}

export interface MilestoneFinance extends FinanceMilestoneInput {
  amountPaid: number
  balance: number
}

export interface OrderFinanceSummary {
  totalAmount: number
  amountPaid: number
  balance: number
  financialStatus: FinancialStatus
  /** In sequence order, each with what has been paid against it. */
  milestones: MilestoneFinance[]
  /** The stage the customer should be paying now, or null once all are paid. */
  currentlyDue: MilestoneFinance | null
}

function confirmedCents(payments: readonly FinancePaymentInput[]): number {
  return payments
    .filter((payment) => payment.status === PaymentStatus.CONFIRMED)
    .reduce((sum, payment) => sum + toCents(payment.amount), 0)
}

export function summarizeOrderFinance(input: {
  totalAmount: number
  milestones: readonly FinanceMilestoneInput[]
  payments: readonly FinancePaymentInput[]
}): OrderFinanceSummary {
  const totalCents = toCents(input.totalAmount)
  const paidCents = confirmedCents(input.payments)

  const milestones: MilestoneFinance[] = [...input.milestones]
    .sort((a, b) => a.sequence - b.sequence)
    .map((milestone) => {
      const paid = confirmedCents(
        input.payments.filter((payment) => payment.milestoneId === milestone.id)
      )

      return {
        ...milestone,
        amountPaid: fromCents(paid),
        balance: fromCents(Math.max(0, toCents(milestone.amountDue) - paid)),
      }
    })

  /**
   * The stage that is due: the one explicitly marked DUE, falling back to the
   * lowest-sequence stage not yet paid — the rule the schema documentation
   * states. The fallback is what keeps a stage from vanishing if a later
   * stage has not been marked due yet when the earlier one completes.
   */
  const currentlyDue =
    milestones.find((milestone) => milestone.status === MilestoneStatus.DUE) ??
    milestones.find((milestone) => milestone.status !== MilestoneStatus.PAID) ??
    null

  return {
    totalAmount: fromCents(totalCents),
    amountPaid: fromCents(paidCents),
    balance: fromCents(Math.max(0, totalCents - paidCents)),
    financialStatus: deriveFinancialStatus(totalCents, paidCents, milestones),
    milestones,
    currentlyDue,
  }
}

/**
 * The list-view label for where the money stands.
 *
 * "Deposit paid" is the vehicle vocabulary for the first stage being settled
 * with more still to come, and is only meaningful when there *is* more than
 * one stage; a parts order paid in full up front goes straight from Unpaid
 * to Paid in full.
 */
function deriveFinancialStatus(
  totalCents: number,
  paidCents: number,
  milestones: readonly MilestoneFinance[]
): FinancialStatus {
  if (paidCents <= 0) return "UNPAID"
  if (paidCents >= totalCents) return "PAID_IN_FULL"

  const first = milestones[0]

  if (milestones.length > 1 && first && toCents(first.balance) === 0) {
    return "DEPOSIT_PAID"
  }

  return "PARTIALLY_PAID"
}

/**
 * The status a milestone should hold after a payment against it lands (or is
 * reversed).
 *
 * `status` is a maintained column, written in the same transaction as the
 * payment that changes it, so every reader sees one answer rather than each
 * recomputing it. A stage keeps DUE while nothing is paid against it if it
 * was already due; otherwise it returns to PENDING.
 */
export function nextMilestoneStatus(input: {
  amountDue: number
  amountPaid: number
  wasDue: boolean
}): MilestoneStatus {
  const due = toCents(input.amountDue)
  const paid = toCents(input.amountPaid)

  if (paid >= due) return MilestoneStatus.PAID
  if (paid > 0) return MilestoneStatus.PARTIALLY_PAID

  return input.wasDue ? MilestoneStatus.DUE : MilestoneStatus.PENDING
}
