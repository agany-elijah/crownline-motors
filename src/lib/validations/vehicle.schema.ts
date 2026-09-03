import { z } from "zod"

import {
  CountryOfOrigin,
  DriveType,
  FuelType,
  TransmissionType,
  VehicleCondition,
  VehicleStatus,
} from "@/generated/prisma/enums"
import { VEHICLE_YEAR_MIN, vehicleYearMax } from "@/lib/constants/vehicle-options"

/**
 * Validation for vehicle creation and editing.
 *
 * Every bound here exists to catch a specific mistake an operator can
 * plausibly make, not to be defensive in general. A vehicle listing is
 * customer-facing and priced — a mistyped figure is a commercial problem,
 * not a cosmetic one.
 */

/** Trimmed, required, bounded. The shape most text fields on this form need. */
const requiredText = (field: string, max = 80) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required.`)
    .max(max, `${field} is too long.`)

/**
 * Money, as a string from the form.
 *
 * `Decimal(12, 2)` in the database, so two decimal places and a ceiling
 * below 10^10. The precision check uses a tolerance rather than
 * `value * 100 % 1 === 0`, because that comparison is itself a
 * floating-point trap — `33.34 * 100` is 3334.0000000000005, and the exact
 * form rejects valid input.
 */
const money = (field: string) =>
  z.coerce
    .number({ error: `${field} must be a number.` })
    .min(0, `${field} cannot be negative.`)
    .max(9_999_999_999, `${field} is too large.`)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, {
      message: `${field} can have at most two decimal places.`,
    })

/**
 * Separate from `money` rather than a flag on it.
 *
 * A single helper branching on `required` returns a union of two Zod types,
 * and TypeScript then widens *every* field built from it to
 * `number | undefined` — including the required ones. The compiler caught
 * that here; two helpers with concrete return types are both correct and
 * easier to read at the call site.
 *
 * An empty optional field arrives as "" and means "not estimated yet",
 * which is not zero: zero would render on the public listing as a confirmed
 * charge of nothing.
 */
const optionalMoney = (field: string) =>
  z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    money(field).optional()
  )

/**
 * An HTML checkbox, read strictly.
 *
 * A browser omits an unchecked box from the submission entirely and sends
 * the control's `value` — here `"true"` — when it is checked. Nothing else
 * is a real checkbox submission.
 *
 * `z.coerce.boolean()` was wrong for this: it is `Boolean(input)`, so every
 * non-empty string is true, and a request carrying `isFeatured=false` or
 * `isFeatured=0` would set the flag rather than clear it. Only an
 * authenticated administrator can reach the action, so this was never a
 * privilege issue — but "false means true" is the kind of quiet wrongness
 * that eventually gets copied into a schema where it does matter.
 *
 * Total rather than rejecting: an unexpected value is treated as unchecked,
 * because a validation error on a checkbox is not something an operator can
 * act on.
 */
const checkboxField = z
  .union([z.string(), z.boolean(), z.null()])
  // `.optional()` before the transform, not a union member: Zod 4 decides
  // whether an object key may be *absent* from the input type, and a
  // transformed union containing `z.undefined()` still parses as a required
  // key — which fails on exactly the submission this needs to accept, an
  // unchecked box the browser omits entirely.
  .optional()
  .transform((value) => value === true || value === "true" || value === "on")

/**
 * Bounds on the equipment list.
 *
 * `MAX` is a listing's worth of equipment, not a catalogue. `MAX_LENGTH` is
 * a bullet, not a paragraph — anything longer is prose that belongs in the
 * description, where it will actually be read.
 */
export const VEHICLE_FEATURES_MAX = 40
export const VEHICLE_FEATURE_MAX_LENGTH = 120

/**
 * The equipment list, typed one per line in a textarea.
 *
 * ── Why a textarea and not a repeating field ──────────────────────────
 * An operator entering a car from an auction sheet is copying a list. A
 * textarea lets them paste it and move on; a "+ Add feature" control makes
 * them click twenty times for the same result and is markedly worse on the
 * phone the brief says this dashboard has to work on.
 *
 * ── What this normalises, and why each one ────────────────────────────
 * - Both newline conventions, because a Windows browser posts CRLF and the
 *   raw "\r" would otherwise be stored and rendered as part of the bullet.
 * - Leading bullet characters, because someone pasting a list brings the
 *   "•" or "- " with it, and the page draws its own markers — without this
 *   the customer sees "• • Sunroof".
 * - Blank lines, because a trailing newline is how every textarea ends.
 *
 * Duplicates are collapsed case-insensitively while keeping the first
 * spelling the operator used: a list that says "Sunroof" twice is a paste
 * accident, not an emphasis.
 *
 * Absent input is an empty list rather than an error. A vehicle with no
 * features listed is a normal listing, and the tab simply says so.
 */
const featuresField = z
  .union([z.string(), z.null()])
  // `.optional()` before the transform, for the same Zod 4 reason spelled
  // out on `checkboxField` above: a transformed union that merely *contains*
  // `z.undefined()` still parses as a required key, so a submission that
  // omits the field entirely is rejected rather than read as an empty list.
  .optional()
  .transform((value) => {
    if (typeof value !== "string") return []

    const seen = new Set<string>()
    const features: string[] = []

    for (const line of value.split(/\r?\n/)) {
      const feature = line.replace(/^\s*[-*\u2022]\s*/, "").trim()

      if (!feature) continue

      const key = feature.toLocaleLowerCase()
      if (seen.has(key)) continue

      seen.add(key)
      features.push(feature)
    }

    return features
  })
  /**
   * Validated after the transform, so the limits apply to what would
   * actually be stored rather than to the raw text. Refusing is right here
   * where it would be wrong for the blank lines above: a truncated
   * equipment list is a listing that quietly misdescribes the car, so the
   * operator is told rather than having the tail dropped for them.
   */
  .refine((features) => features.length <= VEHICLE_FEATURES_MAX, {
    message: `List at most ${VEHICLE_FEATURES_MAX} features — put anything further in the description.`,
  })
  .refine(
    (features) => features.every((f) => f.length <= VEHICLE_FEATURE_MAX_LENGTH),
    {
      message: `Each feature must be ${VEHICLE_FEATURE_MAX_LENGTH} characters or fewer — a bullet, not a sentence.`,
    }
  )

const vehicleFields = {
  make: requiredText("Make", 40),
  model: requiredText("Model", 60),

  /**
   * The upper bound is checked at parse time, not at module load.
   *
   * `.max(vehicleYearMax())` evaluated the ceiling once, when this module
   * was first imported, and baked it into the schema along with its message.
   * A server process alive across New Year's Eve would go on refusing the
   * new model year — which is exactly when an importer starts listing it —
   * and the error would name last year's limit. A `superRefine` runs per
   * parse, so the bound moves with the calendar.
   */
  year: z.coerce
    .number({ error: "Year must be a number." })
    .int("Year must be a whole number.")
    .min(VEHICLE_YEAR_MIN, `Year must be ${VEHICLE_YEAR_MIN} or later.`)
    .superRefine((value, ctx) => {
      const max = vehicleYearMax()

      if (value > max) {
        ctx.addIssue({
          code: "custom",
          message: `Year cannot be later than ${max}.`,
        })
      }
    }),

  price: money("Price"),

  mileageKm: z.coerce
    .number({ error: "Mileage must be a number." })
    .int("Mileage must be a whole number.")
    .min(0, "Mileage cannot be negative.")
    // Two million kilometres is beyond any road vehicle's life. This catches
    // the real error, which is entering miles-as-metres or adding a digit.
    .max(2_000_000, "That mileage looks wrong — check the figure."),

  fuelType: z.enum(FuelType),
  transmission: z.enum(TransmissionType),
  driveType: z.enum(DriveType),
  countryOfOrigin: z.enum(CountryOfOrigin),
  condition: z.enum(VehicleCondition),

  // Free text rather than a number: real listings say "2.0L", "1.5L Turbo",
  // "Electric". Forcing a decimal here would lose information a buyer uses.
  engineSize: requiredText("Engine size", 30),

  exteriorColor: requiredText("Exterior colour", 40),
  interiorColor: requiredText("Interior colour", 40),
  currentLocation: requiredText("Current location", 80),

  shippingEstimate: optionalMoney("Shipping estimate"),
  clearingEstimate: optionalMoney("Clearing estimate"),
  otherChargesEst: optionalMoney("Other charges"),

  description: z
    .string()
    .trim()
    .min(20, "Write at least a sentence describing the vehicle and its condition.")
    .max(5000, "Description is too long."),

  features: featuresField,

  isFeatured: checkboxField,
}

/**
 * Creation.
 *
 * `status` is absent on purpose. A new vehicle is always a DRAFT — the
 * database default — because publishing is a decision made after the
 * photos and description are in place, not a dropdown to be set absently
 * while typing the mileage. It is changed afterwards through
 * `updateVehicleStatusAction`, which is separately permissioned.
 *
 * `referenceNumber` and `slug` are likewise absent: both are generated
 * server-side. Accepting either from the client would let a caller choose
 * its own reference, and they are what the business and its customers use
 * to identify a vehicle.
 */
export const createVehicleSchema = z.object(vehicleFields)
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>

/**
 * Editing. Same fields; the vehicle is identified separately.
 *
 * ── `expectedUpdatedAt` ───────────────────────────────────────────────
 * The value `Vehicle.updatedAt` held when this form was rendered, carried
 * back so the action can refuse a write built on a stale reading.
 *
 * Without it the last save wins silently: two administrators open the same
 * vehicle, one corrects the mileage, the other corrects the price, and
 * whoever saves second reverts the first change without either of them
 * seeing anything go wrong. On a record that carries a customer-facing
 * price, a silent revert is the worst available failure — it looks exactly
 * like a save that worked.
 *
 * Required rather than optional. A form rendered before this field existed
 * will fail validation once, with a message telling the operator to reload;
 * treating its absence as "skip the check" would leave the hole open for
 * any caller that simply omits the field, which is every caller that is not
 * this form.
 */
export const updateVehicleSchema = z.object({
  id: z.string().min(1, "Missing vehicle."),
  expectedUpdatedAt: z.coerce.date({
    error: "Reload this page before saving — it was opened a while ago.",
  }),
  ...vehicleFields,
})
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>

export const updateVehicleStatusSchema = z.object({
  id: z.string().min(1, "Missing vehicle."),
  status: z.enum(VehicleStatus),
})
export type UpdateVehicleStatusInput = z.infer<typeof updateVehicleStatusSchema>

/**
 * Filters for the admin list.
 *
 * Every field is optional and forgiving: these come from a query string a
 * user can edit, and a malformed filter should show an unfiltered list
 * rather than an error page. `catch` turns a bad value into the default
 * instead of a failed parse.
 */
export const vehicleListFiltersSchema = z.object({
  search: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(VehicleStatus).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
})
export type VehicleListFilters = z.infer<typeof vehicleListFiltersSchema>
