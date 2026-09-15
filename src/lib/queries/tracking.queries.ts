import "server-only"

import type { ShipmentType, TrackingStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import type { TrackingLookup } from "@/lib/tracking/tracking-number"

/**
 * The public "Track My Order" read.
 *
 * ── What a tracking number reveals, and what it does not ──────────────
 * A tracking number is short, sequential and sent over WhatsApp, so it is
 * treated as something a stranger could guess. It reveals the journey — what
 * is being shipped, its stages, dates and locations — and nothing about the
 * person: no name, contact detail, price, balance or order number. Staff
 * notes on tracking events are internal and never selected, and voided
 * events never appear. The page that calls this also rate-limits lookups.
 */

export interface PublicTrackingEvent {
  status: TrackingStatus
  eventDate: Date
  location: string | null
}

export interface PublicTrackingResult {
  kind: "FOUND"
  trackingNumber: string
  shipmentType: ShipmentType
  currentStatus: TrackingStatus
  currentLocation: string | null
  subject: string
  /** Oldest first. */
  events: PublicTrackingEvent[]
  lastUpdated: Date
}

export type PublicTrackingOutcome =
  | PublicTrackingResult
  /**
   * An order number with nothing to show — whether no such order exists or
   * its tracking has not started. One answer for both, because order numbers
   * are sequential: telling the two apart would let anyone walk the sequence
   * and learn which orders exist.
   */
  | { kind: "ORDER_UNTRACKED"; orderNumber: string }
  | { kind: "NOT_FOUND" }

async function findShipment(trackingNumber: string): Promise<PublicTrackingResult | null> {
  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
    select: {
      trackingNumber: true,
      shipmentType: true,
      currentStatus: true,
      currentLocation: true,
      updatedAt: true,
      vehicle: { select: { year: true, make: true, model: true } },
      order: { select: { items: { select: { description: true } } } },
      events: {
        where: { isVoided: false },
        orderBy: { eventDate: "asc" },
        select: { status: true, eventDate: true, location: true },
      },
    },
  })

  if (!shipment) return null

  const items = shipment.order.items
  const subject = shipment.vehicle
    ? `${shipment.vehicle.year} ${shipment.vehicle.make} ${shipment.vehicle.model}`
    : items.length === 1
      ? items[0].description
      : `${items.length} items`

  const latestEvent = shipment.events[shipment.events.length - 1]

  return {
    kind: "FOUND",
    trackingNumber: shipment.trackingNumber,
    shipmentType: shipment.shipmentType,
    currentStatus: shipment.currentStatus,
    currentLocation: shipment.currentLocation,
    subject,
    events: shipment.events,
    lastUpdated:
      latestEvent && latestEvent.eventDate > shipment.updatedAt ? latestEvent.eventDate : shipment.updatedAt,
  }
}

export async function lookupPublicTracking(lookup: TrackingLookup): Promise<PublicTrackingOutcome> {
  if (lookup.kind === "TRACKING") {
    return (await findShipment(lookup.value)) ?? { kind: "NOT_FOUND" }
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: lookup.value },
    select: { shipments: { select: { trackingNumber: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  })

  const trackingNumber = order?.shipments[0]?.trackingNumber
  const untracked = { kind: "ORDER_UNTRACKED", orderNumber: lookup.value } as const

  if (!trackingNumber) return untracked

  return (await findShipment(trackingNumber)) ?? untracked
}
