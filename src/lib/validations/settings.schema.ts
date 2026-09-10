import { z } from "zod"

import {
  MAX_SPARE_PART_DELIVERY_STEPS,
  SPARE_PART_DELIVERY_STEP_DESCRIPTION_MAX,
  SPARE_PART_DELIVERY_STEP_TITLE_MAX,
} from "@/lib/constants/spare-part-delivery"

/**
 * Validation for the business settings form.
 *
 * The percentage rule here is not a nicety. CLAUDE.md's schema
 * documentation is explicit that "the three percentages summing to 100 is
 * validated in the Zod schema for the settings admin form, not enforced by a
 * DB CHECK constraint" — Prisma's DSL cannot express a cross-column check,
 * so this file is the only thing standing between a typo and a payment
 * structure that never adds up to the price the customer agreed.
 */

/** Hundredths of a percent. Working in integers avoids the float trap below. */
const TOTAL_HUNDREDTHS = 10_000

const percentageField = z.coerce
  .number({ error: "Enter a number." })
  .min(0, "Cannot be negative.")
  .max(100, "Cannot exceed 100%.")
  /**
   * Two decimal places, matching Decimal(5,2) in the database. More
   * precision than that would be silently truncated on write, so the stored
   * value would differ from the one the admin typed and checked.
   *
   * Compared with a tolerance rather than `value * 100 % 1 === 0`, because
   * that test is itself a floating-point trap: `33.34 * 100` evaluates to
   * 3334.0000000000005, so the exact version rejects a perfectly valid
   * two-decimal input. Caught by the unit tests, which is why they exist.
   */
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, {
    message: "Use at most two decimal places.",
  })

/**
 * WhatsApp number in full international format.
 *
 * Optional: an empty value is a legitimate state meaning "not configured",
 * and every WhatsApp call-to-action already renders nothing rather than a
 * broken wa.me link when the number is absent (see lib/utils/whatsapp.ts).
 * Rejecting empty would force a placeholder number into the field, which is
 * worse — a link to a wrong number is more damaging than no link.
 *
 * Formatting characters are allowed through and stripped at use, so an
 * operator can type the number the way they read it.
 */
const whatsAppNumberField = z
  .string()
  .trim()
  .max(32, "That number is too long.")
  .refine(
    (value) => {
      if (value.length === 0) return true
      const digits = value.replace(/\D/g, "")
      // E.164 allows up to 15 digits; 7 is the shortest plausible national
      // number. The range is deliberately loose — this catches typos and
      // pasted rubbish, not every invalid number in the world.
      return digits.length >= 7 && digits.length <= 15
    },
    { message: "Enter a full international number, for example +211900000000." }
  )

/**
 * One "how this reaches you" step.
 *
 * Both fields are required. A step with a title and no sentence is a word
 * floating under a numeral, and a step with a sentence and no title has
 * nothing for the eye to land on — either one makes the band on the part page
 * look broken rather than sparse. An operator who wants fewer steps removes
 * a row; they do not half-fill one.
 */
export const sparePartDeliveryStepSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give this step a short title.")
    .max(SPARE_PART_DELIVERY_STEP_TITLE_MAX, "That title is too long for the layout."),
  description: z
    .string()
    .trim()
    .min(10, "Say in a sentence what happens at this step.")
    .max(
      SPARE_PART_DELIVERY_STEP_DESCRIPTION_MAX,
      "Keep this to a sentence — the detail belongs on WhatsApp."
    ),
})

/**
 * The ordered list of steps.
 *
 * ── This schema is used on the way *out* as well as on the way in ─────
 * `sparePartDeliverySteps` is a `Json` column, and Postgres does not check
 * what is inside one. A row written by an older build, by a restored backup,
 * or by hand in Studio can hold anything at all, and a page that trusted it
 * would render `undefined` — or crash — on data the database was perfectly
 * happy to store. So the read path parses with this too, and falls back to
 * the built-in steps when it fails. Treat a Json column as untrusted input,
 * exactly like a request body.
 *
 * An **empty array is valid and meaningful**: it is how an operator hides the
 * section deliberately, which is different from never having configured it
 * (null, which falls back to the defaults).
 */
export const sparePartDeliveryStepsSchema = z
  .array(sparePartDeliveryStepSchema)
  .max(
    MAX_SPARE_PART_DELIVERY_STEPS,
    `Use at most ${MAX_SPARE_PART_DELIVERY_STEPS} steps — a list longer than that stops being read.`
  )

export type SparePartDeliveryStepsInput = z.infer<typeof sparePartDeliveryStepsSchema>

export const businessSettingsSchema = z
  .object({
    whatsappNumber: whatsAppNumberField,
    defaultInitialPercentage: percentageField,
    defaultMombasaPercentage: percentageField,
    defaultFinalPercentage: percentageField,
    /**
     * Arrives from the form as one JSON string rather than as indexed field
     * names (`steps[0].title`, …).
     *
     * Repeated form fields lose their pairing the moment a row is removed —
     * `FormData` gives back two flat lists of titles and descriptions, and
     * re-pairing them by position is a silent mis-association if either list
     * is short. One string keeps the rows intact through the request, and it
     * is parsed here rather than trusted: a hand-posted body can put anything
     * in it, and everything past this point is the validated array.
     *
     * ── Three distinct inputs, three distinct meanings ────────────────
     *   absent (`null` from `FormData.get`) → `undefined`, "leave the stored
     *     steps alone". This is what makes the field safe to add to a form
     *     that already existed: a request that does not mention the steps —
     *     including a crafted one — cannot silently wipe them while editing
     *     the payment percentages.
     *   `""` → `[]`, "the operator cleared the list", which hides the section.
     *   a JSON array → those steps, once every row has been validated.
     */
    sparePartDeliverySteps: z
      .preprocess((value) => {
        if (value === null || value === undefined) return undefined
        if (typeof value !== "string") return value
        if (value.trim() === "") return []

        try {
          return JSON.parse(value)
        } catch {
          // Not JSON at all. Returned unchanged so the array schema below
          // reports a shape error rather than this preprocessor throwing a
          // 500.
          return value
        }
      }, sparePartDeliveryStepsSchema.optional())
      .optional(),
  })
  .refine(
    (values) => {
      /**
       * Compared as integer hundredths rather than by adding the floats.
       * `33.33 + 33.33 + 33.34` is not exactly `100` in IEEE-754, so a
       * direct `=== 100` would reject a split that is perfectly valid — and
       * an admin who cannot save a correct value will eventually enter an
       * incorrect one that does pass.
       */
      const total =
        Math.round(values.defaultInitialPercentage * 100) +
        Math.round(values.defaultMombasaPercentage * 100) +
        Math.round(values.defaultFinalPercentage * 100)

      return total === TOTAL_HUNDREDTHS
    },
    {
      message:
        "The three payment stages must add up to exactly 100%. A customer must have paid the full agreed price before the vehicle is released.",
      // Attached to the first field so the message renders beside the
      // group rather than floating unanchored at the form root.
      path: ["defaultInitialPercentage"],
    }
  )

export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>
