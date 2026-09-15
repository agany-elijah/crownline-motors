import { z } from "zod"

import { PaymentMethod } from "@/generated/prisma/enums"
import { PAYMENT_REVERSAL_OUTCOMES } from "@/lib/constants/payment"
import { parseMoneyInput } from "@/lib/utils/money"

/**
 * Validation for recording and reversing payments on an order.
 *
 * Whether an amount fits the stage it is recorded against depends on rows
 * this schema cannot see (what has already been paid), so that check lives
 * in the server action, inside the transaction that locks the stage.
 */

/** "", whitespace and null all mean "not given". */
function blankToUndefined(value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string" && value.trim() === "") return undefined
  return value
}

const optionalText = (field: string, max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max, `${field} is too long.`).optional())

const idField = (label: string) => z.string().trim().min(1, `Missing ${label}.`).max(64)

const amountField = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z.string().transform((value, ctx) => {
    const parsed = parseMoneyInput(value)

    if (parsed === null || parsed <= 0) {
      ctx.addIssue({ code: "custom", message: "Enter an amount greater than zero, e.g. 11,250 or 11250.50." })
      return z.NEVER
    }

    return parsed
  })
)

/**
 * Allowance for the gap between UTC and Juba (UTC+2) and a clock that is a
 * little ahead: a payment dated "today" in East Africa must never be refused
 * as being in the future.
 */
const FUTURE_TOLERANCE_MS = 36 * 60 * 60 * 1000

/** A calendar date from an `<input type="date">`. Blank means "today". */
const paymentDateField = z.preprocess(
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

      if (date.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
        ctx.addIssue({ code: "custom", message: "A payment cannot be dated in the future." })
        return z.NEVER
      }

      return date
    })
    .optional()
)

export const recordPaymentSchema = z.object({
  orderId: idField("order"),
  /** Required: an unattributed payment would never move any stage to paid,
   *  and "what is due now" would stop being true. */
  milestoneId: idField("payment stage"),
  amount: amountField,
  method: z.enum(PaymentMethod, { error: "Choose how the customer paid." }),
  transactionReference: optionalText("Reference", 120),
  paymentDate: paymentDateField,
  notes: optionalText("Notes", 1000),
})

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

export const reversePaymentSchema = z.object({
  paymentId: idField("payment"),
  outcome: z.enum(PAYMENT_REVERSAL_OUTCOMES, { error: "Choose whether the payment was rejected or refunded." }),
  /** Required: reversing money is exactly the action an audit is asked about. */
  reason: z.preprocess(
    blankToUndefined,
    z
      .string({ error: "Say why this payment is being reversed." })
      .trim()
      .min(3, "Say why this payment is being reversed.")
      .max(500, "Reason is too long.")
  ),
})

export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>
