import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { OPEN_ORDER_STATUSES } from "@/lib/orders/order-lifecycle"

/**
 * Whether a vehicle is committed to a customer's order.
 *
 * `Vehicle.status` alone cannot answer it: RESERVED is also something an
 * operator sets by hand for a customer who has not ordered yet, and a car on
 * an order must not be released just because someone presses "Publish". An
 * open order holding the car is the fact that decides.
 *
 * Callers lock the vehicle row first (`lockVehicle`), so two operators
 * converting quotes for the same car — or one converting while another
 * republishes it — are serialised and the second sees the first's order.
 */

export async function lockVehicle(tx: Prisma.TransactionClient, vehicleId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${vehicleId} FOR UPDATE`
}

/** The open (not cancelled, not completed) order holding this vehicle, if any. */
export async function findOpenOrderForVehicle(
  tx: Prisma.TransactionClient,
  vehicleId: string
): Promise<{ orderNumber: string } | null> {
  const item = await tx.orderItem.findFirst({
    where: { vehicleId, order: { status: { in: [...OPEN_ORDER_STATUSES] } } },
    orderBy: { createdAt: "asc" },
    select: { order: { select: { orderNumber: true } } },
  })

  return item ? { orderNumber: item.order.orderNumber } : null
}
