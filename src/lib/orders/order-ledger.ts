import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import {
  PaymentStatus,
  type MilestoneStatus,
  type OrderStatus,
  type OrderType,
  type TrackingStatus,
} from "@/generated/prisma/enums"
import { summarizeOrderFinance, type OrderFinanceSummary } from "@/lib/orders/order-finance"
import type { LifecycleStage } from "@/lib/orders/order-lifecycle"

/**
 * An order's money and journey, read inside a transaction.
 *
 * ── Why every writer locks the order row first ────────────────────────
 * Payments, tracking updates, corrections and cancellation all change the
 * order's maintained columns (its status, its stages' statuses) from a view
 * of the ledger. Two of them running at once would each act on a view the
 * other is about to change — a payment passing the balance check while a
 * reversal lands, a delivery recorded while the final payment is reversed.
 * `SELECT ... FOR UPDATE` on the order serialises every one of them, and
 * taking that one lock first everywhere keeps the lock order consistent, so
 * they queue rather than deadlock.
 */

export interface LedgerRow {
  id: string
  sequence: number
  label: string
  amountDue: number
  status: MilestoneStatus
  triggerStatus: TrackingStatus | null
  becameDueAt: Date | null
}

export interface OrderLedger {
  orderStatus: OrderStatus
  orderType: OrderType
  totalAmount: number
  rows: LedgerRow[]
  confirmed: { amount: number; milestoneId: string | null }[]
  /** The shipment's current status, or null before tracking is activated. */
  shipmentStatus: TrackingStatus | null
}

/** Locks the order row, then reads its ledger. */
export async function lockOrderLedger(tx: Prisma.TransactionClient, orderId: string): Promise<OrderLedger> {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`

  return readOrderLedger(tx, orderId)
}

/** Reads the ledger without locking — for a transaction that already holds the lock. */
export async function readOrderLedger(tx: Prisma.TransactionClient, orderId: string): Promise<OrderLedger> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      status: true,
      type: true,
      totalAmount: true,
      shipments: { orderBy: { createdAt: "asc" }, take: 1, select: { currentStatus: true } },
    },
  })
  const milestones = await tx.paymentMilestone.findMany({
    where: { orderId },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      sequence: true,
      label: true,
      amountDue: true,
      status: true,
      triggerStatus: true,
      becameDueAt: true,
    },
  })
  const confirmed = await tx.payment.findMany({
    where: { orderId, status: PaymentStatus.CONFIRMED },
    select: { amount: true, milestoneId: true },
  })

  return {
    orderStatus: order.status,
    orderType: order.type,
    totalAmount: order.totalAmount.toNumber(),
    rows: milestones.map((row) => ({ ...row, amountDue: row.amountDue.toNumber() })),
    confirmed: confirmed.map((payment) => ({ amount: payment.amount.toNumber(), milestoneId: payment.milestoneId })),
    shipmentStatus: order.shipments[0]?.currentStatus ?? null,
  }
}

export function ledgerFinance(ledger: Pick<OrderLedger, "totalAmount" | "rows" | "confirmed">): OrderFinanceSummary {
  return summarizeOrderFinance({
    totalAmount: ledger.totalAmount,
    milestones: ledger.rows.map(({ id, sequence, label, amountDue, status }) => ({ id, sequence, label, amountDue, status })),
    payments: ledger.confirmed.map((payment) => ({ ...payment, status: PaymentStatus.CONFIRMED })),
  })
}

/** The ledger's stages in the shape the lifecycle rules read. */
export function ledgerStages(ledger: Pick<OrderLedger, "totalAmount" | "rows" | "confirmed">): LifecycleStage[] {
  const finance = ledgerFinance(ledger)

  return ledger.rows.map((row) => ({
    sequence: row.sequence,
    amountDue: row.amountDue,
    amountPaid: finance.milestones.find((milestone) => milestone.id === row.id)?.amountPaid ?? 0,
    status: row.status,
    triggerStatus: row.triggerStatus,
  }))
}
