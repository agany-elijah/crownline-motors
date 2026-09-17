import { z } from "zod"

/**
 * Validation for the order admin screen: currently just the delivery-date
 * estimate an operator sets and revises directly on the order. Payment
 * recording and status changes have their own schemas elsewhere
 * (payment.schema.ts); this file grows with the rest of the order-management
 * surface as later phases land.
 */

/** "", whitespace and null all mean "not given". */
function blankToUndefined(value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string" && value.trim() === "") return undefined
  return value
}

const orderIdField = z.string().trim().min(1, "Missing order.").max(64)

/** A calendar date from an `<input type="date">`, stored as the start of
 *  that day in UTC. Blank clears the estimate rather than being refused —
 *  "we no longer have a date to promise" is a legitimate edit. */
const deliveryDateField = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
    .transform((value, ctx) => {
      const [year, month, day] = value.split("-").map(Number)
      const date = new Date(Date.UTC(year, month - 1, day))

      if (
        Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        ctx.addIssue({ code: "custom", message: "That is not a real date." })
        return z.NEVER
      }

      return date
    })
    .optional()
)

/**
 * The expected delivery window: a first day, and optionally a last one —
 * "between 17 and 30 October". A last day on its own is refused (a window
 * needs a start), as is one before the first; the database holds the same
 * rule in `Order_delivery_window_check`. A last day equal to the first is
 * stored as no last day, so it reads as the single date it is.
 */
export const orderDeliveryDateSchema = z
  .object({
    orderId: orderIdField,
    deliveryDate: deliveryDateField,
    deliveryDateLatest: deliveryDateField,
  })
  .superRefine((value, ctx) => {
    if (value.deliveryDateLatest && !value.deliveryDate) {
      ctx.addIssue({ code: "custom", path: ["deliveryDate"], message: "Choose the first day of the window too." })
    }
    if (value.deliveryDate && value.deliveryDateLatest && value.deliveryDateLatest < value.deliveryDate) {
      ctx.addIssue({ code: "custom", path: ["deliveryDateLatest"], message: "The last day cannot be before the first." })
    }
  })
  .transform((value) => ({
    ...value,
    deliveryDateLatest:
      value.deliveryDate && value.deliveryDateLatest && value.deliveryDateLatest.getTime() === value.deliveryDate.getTime()
        ? undefined
        : value.deliveryDateLatest,
  }))

export type OrderDeliveryDateInput = z.infer<typeof orderDeliveryDateSchema>

export const cancelOrderSchema = z.object({
  orderId: orderIdField,
  /** Required: cancelling a sale is exactly the action an audit is asked about. */
  reason: z.preprocess(
    blankToUndefined,
    z
      .string({ error: "Say why this order is being cancelled." })
      .trim()
      .min(3, "Say why this order is being cancelled.")
      .max(500, "Reason is too long.")
  ),
})
