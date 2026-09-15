"use server"

import { revalidatePath } from "next/cache"

import { OrderStatus, OrderType, ShipmentType } from "@/generated/prisma/enums"
import { recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { revalidateVehicleSurfaces } from "@/lib/cache/vehicle-surfaces"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import {
  TRACKING_STATUS_LABELS,
  initialTrackingStatusFor,
  trackingTimelineFor,
} from "@/lib/constants/tracking-status"
import {
  notificationNotice,
  notifyCustomerTrackingActivated,
  notifyCustomerTrackingUpdate,
  resolveOrderContact,
} from "@/lib/email/notifications"
import { ledgerFinance, ledgerStages, lockOrderLedger } from "@/lib/orders/order-ledger"
import { trackingActivationProblem } from "@/lib/orders/order-lifecycle"
import { syncOrderStatus, type OrderStatusSync } from "@/lib/orders/order-status-sync"
import { prisma } from "@/lib/prisma"
import { requiresFullPayment } from "@/lib/tracking/journey-rules"
import { syncJourney, type JourneySync } from "@/lib/tracking/journey-sync"
import { formatCurrency } from "@/lib/utils/format-currency"
import { generateReference } from "@/lib/utils/generate-reference"
import {
  addTrackingEventSchema,
  createShipmentSchema,
  voidTrackingEventSchema,
} from "@/lib/validations/tracking.schema"

/**
 * Server actions for the shipment/tracking surface an operator works
 * directly from an order: activating tracking, recording an event, and
 * correcting a mistaken one.
 *
 * Every write locks the order first (see order-ledger.ts) and then rebuilds
 * what the journey decides — the shipment's current status and location,
 * the payment stages its steps make due, and the order's status — from the
 * live events, in the same transaction (see journey-sync.ts). So a skipped
 * step, a backdated update and a voided mistake all leave the order in the
 * state its events actually describe. Corrections use the void mechanism —
 * an erroneous event is annotated, never deleted, which is what keeps the
 * audit trail trustworthy.
 */

interface TrackingActionState {
  status: "idle" | "success" | "error"
  message?: string
}

/** A refusal whose message is written for the operator. */
class TrackingRefusal extends Error {}

function shipmentTypeFor(orderType: OrderType): ShipmentType {
  return orderType === OrderType.VEHICLE ? ShipmentType.VEHICLE : ShipmentType.SPARE_PART
}

function revalidateOrderSurfaces(orderId: string, order: OrderStatusSync): void {
  revalidatePath(`${ADMIN_BASE_PATH}/orders`)
  revalidatePath(`${ADMIN_BASE_PATH}/orders/${orderId}`)

  for (const vehicle of order.changedVehicles) {
    revalidateVehicleSurfaces(vehicle.id, vehicle.slug)
  }
}

function orderStatusNotice(order: OrderStatusSync): string {
  return order.next !== order.previous ? ` The order is now ${order.next.replaceAll("_", " ").toLowerCase()}.` : ""
}

/**
 * Activates tracking for an order: creates its `Shipment` with a
 * system-generated tracking number, at the opening status for its type.
 *
 * Per the schema documentation, a shipment is deliberately not created at
 * the same time as the order — tracking starts once the business has
 * committed to the journey: a vehicle once its initial payment is settled, a
 * parts order once it is paid in full (`trackingActivationProblem`). Both
 * that check and "does this order already have a shipment" run under the
 * order lock, so a double-click cannot create two consignments and email two
 * tracking numbers.
 */
export async function createShipmentAction(
  _prevState: TrackingActionState,
  formData: FormData
): Promise<TrackingActionState> {
  const parsed = createShipmentSchema.safeParse({ orderId: formData.get("orderId") })

  if (!parsed.success) {
    return { status: "error", message: "That order could not be found." }
  }

  const auth = await authorizePermission("tracking:write")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const { orderId } = parsed.data

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      type: true,
      orderNumber: true,
      items: { select: { vehicleId: true, description: true } },
      quote: { select: { contactEmail: true, contactName: true } },
      customer: { select: { email: true, fullName: true, deletedAt: true } },
    },
  })

  if (!order) {
    return { status: "error", message: "That order no longer exists." }
  }

  const shipmentType = shipmentTypeFor(order.type)

  let created: { shipmentId: string; trackingNumber: string; order: OrderStatusSync }

  try {
    created = await prisma.$transaction(async (tx) => {
      const ledger = await lockOrderLedger(tx, order.id)

      const problem = trackingActivationProblem({
        type: ledger.orderType,
        status: ledger.orderStatus,
        stages: ledgerStages(ledger),
      })
      if (problem) throw new TrackingRefusal(problem)

      if (ledger.shipmentStatus !== null) {
        throw new TrackingRefusal("This order already has a shipment.")
      }

      const trackingNumber = await generateReference(tx, "TRACKING")

      const shipment = await tx.shipment.create({
        data: {
          trackingNumber,
          orderId: order.id,
          vehicleId: shipmentType === ShipmentType.VEHICLE ? (order.items[0]?.vehicleId ?? null) : null,
          shipmentType,
          currentStatus: initialTrackingStatusFor(shipmentType),
        },
        select: { id: true },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "SHIPMENT_CREATED",
          entityType: "Shipment",
          entityId: shipment.id,
          metadata: { orderId: order.id, trackingNumber },
        },
        tx
      )

      const orderSync = await syncOrderStatus(tx, {
        orderId: order.id,
        actorId: auth.admin.id,
        cause: "SHIPMENT_CREATED",
      })

      return { shipmentId: shipment.id, trackingNumber, order: orderSync }
    })
  } catch (error) {
    if (error instanceof TrackingRefusal) {
      return { status: "error", message: error.message }
    }

    console.error("[tracking] failed to create shipment", error)
    return { status: "error", message: "Could not activate tracking. Please try again." }
  }

  revalidateOrderSurfaces(orderId, created.order)

  // The tracking number reaches the customer without anyone having to send it.
  const contact = resolveOrderContact(order)
  const [firstItem, ...otherItems] = order.items
  const emailOutcome = await notifyCustomerTrackingActivated({
    to: contact.email,
    customerName: contact.name,
    shipmentId: created.shipmentId,
    orderNumber: order.orderNumber,
    trackingNumber: created.trackingNumber,
    subject: firstItem
      ? otherItems.length > 0
        ? `${firstItem.description} and ${otherItems.length} more`
        : firstItem.description
      : order.orderNumber,
  })

  return {
    status: "success",
    message: `Tracking activated: ${created.trackingNumber}.${orderStatusNotice(created.order)} ${notificationNotice(emailOutcome)}`,
  }
}

/**
 * Records a tracking event, then rebuilds the journey from the live events.
 *
 * Refused on a cancelled order, and refused for any step that requires the
 * order to be paid in full while money is still owed — a vehicle is not
 * handed over, and parts are not packed, against an open balance
 * (`requiresFullPayment`).
 */
export async function addTrackingEventAction(
  _prevState: TrackingActionState,
  formData: FormData
): Promise<TrackingActionState> {
  const parsed = addTrackingEventSchema.safeParse({
    shipmentId: formData.get("shipmentId"),
    status: formData.get("status"),
    location: formData.get("location"),
    notes: formData.get("notes"),
    eventDate: formData.get("eventDate"),
  })

  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields and try again." }
  }

  const auth = await authorizePermission("tracking:write")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const { shipmentId, status, location, notes, eventDate } = parsed.data

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      orderId: true,
      shipmentType: true,
      trackingNumber: true,
      order: {
        select: {
          quote: { select: { contactEmail: true, contactName: true } },
          customer: { select: { email: true, fullName: true, deletedAt: true } },
        },
      },
    },
  })

  if (!shipment) {
    return { status: "error", message: "That shipment no longer exists." }
  }

  // The status list a select element offers is the honour system; a
  // crafted request could name any TrackingStatus. Refusing one that does
  // not belong to this shipment's own timeline is what makes that a rule
  // rather than a suggestion — see trackingTimelineFor.
  if (!trackingTimelineFor(shipment.shipmentType).includes(status)) {
    return { status: "error", message: "That status does not apply to this shipment." }
  }

  const effectiveDate = eventDate ?? new Date()
  let recorded: { eventId: string; journey: JourneySync }

  try {
    recorded = await prisma.$transaction(async (tx) => {
      const ledger = await lockOrderLedger(tx, shipment.orderId)

      if (ledger.orderStatus === OrderStatus.CANCELLED) {
        throw new TrackingRefusal("This order is cancelled, so its tracking cannot be updated.")
      }

      if (requiresFullPayment(shipment.shipmentType, status)) {
        const { balance } = ledgerFinance(ledger)

        if (balance > 0) {
          throw new TrackingRefusal(
            `"${TRACKING_STATUS_LABELS[status]}" can only be recorded once the order is paid in full — ${formatCurrency(balance)} is still owed.`
          )
        }
      }

      const event = await tx.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          status,
          location: location ?? null,
          notes: notes ?? null,
          eventDate: effectiveDate,
          createdByAdminId: auth.admin.id,
        },
        select: { id: true },
      })

      const journey = await syncJourney(tx, {
        orderId: shipment.orderId,
        shipmentId: shipment.id,
        shipmentType: shipment.shipmentType,
        actorId: auth.admin.id,
        cause: "TRACKING_EVENT_ADDED",
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "TRACKING_EVENT_ADDED",
          entityType: "TrackingEvent",
          entityId: event.id,
          metadata: {
            shipmentId: shipment.id,
            status,
            currentStatus: journey.currentStatus,
            ...(journey.openedStages.length > 0
              ? { openedMilestoneIds: journey.openedStages.map((stage) => stage.id) }
              : {}),
          },
        },
        tx
      )

      return { eventId: event.id, journey }
    })
  } catch (error) {
    if (error instanceof TrackingRefusal) {
      return { status: "error", message: error.message }
    }

    console.error("[tracking] failed to record event", error)
    return { status: "error", message: "Could not record this update. Please try again." }
  }

  const { journey } = recorded
  revalidateOrderSurfaces(shipment.orderId, journey.order)

  const becameCurrent = journey.currentEventId === recorded.eventId
  const dueStage = journey.openedStages[0] ?? null
  const historyNotice = becameCurrent
    ? ""
    : ` It is dated before the latest update, so tracking still shows "${TRACKING_STATUS_LABELS[journey.currentStatus]}".`
  const dueNotice = dueStage
    ? ` The ${dueStage.label.toLowerCase()} (${formatCurrency(dueStage.amountDue)}) is now due.`
    : ""

  // An earlier step filled in after the fact is history, not news — unless
  // it made a payment due, which the customer must hear about.
  if (!becameCurrent && !dueStage) {
    return {
      status: "success",
      message: `Tracking updated.${historyNotice}${orderStatusNotice(journey.order)} The customer was not emailed about an earlier step.`,
    }
  }

  const contact = resolveOrderContact(shipment.order)
  const emailOutcome = await notifyCustomerTrackingUpdate({
    to: contact.email,
    customerName: contact.name,
    eventId: recorded.eventId,
    trackingNumber: shipment.trackingNumber,
    // Always where the shipment is now: an email about a backdated step that
    // opened a payment must not tell the customer their car moved backwards.
    statusLabel: TRACKING_STATUS_LABELS[journey.currentStatus],
    location: journey.currentLocation,
    eventDate: becameCurrent ? effectiveDate : new Date(),
    paymentNowDue: dueStage ? { label: dueStage.label, amount: dueStage.amountDue } : null,
  })

  return {
    status: "success",
    message: `Tracking updated.${historyNotice}${dueNotice}${orderStatusNotice(journey.order)} ${notificationNotice(emailOutcome)}`,
  }
}

/**
 * Corrects a mistaken tracking event by voiding it — never deleted, per the
 * schema's audit-trail rule — and rebuilds the journey without it: the
 * shipment falls back to its latest remaining event, a payment stage only
 * the voided event had made due is no longer due, and an order completed by
 * a voided delivery is reopened.
 */
export async function voidTrackingEventAction(
  _prevState: TrackingActionState,
  formData: FormData
): Promise<TrackingActionState> {
  const parsed = voidTrackingEventSchema.safeParse({
    trackingEventId: formData.get("trackingEventId"),
    reason: formData.get("reason"),
  })

  if (!parsed.success) {
    return { status: "error", message: "That tracking event could not be found." }
  }

  const auth = await authorizePermission("tracking:void")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const { trackingEventId, reason } = parsed.data

  const event = await prisma.trackingEvent.findUnique({
    where: { id: trackingEventId },
    select: {
      id: true,
      isVoided: true,
      shipment: { select: { id: true, orderId: true, shipmentType: true } },
    },
  })

  if (!event) {
    return { status: "error", message: "That tracking event no longer exists." }
  }

  if (event.isVoided) {
    return { status: "idle" }
  }

  const { shipment } = event
  let journey: JourneySync | null

  try {
    journey = await prisma.$transaction(async (tx) => {
      await lockOrderLedger(tx, shipment.orderId)

      // Conditional on still being live, so a void racing another void of
      // the same event changes nothing the second time.
      const voided = await tx.trackingEvent.updateMany({
        where: { id: trackingEventId, isVoided: false },
        data: {
          isVoided: true,
          voidedAt: new Date(),
          voidedByAdminId: auth.admin.id,
          voidReason: reason ?? null,
        },
      })

      if (voided.count === 0) return null

      const result = await syncJourney(tx, {
        orderId: shipment.orderId,
        shipmentId: shipment.id,
        shipmentType: shipment.shipmentType,
        actorId: auth.admin.id,
        cause: "TRACKING_EVENT_VOIDED",
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "TRACKING_EVENT_VOIDED",
          entityType: "TrackingEvent",
          entityId: trackingEventId,
          metadata: {
            ...(reason ? { reason } : {}),
            currentStatus: result.currentStatus,
            ...(result.closedStageIds.length > 0 ? { closedMilestoneIds: result.closedStageIds } : {}),
          },
        },
        tx
      )

      return result
    })
  } catch (error) {
    console.error("[tracking] failed to void event", error)
    return { status: "error", message: "Could not void this event. Please try again." }
  }

  if (!journey) {
    return { status: "idle" }
  }

  revalidateOrderSurfaces(shipment.orderId, journey.order)

  const closed = journey.closedStageIds.length
  const closedNotice =
    closed === 0
      ? ""
      : closed === 1
        ? " A payment stage it had made due is no longer due."
        : ` ${closed} payment stages it had made due are no longer due.`

  return {
    status: "success",
    message: `Event voided. Tracking now shows "${TRACKING_STATUS_LABELS[journey.currentStatus]}".${closedNotice}${orderStatusNotice(journey.order)}`,
  }
}
