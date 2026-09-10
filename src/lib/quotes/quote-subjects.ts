import { TRANSMISSION_LABELS } from "@/lib/constants/vehicle-options"

/**
 * How the thing being quoted is named, in one place.
 *
 * The same vehicle is named on the request form ("Toyota Harrier XGL 2024
 * Automatic"), on the quotation line an operator prices, on the PDF, in the
 * WhatsApp message and, after conversion, on the order line. If each surface
 * composed its own string they would drift, and a customer comparing their
 * quotation with their order would find two different descriptions of one
 * car. Pure, so the client form and the server action share it.
 */

/** Line descriptions are stored in a column the operator can also edit, and
 *  the editor caps them at this length. */
export const QUOTE_LINE_DESCRIPTION_MAX = 300

export interface VehicleSubject {
  make: string
  model: string
  year: number
  transmission: string
}

export interface VehicleLineSubject extends VehicleSubject {
  referenceNumber: string
}

export interface SparePartLineSubject {
  name: string
  referenceNumber: string
  oemPartNumber: string | null
}

function transmissionLabel(value: string): string {
  return TRANSMISSION_LABELS[value as keyof typeof TRANSMISSION_LABELS] ?? value
}

function clamp(text: string): string {
  const trimmed = text.trim()
  return trimmed.length <= QUOTE_LINE_DESCRIPTION_MAX
    ? trimmed
    : `${trimmed.slice(0, QUOTE_LINE_DESCRIPTION_MAX - 1).trimEnd()}…`
}

/**
 * "Toyota Harrier XGL 2024 Automatic" — what the customer sees on the
 * request form. The model column carries the grade when the operator typed
 * one ("Harrier XGL"), which is why there is no separate trim field to add.
 */
export function vehicleSubjectLabel(vehicle: VehicleSubject): string {
  return `${vehicle.make} ${vehicle.model} ${vehicle.year} ${transmissionLabel(
    vehicle.transmission
  )}`
}

/**
 * The quotation line for a listed vehicle, with its reference.
 *
 * The reference is part of the snapshot because an importer can hold three
 * 2024 Harriers at once, and a line that does not say which one is a line
 * nobody can convert with confidence.
 */
export function vehicleLineDescription(vehicle: VehicleLineSubject): string {
  return clamp(`${vehicleSubjectLabel(vehicle)} — ${vehicle.referenceNumber}`)
}

/** "Front brake pad set (OEM 04465-48150) — CLM-SP-2026-000045". */
export function sparePartLineDescription(part: SparePartLineSubject): string {
  const oem = part.oemPartNumber ? ` (OEM ${part.oemPartNumber})` : ""
  return clamp(`${part.name}${oem} — ${part.referenceNumber}`)
}
