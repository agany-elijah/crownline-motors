import { describe, expect, it } from "vitest"

import { MilestoneStatus, OrderStatus, OrderType, TrackingStatus } from "@/generated/prisma/enums"
import {
  deriveOrderStatus,
  trackingActivationProblem,
  type LifecycleStage,
} from "@/lib/orders/order-lifecycle"

const { DUE, PENDING, PAID, PARTIALLY_PAID } = MilestoneStatus

/** The default 50 / 25 / 25 vehicle schedule on a $100 order. */
function vehicleStages(
  paid: [number, number, number],
  statuses: [MilestoneStatus, MilestoneStatus, MilestoneStatus] = [DUE, PENDING, PENDING]
): LifecycleStage[] {
  return [
    { sequence: 1, amountDue: 50, amountPaid: paid[0], status: statuses[0], triggerStatus: null },
    { sequence: 2, amountDue: 25, amountPaid: paid[1], status: statuses[1], triggerStatus: TrackingStatus.ARRIVED_AT_MOMBASA },
    { sequence: 3, amountDue: 25, amountPaid: paid[2], status: statuses[2], triggerStatus: TrackingStatus.READY_FOR_COLLECTION },
  ]
}

function vehicle(status: OrderStatus, stages: LifecycleStage[], shipmentStatus: TrackingStatus | null = null) {
  return deriveOrderStatus({ type: OrderType.VEHICLE, status, stages, shipmentStatus })
}

function parts(status: OrderStatus, amountPaid: number, shipmentStatus: TrackingStatus | null = null) {
  return deriveOrderStatus({
    type: OrderType.SPARE_PART,
    status,
    stages: [{ sequence: 1, amountDue: 80, amountPaid, status: amountPaid >= 80 ? PAID : DUE, triggerStatus: null }],
    shipmentStatus,
  })
}

describe("deriveOrderStatus — vehicle orders", () => {
  it("confirms the order once the deposit is settled", () => {
    expect(vehicle(OrderStatus.PENDING_DEPOSIT, vehicleStages([50, 0, 0], [PAID, PENDING, PENDING]))).toBe(
      OrderStatus.DEPOSIT_CONFIRMED
    )
  })

  it("keeps the order pending while the deposit is only part paid", () => {
    expect(vehicle(OrderStatus.PENDING_DEPOSIT, vehicleStages([49.99, 0, 0], [PARTIALLY_PAID, PENDING, PENDING]))).toBe(
      OrderStatus.PENDING_DEPOSIT
    )
  })

  it("returns a confirmed order to pending when its deposit is reversed before tracking starts", () => {
    expect(vehicle(OrderStatus.DEPOSIT_CONFIRMED, vehicleStages([0, 0, 0]))).toBe(OrderStatus.PENDING_DEPOSIT)
  })

  it("moves to processing once tracking is active", () => {
    const stages = vehicleStages([50, 0, 0], [PAID, PENDING, PENDING])
    expect(vehicle(OrderStatus.DEPOSIT_CONFIRMED, stages, TrackingStatus.PURCHASED)).toBe(OrderStatus.PROCESSING)
  })

  it("keeps a shipping order in processing if its deposit is reversed", () => {
    expect(vehicle(OrderStatus.PROCESSING, vehicleStages([0, 0, 0]), TrackingStatus.IN_TRANSIT)).toBe(
      OrderStatus.PROCESSING
    )
  })

  it("awaits the final payment once it has become due, and returns to processing when it is paid", () => {
    const owed = vehicleStages([50, 25, 0], [PAID, PAID, DUE])
    const paid = vehicleStages([50, 25, 25], [PAID, PAID, PAID])

    expect(vehicle(OrderStatus.PROCESSING, owed, TrackingStatus.READY_FOR_COLLECTION)).toBe(
      OrderStatus.AWAITING_FINAL_PAYMENT
    )
    expect(vehicle(OrderStatus.AWAITING_FINAL_PAYMENT, paid, TrackingStatus.READY_FOR_COLLECTION)).toBe(
      OrderStatus.PROCESSING
    )
  })

  it("completes only when delivered and paid in full", () => {
    const paid = vehicleStages([50, 25, 25], [PAID, PAID, PAID])
    const owed = vehicleStages([50, 25, 0], [PAID, PAID, DUE])

    expect(vehicle(OrderStatus.PROCESSING, paid, TrackingStatus.DELIVERED)).toBe(OrderStatus.COMPLETED)
    expect(vehicle(OrderStatus.AWAITING_FINAL_PAYMENT, owed, TrackingStatus.DELIVERED)).toBe(
      OrderStatus.AWAITING_FINAL_PAYMENT
    )
  })

  it("stays completed after a refund recorded post-delivery", () => {
    expect(
      vehicle(OrderStatus.COMPLETED, vehicleStages([50, 25, 10], [PAID, PAID, PARTIALLY_PAID]), TrackingStatus.DELIVERED)
    ).toBe(OrderStatus.COMPLETED)
  })

  it("reopens a completed order whose delivery was voided", () => {
    expect(
      vehicle(OrderStatus.COMPLETED, vehicleStages([50, 25, 25], [PAID, PAID, PAID]), TrackingStatus.READY_FOR_COLLECTION)
    ).toBe(OrderStatus.PROCESSING)
  })

  it("never has a separate final payment on a single-stage schedule", () => {
    const single: LifecycleStage[] = [{ sequence: 1, amountDue: 100, amountPaid: 100, status: PAID, triggerStatus: null }]
    expect(vehicle(OrderStatus.DEPOSIT_CONFIRMED, single, TrackingStatus.CLEARING)).toBe(OrderStatus.PROCESSING)
  })

  it("never moves a cancelled order", () => {
    expect(vehicle(OrderStatus.CANCELLED, vehicleStages([50, 25, 25], [PAID, PAID, PAID]), TrackingStatus.DELIVERED)).toBe(
      OrderStatus.CANCELLED
    )
  })
})

describe("deriveOrderStatus — spare-part orders", () => {
  it("processes once paid in full, and waits again if the payment is reversed", () => {
    expect(parts(OrderStatus.AWAITING_PAYMENT, 80)).toBe(OrderStatus.PROCESSING)
    expect(parts(OrderStatus.PROCESSING, 0, TrackingStatus.ORDER_CONFIRMED)).toBe(OrderStatus.AWAITING_PAYMENT)
  })

  it("completes on delivery", () => {
    expect(parts(OrderStatus.PROCESSING, 80, TrackingStatus.DELIVERED)).toBe(OrderStatus.COMPLETED)
  })
})

describe("trackingActivationProblem", () => {
  const stages = (initialPaid: number) => vehicleStages([initialPaid, 0, 0])

  it("waits for a vehicle's initial payment in full", () => {
    const base = { type: OrderType.VEHICLE, status: OrderStatus.PENDING_DEPOSIT }

    expect(trackingActivationProblem({ ...base, stages: stages(20) })).toMatch(/initial payment/)
    expect(trackingActivationProblem({ ...base, status: OrderStatus.DEPOSIT_CONFIRMED, stages: stages(50) })).toBeNull()
  })

  it("waits for a parts order to be paid in full", () => {
    const partPaid = [{ sequence: 1, amountDue: 80, amountPaid: 40 }]
    expect(
      trackingActivationProblem({ type: OrderType.SPARE_PART, status: OrderStatus.AWAITING_PAYMENT, stages: partPaid })
    ).toMatch(/paid in full/)
  })

  it("refuses cancelled and completed orders", () => {
    for (const status of [OrderStatus.CANCELLED, OrderStatus.COMPLETED]) {
      expect(trackingActivationProblem({ type: OrderType.VEHICLE, status, stages: stages(50) })).not.toBeNull()
    }
  })
})
