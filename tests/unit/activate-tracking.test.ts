import { beforeEach, describe, expect, it, vi } from "vitest"

import { MilestoneStatus, OrderStatus, OrderType, ShipmentType, TrackingStatus } from "@/generated/prisma/enums"
import type { OrderLedger } from "@/lib/orders/order-ledger"

/**
 * Tracking starts with the payment that makes an order eligible, so a
 * customer's receipt can carry their tracking number. These tests drive the
 * shared activation step with a stubbed transaction: it must create exactly
 * one shipment, at the right opening status, and only when the order has
 * earned it.
 */

const state = vi.hoisted(() => ({
  ledger: null as unknown as OrderLedger,
  created: [] as Record<string, unknown>[],
  audits: [] as Record<string, unknown>[],
}))

vi.mock("server-only", () => ({}))

vi.mock("@/lib/orders/order-ledger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orders/order-ledger")>()
  return { ...actual, readOrderLedger: async () => state.ledger }
})

vi.mock("@/lib/audit", () => ({
  recordAuditLog: async (entry: Record<string, unknown>) => {
    state.audits.push(entry)
  },
}))

vi.mock("@/lib/utils/generate-reference", () => ({
  generateReference: async (_tx: unknown, kind: string, _year: unknown, options: { trackingPrefix?: string }) =>
    `${options.trackingPrefix}-2026-000042${kind === "TRACKING" ? "" : "-wrong-kind"}`,
}))

const { activateTrackingInTransaction } = await import("@/lib/tracking/activate-tracking")

const tx = {
  order: { findUniqueOrThrow: async () => ({ items: [{ vehicleId: "veh-1" }] }) },
  businessSettings: { findUnique: async () => ({ trackingNumberPrefix: "CLM" }) },
  shipment: {
    create: async (args: { data: Record<string, unknown> }) => {
      state.created.push(args.data)
      return { id: "ship-1" }
    },
  },
} as never

function vehicleLedger(depositPaid: number, overrides: Partial<OrderLedger> = {}): OrderLedger {
  return {
    orderStatus: OrderStatus.PENDING_DEPOSIT,
    orderType: OrderType.VEHICLE,
    totalAmount: 20_000,
    rows: [
      { id: "m1", sequence: 1, label: "Deposit", amountDue: 10_000, status: MilestoneStatus.DUE, triggerStatus: null, becameDueAt: null },
      { id: "m2", sequence: 2, label: "Mombasa", amountDue: 5_000, status: MilestoneStatus.PENDING, triggerStatus: TrackingStatus.ARRIVED_AT_MOMBASA, becameDueAt: null },
      { id: "m3", sequence: 3, label: "Final", amountDue: 5_000, status: MilestoneStatus.PENDING, triggerStatus: TrackingStatus.READY_FOR_COLLECTION, becameDueAt: null },
    ],
    confirmed: depositPaid > 0 ? [{ amount: depositPaid, milestoneId: "m1" }] : [],
    shipmentStatus: null,
    ...overrides,
  }
}

beforeEach(() => {
  state.created = []
  state.audits = []
})

describe("activateTrackingInTransaction", () => {
  it("starts tracking once the vehicle's initial payment is settled", async () => {
    state.ledger = vehicleLedger(10_000)

    const outcome = await activateTrackingInTransaction(tx, { orderId: "o1", actorId: "admin", cause: "PAYMENT_RECORDED" })

    expect(outcome).toEqual({ activated: true, shipmentId: "ship-1", trackingNumber: "CLM-2026-000042" })
    expect(state.created).toEqual([
      {
        trackingNumber: "CLM-2026-000042",
        orderId: "o1",
        vehicleId: "veh-1",
        shipmentType: ShipmentType.VEHICLE,
        currentStatus: TrackingStatus.PURCHASED,
      },
    ])
    expect(state.audits).toHaveLength(1)
    expect(state.audits[0]).toMatchObject({ action: "SHIPMENT_CREATED", metadata: { activatedBy: "payment" } })
  })

  it("does nothing while the initial payment is only partly paid", async () => {
    state.ledger = vehicleLedger(4_000)

    const outcome = await activateTrackingInTransaction(tx, { orderId: "o1", actorId: "admin", cause: "PAYMENT_RECORDED" })

    expect(outcome.activated).toBe(false)
    expect(state.created).toEqual([])
  })

  it("never creates a second shipment", async () => {
    state.ledger = vehicleLedger(10_000, { shipmentStatus: TrackingStatus.PURCHASED })

    const outcome = await activateTrackingInTransaction(tx, { orderId: "o1", actorId: "admin", cause: "PAYMENT_RECORDED" })

    expect(outcome).toEqual({ activated: false, reason: "This order already has a shipment." })
    expect(state.created).toEqual([])
  })

  it("does not start tracking on a cancelled order", async () => {
    state.ledger = vehicleLedger(10_000, { orderStatus: OrderStatus.CANCELLED })

    expect((await activateTrackingInTransaction(tx, { orderId: "o1", actorId: "admin", cause: "MANUAL" })).activated).toBe(false)
    expect(state.created).toEqual([])
  })

  it("starts a parts order at its own opening status, without a vehicle", async () => {
    state.ledger = {
      orderStatus: OrderStatus.AWAITING_PAYMENT,
      orderType: OrderType.SPARE_PART,
      totalAmount: 240,
      rows: [{ id: "p1", sequence: 1, label: "Payment", amountDue: 240, status: MilestoneStatus.DUE, triggerStatus: null, becameDueAt: null }],
      confirmed: [{ amount: 240, milestoneId: "p1" }],
      shipmentStatus: null,
    }

    await activateTrackingInTransaction(tx, { orderId: "o2", actorId: "admin", cause: "PAYMENT_RECORDED" })

    expect(state.created[0]).toMatchObject({
      shipmentType: ShipmentType.SPARE_PART,
      currentStatus: TrackingStatus.ORDER_CONFIRMED,
      vehicleId: null,
    })
  })
})
