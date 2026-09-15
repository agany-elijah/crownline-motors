import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { OrderStatus, VehicleStatus } from "@/generated/prisma/enums"
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
 * Brings an order's status into line with its ledger and journey, and the
 * listing status of the vehicle it sold with it.
 *
 * Must run inside the transaction that made the change, after the order row
 * has been locked (see order-ledger.ts), and after every other write that
 * transaction makes — it re-reads the ledger rather than trusting a caller's
 * in-memory copy.
 *
 * A vehicle order that completes marks its car SOLD; one reopened by voiding
 * the delivery puts it back to RESERVED. Both only move a car still in the
 * state the order left it in, so a car an operator has since archived is
 * never pulled back.
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

  const changedVehicles: { id: string; slug: string }[] = []
  const completing = next === OrderStatus.COMPLETED
  const reopening = previous === OrderStatus.COMPLETED

  if (completing || reopening) {
    const from = completing ? VehicleStatus.RESERVED : VehicleStatus.SOLD
    const to = completing ? VehicleStatus.SOLD : VehicleStatus.RESERVED

    const items = await tx.orderItem.findMany({
      where: { orderId: input.orderId, vehicleId: { not: null } },
      select: { vehicle: { select: { id: true, slug: true, referenceNumber: true } } },
    })

    for (const { vehicle } of items) {
      if (!vehicle) continue

      const moved = await tx.vehicle.updateMany({ where: { id: vehicle.id, status: from }, data: { status: to } })
      if (moved.count === 0) continue

      changedVehicles.push({ id: vehicle.id, slug: vehicle.slug })

      await recordAuditLog(
        {
          actorId: input.actorId,
          action: "VEHICLE_STATUS_CHANGED",
          entityType: "Vehicle",
          entityId: vehicle.id,
          metadata: {
            referenceNumber: vehicle.referenceNumber,
            previousStatus: from,
            newStatus: to,
            reason: completing ? "ORDER_COMPLETED" : "ORDER_REOPENED",
            orderId: input.orderId,
          },
        },
        tx
      )
    }
  }

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
