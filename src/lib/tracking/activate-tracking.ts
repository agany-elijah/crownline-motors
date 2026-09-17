import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { OrderType, ShipmentType } from "@/generated/prisma/enums"
import { recordAuditLog } from "@/lib/audit"
import { initialTrackingStatusFor } from "@/lib/constants/tracking-status"
import { ledgerStages, readOrderLedger } from "@/lib/orders/order-ledger"
import { trackingActivationProblem } from "@/lib/orders/order-lifecycle"
import { generateReference } from "@/lib/utils/generate-reference"

/**
 * Activating tracking on an order: its `Shipment`, with a system-generated
 * tracking number, at the opening status for its type.
 *
 * Shared by the two ways tracking starts:
 *
 *   - automatically, in the same transaction as the payment that makes the
 *     order eligible — a vehicle's initial payment settled, a parts order paid
 *     in full (`recordPaymentAction`) — so the customer's receipt can carry
 *     their tracking number;
 *   - by hand from the order page (`createShipmentAction`), for an order that
 *     became eligible before this was automatic.
 *
 * The caller must hold the order lock (`lockOrderLedger`). The eligibility
 * rule and "no shipment yet" are both read here, under that lock, so a
 * payment and a button press racing each other cannot create two
 * consignments or send two numbers.
 */

export type TrackingActivation =
  | { activated: true; shipmentId: string; trackingNumber: string }
  | { activated: false; reason: string }

export async function activateTrackingInTransaction(
  tx: Prisma.TransactionClient,
  input: { orderId: string; actorId: string; cause: "PAYMENT_RECORDED" | "MANUAL" }
): Promise<TrackingActivation> {
  const ledger = await readOrderLedger(tx, input.orderId)

  const problem = trackingActivationProblem({
    type: ledger.orderType,
    status: ledger.orderStatus,
    stages: ledgerStages(ledger),
  })
  if (problem) return { activated: false, reason: problem }

  if (ledger.shipmentStatus !== null) {
    return { activated: false, reason: "This order already has a shipment." }
  }

  const order = await tx.order.findUniqueOrThrow({
    where: { id: input.orderId },
    select: { items: { orderBy: { id: "asc" }, take: 1, select: { vehicleId: true } } },
  })

  const shipmentType = ledger.orderType === OrderType.VEHICLE ? ShipmentType.VEHICLE : ShipmentType.SPARE_PART

  // The prefix from Settings → Orders & tracking, read inside the transaction
  // from the row rather than a cache: it is printed on a number the customer
  // keeps. The sequence behind it is not configurable.
  const settings = await tx.businessSettings.findUnique({
    where: { id: 1 },
    select: { trackingNumberPrefix: true },
  })
  const trackingNumber = await generateReference(tx, "TRACKING", undefined, {
    trackingPrefix: settings?.trackingNumberPrefix ?? "CLM",
  })

  const shipment = await tx.shipment.create({
    data: {
      trackingNumber,
      orderId: input.orderId,
      vehicleId: shipmentType === ShipmentType.VEHICLE ? (order.items[0]?.vehicleId ?? null) : null,
      shipmentType,
      currentStatus: initialTrackingStatusFor(shipmentType),
    },
    select: { id: true },
  })

  await recordAuditLog(
    {
      actorId: input.actorId,
      action: "SHIPMENT_CREATED",
      entityType: "Shipment",
      entityId: shipment.id,
      metadata: {
        orderId: input.orderId,
        trackingNumber,
        ...(input.cause === "PAYMENT_RECORDED" ? { activatedBy: "payment" } : {}),
      },
    },
    tx
  )

  return { activated: true, shipmentId: shipment.id, trackingNumber }
}
