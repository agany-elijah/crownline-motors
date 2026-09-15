"use server"

import { revalidatePath } from "next/cache"

import { OrderStatus, VehicleStatus } from "@/generated/prisma/enums"
import { recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { revalidateVehicleSurfaces } from "@/lib/cache/vehicle-surfaces"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { lockOrderLedger } from "@/lib/orders/order-ledger"
import { lockVehicle } from "@/lib/orders/vehicle-holds"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils/format-currency"
import { fromCents, toCents } from "@/lib/utils/money"
import { cancelOrderSchema, orderDeliveryDateSchema } from "@/lib/validations/order.schema"

/**
 * Server actions an operator uses to work an order directly: the
 * delivery-date estimate, and cancellation.
 *
 * Payments live in payment.actions.ts and tracking in tracking.actions.ts;
 * the order's status is never set by hand — it is derived from those (see
 * order-lifecycle.ts), with cancellation the one deliberate exception.
 */

interface OrderActionState {
  status: "idle" | "success" | "error"
  message?: string
}

/**
 * Sets or clears an order's delivery-date estimate.
 *
 * Deliberately independent of `Shipment`/`TrackingEvent`: a customer can be
 * given a delivery estimate before a shipment exists at all (see the note on
 * `Order.estimatedDeliveryDate`), and revising it later never touches the
 * tracking timeline.
 */
export async function updateOrderDeliveryDateAction(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const parsed = orderDeliveryDateSchema.safeParse({
    orderId: formData.get("orderId"),
    deliveryDate: formData.get("deliveryDate"),
  })

  if (!parsed.success) {
    return { status: "error", message: "That is not a valid date." }
  }

  const auth = await authorizePermission("order:write")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const { orderId, deliveryDate } = parsed.data

  const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } })
  if (!existing) {
    return { status: "error", message: "That order no longer exists." }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { estimatedDeliveryDate: deliveryDate ?? null },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "ORDER_DELIVERY_DATE_UPDATED",
          entityType: "Order",
          entityId: orderId,
          metadata: { deliveryDate: deliveryDate ? deliveryDate.toISOString() : null },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[order] failed to update delivery date", error)
    return { status: "error", message: "Could not save the delivery date. Please try again." }
  }

  revalidatePath(`${ADMIN_BASE_PATH}/orders/${orderId}`)

  return {
    status: "success",
    message: deliveryDate ? "Delivery date saved." : "Delivery date cleared.",
  }
}

/** A refusal whose message is written for the operator. */
class CancellationRefusal extends Error {}

/**
 * Cancels an order and gives back what it was holding.
 *
 * In one transaction, under the order lock:
 *   - a vehicle the order reserved goes back on sale (RESERVED → PUBLISHED);
 *     one an operator has since marked sold or archived is left alone;
 *   - every part taken off the shelf at conversion is returned to stock,
 *     exactly the quantity recorded in `OrderItem.stockReserved`;
 *   - the order becomes CANCELLED, which nothing moves it out of.
 *
 * Refused while confirmed payments remain on the order. Money the customer
 * paid must visibly go back through the ledger first — each payment reversed
 * or refunded — so a cancelled order can never quietly hold a deposit.
 * Refused on a completed order: that sale has been delivered.
 */
export async function cancelOrderAction(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const parsed = cancelOrderSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
  })

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    return { status: "error", message: fieldErrors.reason?.[0] ?? "That order could not be found." }
  }

  const auth = await authorizePermission("order:cancel")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const { orderId, reason } = parsed.data

  const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } })
  if (!existing) {
    return { status: "error", message: "That order no longer exists." }
  }

  let released: {
    vehicles: { id: string; slug: string }[]
    parts: { id: string; slug: string; quantity: number }[]
  }

  try {
    released = await prisma.$transaction(async (tx) => {
      const ledger = await lockOrderLedger(tx, orderId)

      if (ledger.orderStatus === OrderStatus.CANCELLED) {
        throw new CancellationRefusal("This order is already cancelled.")
      }

      if (ledger.orderStatus === OrderStatus.COMPLETED) {
        throw new CancellationRefusal("This order has been delivered and completed, so it cannot be cancelled.")
      }

      const heldCents = ledger.confirmed.reduce((sum, payment) => sum + toCents(payment.amount), 0)

      if (heldCents > 0) {
        throw new CancellationRefusal(
          `${formatCurrency(fromCents(heldCents))} in confirmed payments is still recorded on this order. Reverse or refund each payment first, so the ledger shows the money returned.`
        )
      }

      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: {
          id: true,
          stockReserved: true,
          vehicle: { select: { id: true, slug: true, referenceNumber: true } },
          sparePart: { select: { id: true, slug: true, referenceNumber: true } },
        },
      })

      const vehicles: { id: string; slug: string }[] = []
      const parts: { id: string; slug: string; quantity: number }[] = []

      for (const item of items) {
        if (item.vehicle) {
          await lockVehicle(tx, item.vehicle.id)

          const relisted = await tx.vehicle.updateMany({
            where: { id: item.vehicle.id, status: VehicleStatus.RESERVED },
            data: { status: VehicleStatus.PUBLISHED },
          })

          if (relisted.count > 0) {
            vehicles.push({ id: item.vehicle.id, slug: item.vehicle.slug })

            await recordAuditLog(
              {
                actorId: auth.admin.id,
                action: "VEHICLE_STATUS_CHANGED",
                entityType: "Vehicle",
                entityId: item.vehicle.id,
                metadata: {
                  referenceNumber: item.vehicle.referenceNumber,
                  previousStatus: VehicleStatus.RESERVED,
                  newStatus: VehicleStatus.PUBLISHED,
                  reason: "ORDER_CANCELLED",
                  orderId,
                },
              },
              tx
            )
          }
        } else if (item.sparePart && item.stockReserved > 0) {
          await tx.sparePart.update({
            where: { id: item.sparePart.id },
            data: { stockQuantity: { increment: item.stockReserved } },
          })

          // Zeroed so the same stock can never be returned twice.
          await tx.orderItem.update({ where: { id: item.id }, data: { stockReserved: 0 } })

          parts.push({ id: item.sparePart.id, slug: item.sparePart.slug, quantity: item.stockReserved })

          await recordAuditLog(
            {
              actorId: auth.admin.id,
              action: "SPARE_PART_STOCK_RELEASED",
              entityType: "SparePart",
              entityId: item.sparePart.id,
              metadata: {
                referenceNumber: item.sparePart.referenceNumber,
                quantity: item.stockReserved,
                orderId,
              },
            },
            tx
          )
        }
      }

      await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "ORDER_CANCELLED",
          entityType: "Order",
          entityId: orderId,
          metadata: {
            previousStatus: ledger.orderStatus,
            reason,
            relistedVehicleIds: vehicles.map((vehicle) => vehicle.id),
            releasedStock: parts.map((part) => ({ sparePartId: part.id, quantity: part.quantity })),
          },
        },
        tx
      )

      return { vehicles, parts }
    })
  } catch (error) {
    if (error instanceof CancellationRefusal) {
      return { status: "error", message: error.message }
    }

    console.error("[order] failed to cancel order", error)
    return { status: "error", message: "Could not cancel this order. Please try again." }
  }

  revalidatePath(`${ADMIN_BASE_PATH}/orders`)
  revalidatePath(`${ADMIN_BASE_PATH}/orders/${orderId}`)

  for (const vehicle of released.vehicles) {
    revalidateVehicleSurfaces(vehicle.id, vehicle.slug)
  }

  if (released.parts.length > 0) {
    revalidatePath(`${ADMIN_BASE_PATH}/spare-parts`)
    revalidatePath("/spare-parts")

    for (const part of released.parts) {
      revalidatePath(`${ADMIN_BASE_PATH}/spare-parts/${part.id}`)
      revalidatePath(`/spare-parts/${part.slug}`)
    }
  }

  const releasedNotes = [
    released.vehicles.length > 0 ? "the vehicle is back on sale" : null,
    released.parts.length > 0 ? "reserved parts are back in stock" : null,
  ].filter(Boolean)

  return {
    status: "success",
    message: `Order cancelled${releasedNotes.length > 0 ? ` — ${releasedNotes.join(" and ")}` : ""}.`,
  }
}
