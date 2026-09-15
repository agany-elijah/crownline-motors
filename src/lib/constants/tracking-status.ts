import { ShipmentType, TrackingStatus } from "@/generated/prisma/enums"
import type { StatusTone } from "@/components/admin/status-badge"

/**
 * The shipment/tracking vocabulary: what each status is called, how it
 * looks, and which subset applies to a vehicle consignment versus a
 * spare-parts one.
 *
 * A customer never sees the distinction — `Shipment.shipmentType` is what
 * lets "Track My Order" pick the right timeline from a tracking number
 * alone (see the schema documentation). This file is what lets the *admin*
 * side make the same distinction: which statuses an operator is offered
 * when recording an event on a given shipment.
 */

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  PURCHASED: "Vehicle purchased",
  INSPECTION_COMPLETED: "Inspection completed",
  EXPORT_DOCUMENTATION: "Export documentation",
  EXPORTED: "Vehicle exported",
  LOADED_FOR_SHIPPING: "Loaded for shipping",
  IN_TRANSIT: "In transit",
  ARRIVED_AT_MOMBASA: "Arrived at Mombasa",
  CLEARING: "Clearing",
  TRANSPORT_TO_SOUTH_SUDAN: "Transport to South Sudan",
  READY_FOR_COLLECTION: "Ready for collection",
  DELIVERED: "Delivered",
  ORDER_CONFIRMED: "Order confirmed",
  PROCESSING: "Processing",
  PACKED: "Packed",
  DISPATCHED: "Dispatched",
  OUT_FOR_DELIVERY: "Out for delivery",
}

export const TRACKING_STATUS_TONES: Record<TrackingStatus, StatusTone> = {
  PURCHASED: "neutral",
  INSPECTION_COMPLETED: "neutral",
  EXPORT_DOCUMENTATION: "neutral",
  EXPORTED: "neutral",
  LOADED_FOR_SHIPPING: "neutral",
  IN_TRANSIT: "warning",
  ARRIVED_AT_MOMBASA: "warning",
  CLEARING: "warning",
  TRANSPORT_TO_SOUTH_SUDAN: "warning",
  READY_FOR_COLLECTION: "positive",
  DELIVERED: "positive",
  ORDER_CONFIRMED: "neutral",
  PROCESSING: "neutral",
  PACKED: "neutral",
  DISPATCHED: "warning",
  OUT_FOR_DELIVERY: "warning",
}

/**
 * The vehicle-import timeline, in order — Stage 26's eleven steps.
 * `IN_TRANSIT` and `DELIVERED` are the vocabulary shared with spare parts.
 */
export const VEHICLE_TRACKING_TIMELINE: readonly TrackingStatus[] = [
  TrackingStatus.PURCHASED,
  TrackingStatus.INSPECTION_COMPLETED,
  TrackingStatus.EXPORT_DOCUMENTATION,
  TrackingStatus.EXPORTED,
  TrackingStatus.LOADED_FOR_SHIPPING,
  TrackingStatus.IN_TRANSIT,
  TrackingStatus.ARRIVED_AT_MOMBASA,
  TrackingStatus.CLEARING,
  TrackingStatus.TRANSPORT_TO_SOUTH_SUDAN,
  TrackingStatus.READY_FOR_COLLECTION,
  TrackingStatus.DELIVERED,
]

/** The spare-parts fulfilment timeline, in order — Stage 27's seven steps. */
export const SPARE_PART_TRACKING_TIMELINE: readonly TrackingStatus[] = [
  TrackingStatus.ORDER_CONFIRMED,
  TrackingStatus.PROCESSING,
  TrackingStatus.PACKED,
  TrackingStatus.DISPATCHED,
  TrackingStatus.IN_TRANSIT,
  TrackingStatus.OUT_FOR_DELIVERY,
  TrackingStatus.DELIVERED,
]

/** Which statuses an operator may record for a given shipment's type. */
export function trackingTimelineFor(shipmentType: ShipmentType): readonly TrackingStatus[] {
  return shipmentType === ShipmentType.VEHICLE ? VEHICLE_TRACKING_TIMELINE : SPARE_PART_TRACKING_TIMELINE
}

/** The status a freshly created shipment opens at — see `Shipment.currentStatus`. */
export function initialTrackingStatusFor(shipmentType: ShipmentType): TrackingStatus {
  return shipmentType === ShipmentType.VEHICLE ? TrackingStatus.PURCHASED : TrackingStatus.ORDER_CONFIRMED
}

export const SHIPMENT_TYPE_LABELS: Record<ShipmentType, string> = {
  VEHICLE: "Vehicle",
  SPARE_PART: "Spare parts",
}
