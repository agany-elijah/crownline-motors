import "server-only"

import type { ShipmentType, TrackingStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { sparePartPhotoPublicUrl } from "@/lib/storage/spare-part-media"
import { vehiclePhotoPublicUrl } from "@/lib/storage/vehicle-media"
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
 *
 * The expected delivery window and the main photograph are journey facts in
 * the same sense: when it should arrive, and a picture of what is coming —
 * the listing photograph, which the catalogue already published.
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
  /** The main photograph of the vehicle, or of the first part, when there is one. */
  imageUrl: string | null
  /** When staff expect it to arrive — a single day when `latest` is null. Null when not given. */
  expectedDelivery: { earliest: Date; latest: Date | null } | null
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

/** The main photograph only — one row, never the gallery. */
const PRIMARY_PHOTO = {
  where: { deletedAt: null, isPrimary: true },
  select: { storagePath: true },
  take: 1,
} as const

async function findShipment(trackingNumber: string): Promise<PublicTrackingResult | null> {
  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
    select: {
      trackingNumber: true,
      shipmentType: true,
      currentStatus: true,
      currentLocation: true,
      updatedAt: true,
      vehicle: {
        select: {
          year: true,
          make: true,
          model: true,
          photos: PRIMARY_PHOTO,
        },
      },
      order: {
        select: {
          estimatedDeliveryDate: true,
          estimatedDeliveryLatest: true,
          items: {
            orderBy: { id: "asc" },
            select: { description: true, sparePart: { select: { photos: PRIMARY_PHOTO } } },
          },
        },
      },
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

  const vehiclePhoto = shipment.vehicle?.photos[0]
  const partPhoto = items.find((item) => item.sparePart?.photos[0])?.sparePart?.photos[0]
  const { estimatedDeliveryDate, estimatedDeliveryLatest } = shipment.order

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
    imageUrl: vehiclePhoto
      ? vehiclePhotoPublicUrl(vehiclePhoto.storagePath)
      : partPhoto
        ? sparePartPhotoPublicUrl(partPhoto.storagePath)
        : null,
    expectedDelivery: estimatedDeliveryDate
      ? { earliest: estimatedDeliveryDate, latest: estimatedDeliveryLatest }
      : null,
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
