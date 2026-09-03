import { z } from "zod"

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

export const businessSettingsSchema = z
  .object({
    whatsappNumber: whatsAppNumberField,
    defaultInitialPercentage: percentageField,
    defaultMombasaPercentage: percentageField,
    defaultFinalPercentage: percentageField,
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
