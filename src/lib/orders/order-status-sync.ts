import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { OrderStatus } from "@/generated/prisma/enums"
import { recordAuditLog } from "@/lib/audit"
import { deriveOrderStatus } from "@/lib/orders/order-lifecycle"
import { ledgerStages, readOrderLedger } from "@/lib/orders/order-ledger"

export interface OrderStatusSync {
  previous: OrderStatus
  next: OrderStatus
  /** Vehicles whose listing status this change moved, for revalidation. */
  changedVehicles: { id: string; slug: string }[]
}

/**
 * Brings an order's status into line with its ledger and journey.
 *
 * Must run inside the transaction that made the change, after the order row
 * has been locked (see order-ledger.ts), and after every other write that
 * transaction makes — it re-reads the ledger rather than trusting a caller's
 * in-memory copy.
 *
 * ── Why completing an order no longer marks its car SOLD ──────────────
 * It used to: COMPLETED moved the listing RESERVED → SOLD, and voiding the
 * delivery moved it back. That modelled a dealership selling the one car on
 * its floor. This one sources from external dealers and suppliers, so a
 * listing is a vehicle it can obtain rather than a unit of stock, and one
 * completed sale says nothing about whether the next customer can buy the
 * same model. Auto-marking it SOLD took a live listing off the marketplace
 * on delivery of an unrelated order.
 *
 * SOLD and RESERVED are still real, still settable, and still refused on the
 * public catalogue — they are now operator judgements made from the vehicle's
 * own status control rather than side effects of an order's lifecycle.
 *
 * `changedVehicles` is kept on the return type: nothing populates it today,
 * and callers still spread it into their revalidation set, so a future rule
 * that does move a listing needs no change at any call site.
 */
export async function syncOrderStatus(
  tx: Prisma.TransactionClient,
  input: { orderId: string; actorId: string; cause: string }
): Promise<OrderStatusSync> {
  const ledger = await readOrderLedger(tx, input.orderId)
  const previous = ledger.orderStatus
  const next = deriveOrderStatus({
    type: ledger.orderType,
    status: previous,
    stages: ledgerStages(ledger),
    shipmentStatus: ledger.shipmentStatus,
  })

  if (next === previous) return { previous, next, changedVehicles: [] }

  await tx.order.update({ where: { id: input.orderId }, data: { status: next } })

  // An order's lifecycle no longer moves any listing — see the note above.
  const changedVehicles: { id: string; slug: string }[] = []

  await recordAuditLog(
    {
      actorId: input.actorId,
      action: "ORDER_STATUS_CHANGED",
      entityType: "Order",
      entityId: input.orderId,
      metadata: { previousStatus: previous, newStatus: next, cause: input.cause },
    },
    tx
  )

  return { previous, next, changedVehicles }
}
