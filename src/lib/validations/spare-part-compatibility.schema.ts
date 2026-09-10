import { z } from "zod"

/**
 * Validation for the fitment rules an operator writes against a part.
 *
 * ── Fitment is entered, not computed ──────────────────────────────────
 * There is no automatic matching anywhere in this flow, and that is the
 * point. What a part fits is a fact somebody at the dealership knows — off a
 * parts catalogue, an auction sheet, or the box the unit came in — and
 * inferring it from the vehicle inventory would produce a list that empties
 * itself as cars are sold and that never covers the customer whose own car
 * was never on our floor. So every rule here is typed by hand and every
 * column is free text or a number, deliberately.
 *
 * `spare-part-compatibility.ts` then reads those rules. It matches exactly
 * and case-insensitively, and the nulls widen: no make means every make, no
 * model means every model of that make, an absent year bound means unbounded
 * in that direction. This schema's job is to make sure the row an operator
 * saves means what they intended it to mean.
 *
 * ── The rules that are also database CHECK constraints ────────────────
 * `yearTo >= yearFrom` exists in Postgres as
 * `SparePartCompatibility_year_range_check`. It is repeated here for the
 * reason every such rule is: the database is the backstop no code path can
 * route around, and this layer is what turns a violation into a sentence an
 * operator can act on rather than a 500.
 */

/**
 * The bounds on a model year.
 *
 * 1950 because nothing this business imports predates it, and a four-digit
 * lower bound catches the commonest slip — a two-digit year, which would
 * otherwise store as the year 21 and silently match nothing.
 *
 * The upper bound is generous rather than "this year": manufacturers list
 * next year's model from the autumn before, and a fitment rule that could not
 * name it would be wrong for six months of every year.
 */
const YEAR_MIN = 1950
const YEAR_MAX = 2100

/**
 * A trimmed optional string. An empty box means "any", stored as NULL.
 *
 * Never an empty string: `make = ""` would be a rule that widens to every
 * make while *looking* like a rule that names one, and `describeFitment`
 * would print a stray space where the make should be.
 */
const optionalText = (field: string, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max, `${field} is too long.`).optional()
  )

const optionalYear = (field: string) =>
  z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    z.coerce
      .number({ error: `${field} must be a year.` })
      .int(`${field} must be a whole year.`)
      .min(YEAR_MIN, `${field} looks too early — check the year.`)
      .max(YEAR_MAX, `${field} looks too late — check the year.`)
      .optional()
  )

export const createSparePartCompatibilitySchema = z
  .object({
    sparePartId: z.string().min(1, "Missing part."),

    /**
     * Optional, and leaving it empty is a real choice rather than an omission:
     * it is how a universal consumable — a wiper blade, a bulb, a tyre valve
     * — is listed as fitting anything, instead of being entered once per make.
     */
    make: optionalText("Make", 60),
    model: optionalText("Model", 60),

    yearFrom: optionalYear("From year"),
    yearTo: optionalYear("To year"),

    /** Free text, matching `Vehicle.engineSize` — "2.0L", "1.5L Turbo". Real
     *  listings say things a decimal cannot. */
    engine: optionalText("Engine", 40),

    /** Shown to the customer beside the rule. "Front axle only", "not the
     *  hybrid". The place for the qualifier a structured column cannot hold. */
    notes: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().trim().max(200, "Keep the note short.").optional()
    ),
  })
  .refine((values) => values.make !== undefined || values.model === undefined, {
    message:
      "A model needs a make. Leave both empty for a part that fits any vehicle.",
    path: ["make"],
  })
  .refine(
    (values) =>
      values.yearFrom === undefined ||
      values.yearTo === undefined ||
      values.yearTo >= values.yearFrom,
    {
      /**
       * A reversed range is not a loud failure — it silently matches nothing,
       * hiding the part from exactly the customers the rule was written for.
       * Catching it here is the difference between an operator fixing a typo
       * and nobody ever noticing.
       */
      message: "The last year cannot be before the first.",
      path: ["yearTo"],
    }
  )

export type CreateSparePartCompatibilityInput = z.infer<
  typeof createSparePartCompatibilitySchema
>

export const deleteSparePartCompatibilitySchema = z.object({
  id: z.string().min(1, "Missing fitment rule."),
})
