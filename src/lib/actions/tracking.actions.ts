"use server"

import { revalidatePath } from "next/cache"

import { OrderType, ShipmentType } from "@/generated/prisma/enums"
import { recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { initialTrackingStatusFor, trackingTimelineFor } from "@/lib/constants/tracking-status"
import { prisma } from "@/lib/prisma"
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
 * Every write here follows the schema documentation's rule for this domain:
 * `Shipment.currentStatus` is a maintained column, updated in the same
 * transaction as the `TrackingEvent` that justifies the change, so the two
 * can never drift apart. Corrections use the void mechanism — an erroneous
 * event is annotated, never deleted, which is what keeps the audit trail
 * trustworthy.
 */

interface TrackingActionState {
  status: "idle" | "success" | "error"
  message?: string
}

function shipmentTypeFor(orderType: OrderType): ShipmentType {
  return orderType === OrderType.VEHICLE ? ShipmentType.VEHICLE : ShipmentType.SPARE_PART
}

/**
 * Activates tracking for an order: creates its `Shipment` with a
 * system-generated tracking number, at the opening status for its type.
 *
 * Per the schema documentation, a shipment is deliberately not created at
 * the same time as the order — this is the explicit "we are ready to start
 * tracking this" step an operator takes once the order reaches the right
 * operational stage. `Order.shipments` is one-to-many for Wave B's sake, but
 * Wave A only ever creates one per order, so a second call for the same
 * order is refused rather than silently creating a duplicate consignment.
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
      items: { select: { vehicleId: true }, take: 1 },
      shipments: { select: { id: true }, take: 1 },
    },
  })

  if (!order) {
    return { status: "error", message: "That order no longer exists." }
  }

  if (order.shipments.length > 0) {
    return { status: "error", message: "This order already has a shipment." }
  }

  const shipmentType = shipmentTypeFor(order.type)

  try {
    await prisma.$transaction(async (tx) => {
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
    })
  } catch (error) {
    console.error("[tracking] failed to create shipment", error)
    return { status: "error", message: "Could not activate tracking. Please try again." }
  }

  revalidatePath(`${ADMIN_BASE_PATH}/orders/${orderId}`)

  return { status: "success", message: "Tracking activated." }
}

/**
 * Records a tracking event and advances the shipment's current status in one
 * transaction — the pairing the schema documentation requires so a reader
 * never sees one updated without the other.
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
    select: { id: true, orderId: true, shipmentType: true },
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

  try {
    await prisma.$transaction(async (tx) => {
      const event = await tx.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          status,
          location: location ?? null,
          notes: notes ?? null,
          eventDate: eventDate ?? new Date(),
          createdByAdminId: auth.admin.id,
        },
        select: { id: true },
      })

      await tx.shipment.update({
        where: { id: shipment.id },
        data: { currentStatus: status, currentLocation: location ?? undefined },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "TRACKING_EVENT_ADDED",
          entityType: "TrackingEvent",
          entityId: event.id,
          metadata: { shipmentId: shipment.id, status },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[tracking] failed to record event", error)
    return { status: "error", message: "Could not record this update. Please try again." }
  }

  revalidatePath(`${ADMIN_BASE_PATH}/orders/${shipment.orderId}`)

  return { status: "success", message: "Tracking updated." }
}

/**
 * Corrects a mistaken tracking event by voiding it — never deleted, per the
 * schema's audit-trail rule. Does not touch `Shipment.currentStatus`: the
 * correct fix for a wrong status is voiding the bad event and recording a
 * new correct one, which is its own call to `addTrackingEventAction`.
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
    select: { id: true, isVoided: true, shipment: { select: { orderId: true } } },
  })

  if (!event) {
    return { status: "error", message: "That tracking event no longer exists." }
  }

  if (event.isVoided) {
    return { status: "idle" }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.trackingEvent.update({
        where: { id: trackingEventId },
        data: {
          isVoided: true,
          voidedAt: new Date(),
          voidedByAdminId: auth.admin.id,
          voidReason: reason ?? null,
        },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "TRACKING_EVENT_VOIDED",
          entityType: "TrackingEvent",
          entityId: trackingEventId,
          metadata: reason ? { reason } : undefined,
        },
        tx
      )
    })
  } catch (error) {
    console.error("[tracking] failed to void event", error)
    return { status: "error", message: "Could not void this event. Please try again." }
  }

  revalidatePath(`${ADMIN_BASE_PATH}/orders/${event.shipment.orderId}`)

  return { status: "success", message: "Event voided." }
}
