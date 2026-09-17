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
  /** Null where the listing does not show its year to customers. */
  year: number | null
  /** Null where the listing does not show its transmission to customers. */
  transmission: string | null
}

export interface SparePartLineSubject {
  name: string
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
  return [
    vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.transmission ? transmissionLabel(vehicle.transmission) : null,
  ]
    .filter((part) => part !== null)
    .join(" ")
}

/**
 * The quotation line for a listed vehicle — the name only, no reference.
 *
 * A customer reading a PDF or a WhatsApp message has no use for
 * "CLM-V-2026-000123" beside the car they are being quoted; that number
 * exists to disambiguate stock behind the scenes, which is exactly what
 * `QuoteItem.vehicleId` already does structurally. An operator who needs to
 * see which physical unit a line names still can — it is the admin editor's
 * own "Reference" column (quote-details-form.tsx), read from that same
 * `vehicleId`, not from this string. Folding it into the text a customer
 * reads would be showing them our inventory bookkeeping.
 */
export function vehicleLineDescription(vehicle: VehicleSubject): string {
  return clamp(vehicleSubjectLabel(vehicle))
}

/**
 * "Front brake pad set" — the part's own name only.
 *
 * Neither the OEM number nor the Crownline reference is part of this string,
 * for the same reason given on `vehicleLineDescription`: both are lookup
 * keys, not something a customer reading a quotation needs printed beside
 * the part's name. An operator confirming fitment still has the OEM number
 * on the part's own catalogue record and reference lookup — this function
 * only decides what the *customer* reads.
 */
export function sparePartLineDescription(part: SparePartLineSubject): string {
  return clamp(part.name)
}
