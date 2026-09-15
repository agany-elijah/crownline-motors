import { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums"
import type { StatusTone } from "@/components/admin/status-badge"

/**
 * The payment vocabulary shown to operators and, in emails, to customers.
 *
 * Wave A records payments by hand: the customer pays by bank transfer or
 * mobile money, an operator checks the money has arrived, and records it
 * against the order. Card details never reach this application, so there is
 * no card method here.
 */

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  MOBILE_MONEY: "Mobile money",
  MANUAL_OTHER: "Cash / other",
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  UNDER_VERIFICATION: "Under verification",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  REFUNDED: "Refunded",
  FAILED: "Failed",
}

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, StatusTone> = {
  PENDING: "muted",
  SUBMITTED: "warning",
  UNDER_VERIFICATION: "warning",
  CONFIRMED: "positive",
  REJECTED: "critical",
  REFUNDED: "neutral",
  FAILED: "critical",
}

/**
 * The two ways a confirmed payment can be reversed. REJECTED corrects an
 * entry that should never have been recorded (wrong order, money that never
 * arrived); REFUNDED records money genuinely returned to the customer. Both
 * stop the payment counting toward any balance, and neither deletes it.
 */
export const PAYMENT_REVERSAL_OUTCOMES = [PaymentStatus.REJECTED, PaymentStatus.REFUNDED] as const

export type PaymentReversalOutcome = (typeof PAYMENT_REVERSAL_OUTCOMES)[number]
