import {
  CountryOfOrigin,
  DriveType,
  FuelType,
  TransmissionType,
  VehicleCondition,
  VehicleStatus,
} from "@/generated/prisma/enums"

/**
 * Human-readable labels for every vehicle enum, and the option lists the
 * admin forms and public filters are built from.
 *
 * One source for both sides on purpose. If the admin form said "Four wheel
 * drive" and the public filter said "4WD", a customer would be searching
 * for something they cannot see and an operator would swear they had listed
 * it. Typed as `Record<Enum, string>`, so adding a value to the Prisma enum
 * without labelling it is a compile error rather than a blank dropdown
 * discovered later.
 */

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  PETROL: "Petrol",
  DIESEL: "Diesel",
  HYBRID: "Hybrid",
  ELECTRIC: "Electric",
  LPG: "LPG",
}

export const TRANSMISSION_LABELS: Record<TransmissionType, string> = {
  AUTOMATIC: "Automatic",
  MANUAL: "Manual",
  CVT: "CVT",
}

/**
 * `FOUR_WD` is spelled that way in the enum because an identifier cannot
 * begin with a digit — the label is where it becomes what a buyer actually
 * calls it.
 */
export const DRIVE_TYPE_LABELS: Record<DriveType, string> = {
  FWD: "Front-wheel drive",
  RWD: "Rear-wheel drive",
  AWD: "All-wheel drive",
  FOUR_WD: "4WD",
}

export const COUNTRY_LABELS: Record<CountryOfOrigin, string> = {
  JAPAN: "Japan",
  KOREA: "South Korea",
}

/**
 * What the condition tag says on a listing.
 *
 * "Used" rather than "Pre-owned". The euphemism is what a dealership reaches
 * for when it would rather the buyer did not dwell on it, and this business
 * is selling trust to customers wiring money abroad — the plain word is the
 * one that reads as honest. The mileage and the description carry the
 * detail; this tag only answers the first question.
 */
export const VEHICLE_CONDITION_LABELS: Record<VehicleCondition, string> = {
  NEW: "New",
  USED: "Used",
}

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  RESERVED: "Reserved",
  SOLD: "Sold",
  ARCHIVED: "Archived",
}

/**
 * Severity for the status badge.
 *
 * Encoding state in form as well as colour — a viewer who cannot
 * distinguish the hues still reads the label, and the badge shape stays
 * consistent across the dashboard.
 */
export type VehicleStatusTone = "neutral" | "positive" | "warning" | "muted"

export const VEHICLE_STATUS_TONES: Record<VehicleStatus, VehicleStatusTone> = {
  DRAFT: "neutral",
  PUBLISHED: "positive",
  RESERVED: "warning",
  SOLD: "muted",
  ARCHIVED: "muted",
}

/** Turns a label map into the `{ value, label }` pairs a select expects. */
function toOptions<T extends string>(
  labels: Record<T, string>
): ReadonlyArray<{ value: T; label: string }> {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }))
}

export const FUEL_TYPE_OPTIONS = toOptions(FUEL_TYPE_LABELS)
export const TRANSMISSION_OPTIONS = toOptions(TRANSMISSION_LABELS)
export const DRIVE_TYPE_OPTIONS = toOptions(DRIVE_TYPE_LABELS)
export const COUNTRY_OPTIONS = toOptions(COUNTRY_LABELS)
export const VEHICLE_CONDITION_OPTIONS = toOptions(VEHICLE_CONDITION_LABELS)
export const VEHICLE_STATUS_OPTIONS = toOptions(VEHICLE_STATUS_LABELS)

/**
 * Bounds for the year field.
 *
 * The upper bound allows next year, because importers list model-year
 * vehicles ahead of the calendar. The lower bound is loose enough for a
 * genuine classic and tight enough to catch a mistyped year, which is the
 * error this actually prevents — `1900` is far more often a slip than a
 * vehicle.
 */
export const VEHICLE_YEAR_MIN = 1970
export const vehicleYearMax = () => new Date().getFullYear() + 1
