import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { MilestoneStatus, type ShipmentType, type TrackingStatus } from "@/generated/prisma/enums"
import { initialTrackingStatusFor } from "@/lib/constants/tracking-status"
import { syncOrderStatus, type OrderStatusSync } from "@/lib/orders/order-status-sync"
import { currentPosition, stagesToClose, stagesToOpen } from "@/lib/tracking/journey-rules"

export interface JourneySync {
  currentStatus: TrackingStatus
  currentLocation: string | null
  /** The live event the current status comes from, or null if none remains. */
  currentEventId: string | null
  /** Stages this sync made due — the payments to tell the customer about. */
  openedStages: { id: string; label: string; amountDue: number }[]
  closedStageIds: string[]
  order: OrderStatusSync
}

/**
 * Rebuilds everything derived from a shipment's live events: its current
 * status and location, which journey-triggered payment stages are due, and
 * the order's status.
 *
 * Recomputed from the events on every change rather than patched from the
 * one just recorded, so a backdated update, a skipped step and a voided
 * mistake all land on the same answer. Runs inside the caller's transaction,
 * after the order row is locked (see order-ledger.ts).
 */
export async function syncJourney(
  tx: Prisma.TransactionClient,
  input: { orderId: string; shipmentId: string; shipmentType: ShipmentType; actorId: string; cause: string }
): Promise<JourneySync> {
  const events = await tx.trackingEvent.findMany({
    where: { shipmentId: input.shipmentId, isVoided: false },
    select: { id: true, status: true, location: true, eventDate: true, createdAt: true },
  })

  const position = currentPosition(events)
  const currentStatus = position?.status ?? initialTrackingStatusFor(input.shipmentType)

  await tx.shipment.update({
    where: { id: input.shipmentId },
    data: { currentStatus, currentLocation: position?.location ?? null },
  })

  const stages = await tx.paymentMilestone.findMany({
    where: { orderId: input.orderId },
    orderBy: { sequence: "asc" },
    select: { id: true, label: true, amountDue: true, status: true, triggerStatus: true },
  })

  const reached = position?.status ?? null
  const openIds = stagesToOpen(stages, input.shipmentType, reached)
  const closedStageIds = stagesToClose(stages, input.shipmentType, reached)

  if (openIds.length > 0) {
    await tx.paymentMilestone.updateMany({
      where: { id: { in: openIds }, status: MilestoneStatus.PENDING },
      data: { status: MilestoneStatus.DUE, becameDueAt: new Date() },
    })
  }

  if (closedStageIds.length > 0) {
    await tx.paymentMilestone.updateMany({
      where: { id: { in: closedStageIds }, status: MilestoneStatus.DUE },
      data: { status: MilestoneStatus.PENDING, becameDueAt: null },
    })
  }

  const order = await syncOrderStatus(tx, { orderId: input.orderId, actorId: input.actorId, cause: input.cause })

  return {
    currentStatus,
    currentLocation: position?.location ?? null,
    currentEventId: position?.eventId ?? null,
    openedStages: stages
      .filter((stage) => openIds.includes(stage.id))
      .map((stage) => ({ id: stage.id, label: stage.label, amountDue: stage.amountDue.toNumber() })),
    closedStageIds,
    order,
  }
}
