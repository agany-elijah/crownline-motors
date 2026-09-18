"use server"

import { revalidatePath } from "next/cache"

import { OrderStatus, PaymentStatus, VehicleStatus } from "@/generated/prisma/enums"
import { recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { revalidateVehicleSurfaces } from "@/lib/cache/vehicle-surfaces"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { nextMilestoneStatus } from "@/lib/orders/order-finance"
import { lockOrderLedger } from "@/lib/orders/order-ledger"
import { hasMilestoneOpened } from "@/lib/orders/payment-recording"
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
    deliveryDateLatest: formData.get("deliveryDateLatest"),
  })

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "That is not a valid date." }
  }

  const auth = await authorizePermission("order:write")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const { orderId, deliveryDate, deliveryDateLatest } = parsed.data

  const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } })
  if (!existing) {
    return { status: "error", message: "That order no longer exists." }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          estimatedDeliveryDate: deliveryDate ?? null,
          estimatedDeliveryLatest: deliveryDateLatest ?? null,
        },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "ORDER_DELIVERY_DATE_UPDATED",
          entityType: "Order",
          entityId: orderId,
          metadata: {
            deliveryDate: deliveryDate ? deliveryDate.toISOString() : null,
            deliveryDateLatest: deliveryDateLatest ? deliveryDateLatest.toISOString() : null,
          },
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
    message: deliveryDate
      ? deliveryDateLatest
        ? "Expected delivery window saved. Customers see it on Track My Order."
        : "Expected delivery date saved. Customers see it on Track My Order."
      : "Expected delivery cleared.",
  }
}

/** A refusal whose message is written for the operator. */
class CancellationRefusal extends Error {}

/**
 * Cancels an order and gives back what it was holding.
 *
 * In one transaction, under the order lock:
 *   - a vehicle an older order reserved goes back on sale (RESERVED →
 *     PUBLISHED); one an operator has since marked sold or archived is left
 *     alone. New orders take no such hold — see create-order-from-quote.ts —
 *     so this only ever finds a car reserved before that rule changed;
 *   - every part taken off the shelf at conversion is returned to stock,
 *     exactly the quantity recorded in `OrderItem.stockReserved`;
 *   - when the operator asked for it, every confirmed payment is marked
 *     REFUNDED and the stage rows are recomputed to match;
 *   - the order becomes CANCELLED, which nothing moves it out of.
 *
 * Confirmed payments do **not** refuse the cancellation. The operator is
 * warned, names the reason, and says whether the money has gone back; what
 * they decide is recorded on the audit entry either way. Still refused on a
 * completed order: that sale has been delivered.
 */
export async function cancelOrderAction(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const parsed = cancelOrderSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
    refundPayments: formData.get("refundPayments"),
  })

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    return { status: "error", message: fieldErrors.reason?.[0] ?? "That order could not be found." }
  }

  const auth = await authorizePermission("order:cancel")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const { orderId, reason, refundPayments } = parsed.data

  const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } })
  if (!existing) {
    return { status: "error", message: "That order no longer exists." }
  }

  let released: {
    vehicles: { id: string; slug: string }[]
    parts: { id: string; slug: string; quantity: number }[]
    heldCents: number
    refundedCents: number
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

      /**
       * Money already taken does not block the cancellation.
       *
       * It used to: a confirmed payment refused the whole action until every
       * one had been reversed from the payments panel. That left an operator
       * unable to close a dead order in the moment it died — the customer
       * withdraws, the supplier falls through — and the order stayed open,
       * holding stock, while the refunds were chased. The warning the dialog
       * shows before this point is what protects the operator now; the
       * ledger records what was held either way.
       */
      const heldCents = ledger.confirmed.reduce((sum, payment) => sum + toCents(payment.amount), 0)
      let refundedCents = 0

      if (heldCents > 0 && refundPayments) {
        const note = `Refunded by ${auth.admin.displayName} on ${new Date().toISOString().slice(0, 10)}: order cancelled — ${reason}`

        const confirmedPayments = await tx.payment.findMany({
          where: { orderId, status: PaymentStatus.CONFIRMED },
          select: { id: true, amount: true, milestoneId: true, adminNotes: true },
        })

        for (const payment of confirmedPayments) {
          // Conditional on still being CONFIRMED, so this cannot race a
          // reversal of the same payment from the payments panel.
          const updated = await tx.payment.updateMany({
            where: { id: payment.id, status: PaymentStatus.CONFIRMED },
            data: {
              status: PaymentStatus.REFUNDED,
              adminNotes: payment.adminNotes ? `${payment.adminNotes}\n${note}` : note,
            },
          })

          if (updated.count === 0) continue

          refundedCents += toCents(payment.amount.toNumber())

          await recordAuditLog(
            {
              actorId: auth.admin.id,
              action: "PAYMENT_REVERSED",
              entityType: "Payment",
              entityId: payment.id,
              metadata: {
                orderId,
                milestoneId: payment.milestoneId,
                amount: payment.amount.toNumber(),
                outcome: PaymentStatus.REFUNDED,
                reason: `Order cancelled — ${reason}`,
              },
            },
            tx
          )
        }

        /**
         * Every confirmed payment is now refunded, so every stage has been
         * paid nothing. Recomputed rather than blanket-set to PENDING: a
         * stage that had already opened stays DUE, which is what
         * `nextMilestoneStatus` encodes and what the payments panel would
         * have written had each payment been reversed individually.
         *
         * Without this the stage rows keep saying PAID while the amount
         * beside them — derived live from confirmed payments — reads zero.
         */
        for (const milestone of ledger.rows) {
          const status = nextMilestoneStatus({
            amountDue: milestone.amountDue,
            amountPaid: 0,
            wasDue: hasMilestoneOpened(milestone),
          })

          if (status === milestone.status) continue

          await tx.paymentMilestone.update({
            where: { id: milestone.id },
            data: { status, completedAt: null },
          })
        }
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
            // What the order was holding when it was cancelled, and what
            // became of it — the question an audit of a cancelled paid order
            // is asked, answered on the cancellation record itself.
            confirmedPaymentsHeld: fromCents(heldCents),
            paymentsRefunded: refundPayments,
            refundedAmount: fromCents(refundedCents),
          },
        },
        tx
      )

      return { vehicles, parts, heldCents, refundedCents }
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
    released.refundedCents > 0 ? `${formatCurrency(fromCents(released.refundedCents))} marked refunded` : null,
  ].filter(Boolean)

  /**
   * Money left on the ledger is said out loud rather than left for the
   * operator to notice: this is the one case where the action has succeeded
   * and there is still something outstanding to do.
   */
  const outstanding =
    released.refundedCents === 0 && released.heldCents > 0
      ? ` ${formatCurrency(fromCents(released.heldCents))} in confirmed payments is still recorded against it — refund each payment from the payments panel when the money has gone back.`
      : ""

  return {
    status: "success",
    message: `Order cancelled${releasedNotes.length > 0 ? ` — ${releasedNotes.join(", ")}` : ""}.${outstanding}`,
  }
}
