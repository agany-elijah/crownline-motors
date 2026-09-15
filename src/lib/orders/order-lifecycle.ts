import { MilestoneStatus, OrderStatus, OrderType, TrackingStatus } from "@/generated/prisma/enums"
import { toCents } from "@/lib/utils/money"

/**
 * An order's coarse status, derived from the two things that actually move
 * it: the money recorded against its payment stages, and where its shipment
 * is.
 *
 * Pure, so the rules are unit-tested (tests/unit/order-lifecycle.test.ts).
 * `order-status-sync.ts` applies the answer after every payment, tracking
 * update and correction, so an order can never be left saying "pending
 * deposit" about a car that has been delivered.
 *
 *   Vehicle:  PENDING_DEPOSIT → DEPOSIT_CONFIRMED → PROCESSING
 *             → AWAITING_FINAL_PAYMENT → COMPLETED
 *   Parts:    AWAITING_PAYMENT → PROCESSING → COMPLETED
 *
 * CANCELLED is only ever set by the cancellation action and is never left.
 */

export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING_DEPOSIT,
  OrderStatus.DEPOSIT_CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.AWAITING_FINAL_PAYMENT,
  OrderStatus.AWAITING_PAYMENT,
]

export interface LifecycleStage {
  sequence: number
  amountDue: number
  amountPaid: number
  status: MilestoneStatus
  triggerStatus: TrackingStatus | null
}

function isSettled(stage: Pick<LifecycleStage, "amountDue" | "amountPaid">): boolean {
  return toCents(stage.amountPaid) >= toCents(stage.amountDue)
}

export function deriveOrderStatus(input: {
  type: OrderType
  status: OrderStatus
  stages: readonly LifecycleStage[]
  /** The shipment's current status, or null before tracking is activated. */
  shipmentStatus: TrackingStatus | null
}): OrderStatus {
  const stages = [...input.stages].sort((a, b) => a.sequence - b.sequence)
  const first = stages[0]

  if (!first || input.status === OrderStatus.CANCELLED) return input.status

  const delivered = input.shipmentStatus === TrackingStatus.DELIVERED

  // A delivered order stays completed. A refund recorded after handover is a
  // financial event, not a reason to reopen the sale; voiding the delivery
  // itself is what reopens it.
  if (input.status === OrderStatus.COMPLETED && delivered) return OrderStatus.COMPLETED

  const allSettled = stages.every(isSettled)

  if (input.type === OrderType.VEHICLE) {
    if (input.status === OrderStatus.PENDING_DEPOSIT || input.status === OrderStatus.DEPOSIT_CONFIRMED) {
      if (!isSettled(first)) return OrderStatus.PENDING_DEPOSIT
      if (input.shipmentStatus === null) return OrderStatus.DEPOSIT_CONFIRMED
    }

    if (delivered && allSettled) return OrderStatus.COMPLETED

    // The final stage is owed once its trigger has opened it and until it is
    // paid. A single-stage schedule has no separate final payment.
    const last = stages[stages.length - 1]
    const finalStageOwed =
      stages.length > 1 && last.triggerStatus !== null && last.status !== MilestoneStatus.PENDING && !isSettled(last)

    return finalStageOwed ? OrderStatus.AWAITING_FINAL_PAYMENT : OrderStatus.PROCESSING
  }

  if (!allSettled) return OrderStatus.AWAITING_PAYMENT

  return delivered ? OrderStatus.COMPLETED : OrderStatus.PROCESSING
}

/**
 * Why tracking cannot be activated on this order yet, or null if it can.
 *
 * Tracking starts once the business has committed to the journey: a vehicle
 * once its initial payment is settled (procurement proceeds after it), a
 * parts order once it is paid in full.
 */
export function trackingActivationProblem(input: {
  type: OrderType
  status: OrderStatus
  stages: readonly Pick<LifecycleStage, "sequence" | "amountDue" | "amountPaid">[]
}): string | null {
  if (input.status === OrderStatus.CANCELLED) return "This order is cancelled, so tracking cannot be activated."
  if (input.status === OrderStatus.COMPLETED) return "This order is already completed."

  const stages = [...input.stages].sort((a, b) => a.sequence - b.sequence)
  const first = stages[0]

  if (!first) return "This order has no payment stages."

  if (input.type === OrderType.VEHICLE) {
    return isSettled(first) ? null : "Tracking starts once the initial payment has been received in full."
  }

  return stages.every(isSettled) ? null : "Tracking starts once the order has been paid in full."
}
