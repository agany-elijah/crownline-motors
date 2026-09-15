"use server"

import { revalidatePath } from "next/cache"

import { recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { prisma } from "@/lib/prisma"
import { orderDeliveryDateSchema } from "@/lib/validations/order.schema"

/**
 * Server actions an operator uses to work an order.
 *
 * Payment recording, status changes and cancellation belong to a later
 * phase's admin surface (see order.queries.ts) and are not implemented
 * here. This file currently holds the one thing the order detail page lets
 * an operator edit directly: the delivery-date estimate shown to staff (and,
 * eventually, the customer) alongside the shipment's own tracking timeline.
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
