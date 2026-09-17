/**
 * Which facts about a listing a customer may see.
 *
 * Two switches decide it, and both have to be on:
 *
 *   1. Settings → Catalogue display — one switch per fact, for the whole
 *      catalogue ("never show mileage on this site").
 *   2. The listing's own `hiddenFields` — facts an operator has withheld on
 *      one vehicle or part, usually because they are not yet sure of them.
 *
 * A hidden fact is hidden everywhere a customer can reach it: cards, the
 * listing page, the quick view, page metadata, structured data, WhatsApp
 * messages, and the filters and search that could otherwise reveal it by
 * narrowing results. That is enforced where the public DTOs are built (see
 * public-vehicle.queries.ts and public-spare-part.queries.ts) — a hidden
 * value is replaced there and never reaches a component, so no page can
 * render it by forgetting a check.
 *
 * This module has no server-only imports: the admin forms render the same
 * field list and copy.
 *
 * Identity is not switchable. A vehicle is always its make and model, and a
 * part is always its name — a listing without them is not a listing.
 */

export const VEHICLE_INFO_FIELDS = [
  "price",
  "year",
  "mileage",
  "engine",
  "transmission",
  "fuelType",
  "driveType",
  "exteriorColor",
  "interiorColor",
  "countryOfOrigin",
  "location",
  "condition",
  "availability",
  "features",
  "description",
] as const

export type VehicleInfoField = (typeof VEHICLE_INFO_FIELDS)[number]

export const SPARE_PART_INFO_FIELDS = [
  "price",
  "availability",
  "stockQuantity",
  "partNumber",
  "brand",
  "category",
  "compatibility",
  "description",
] as const

export type SparePartInfoField = (typeof SPARE_PART_INFO_FIELDS)[number]

export type Visibility<F extends string> = Record<F, boolean>

/** Everything shown, as the catalogue was before these switches existed. */
export const DEFAULT_VEHICLE_VISIBILITY: Visibility<VehicleInfoField> = {
  price: true,
  year: true,
  mileage: true,
  engine: true,
  transmission: true,
  fuelType: true,
  driveType: true,
  exteriorColor: true,
  interiorColor: true,
  countryOfOrigin: true,
  location: true,
  condition: true,
  availability: true,
  features: true,
  description: true,
}

/**
 * Everything shown except the stock count, which the catalogue has never
 * published — the listing carries an availability promise instead.
 */
export const DEFAULT_SPARE_PART_VISIBILITY: Visibility<SparePartInfoField> = {
  price: true,
  availability: true,
  stockQuantity: false,
  partNumber: true,
  brand: true,
  category: true,
  compatibility: true,
  description: true,
}

export interface InfoFieldCopy {
  label: string
  description: string
}

export const VEHICLE_INFO_COPY: Record<VehicleInfoField, InfoFieldCopy> = {
  price: { label: "Price", description: "Hidden prices read “Price on request”." },
  year: { label: "Year", description: "Also leaves the year out of names, messages and the year filter." },
  mileage: { label: "Mileage", description: "The odometer reading." },
  engine: { label: "Engine", description: "Engine size, such as 2.0L." },
  transmission: { label: "Transmission", description: "Automatic or manual." },
  fuelType: { label: "Fuel type", description: "Petrol, diesel, hybrid and so on." },
  driveType: { label: "Drive type", description: "2WD, 4WD or AWD." },
  exteriorColor: { label: "Exterior colour", description: "The body colour." },
  interiorColor: { label: "Interior colour", description: "The cabin colour." },
  countryOfOrigin: { label: "Country of origin", description: "Japan or Korea." },
  location: { label: "Current location", description: "Where the vehicle is now." },
  condition: { label: "Condition", description: "New, used and so on." },
  availability: { label: "Availability tag", description: "The “Available” label." },
  features: { label: "Features", description: "The equipment list." },
  description: { label: "Description", description: "The “About this vehicle” text." },
}

export const SPARE_PART_INFO_COPY: Record<SparePartInfoField, InfoFieldCopy> = {
  price: { label: "Price", description: "Hidden prices read “Price on enquiry”." },
  availability: { label: "Availability", description: "In stock, on order and so on." },
  stockQuantity: { label: "Stock quantity", description: "The number in hand, on parts that are in stock." },
  partNumber: { label: "Part number", description: "The manufacturer’s number. Search stops matching it." },
  brand: { label: "Brand", description: "Who made the part." },
  category: { label: "Category", description: "Also keeps the part out of category filters." },
  compatibility: { label: "Compatibility", description: "The vehicles the part fits." },
  description: { label: "Description", description: "The “About this part” text." },
}

/**
 * A stored or submitted `hiddenFields` value, reduced to known fields in their
 * canonical order with no repeats. Anything else is dropped, not rejected: an
 * array written by a later build must not make a listing unreadable.
 */
export function normalizeHiddenFields<F extends string>(fields: readonly F[], value: unknown): F[] {
  if (!Array.isArray(value)) return []
  const requested = new Set(value.filter((entry): entry is string => typeof entry === "string"))
  return fields.filter((field) => requested.has(field))
}

/** What a customer may see of one listing: the site-wide switch AND the listing's own. */
export function resolveVisibility<F extends string>(
  fields: readonly F[],
  siteWide: Visibility<F>,
  hiddenFields: readonly string[]
): Visibility<F> {
  const hidden = new Set(hiddenFields)
  return Object.fromEntries(fields.map((field) => [field, siteWide[field] && !hidden.has(field)])) as Visibility<F>
}

/** `value` when visible, otherwise null. */
export function shown<T>(visible: boolean, value: T): T | null {
  return visible ? value : null
}
