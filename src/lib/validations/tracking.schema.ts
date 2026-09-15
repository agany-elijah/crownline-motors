import { z } from "zod"

import { TrackingStatus } from "@/generated/prisma/enums"

/**
 * Validation for the admin shipment/tracking surface on an order: creating
 * the shipment, recording an event, and voiding one.
 *
 * The *set* of statuses valid for a given shipment (vehicle vs. spare-part
 * timeline) is not expressible here — it depends on a row already in the
 * database (`Shipment.shipmentType`) that this schema has no access to.
 * That check belongs to the server action, which has the shipment in hand;
 * this schema only refuses a status that is not a `TrackingStatus` at all.
 */

/** "", whitespace and null all mean "not given". */
function blankToUndefined(value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string" && value.trim() === "") return undefined
  return value
}

const optionalText = (field: string, max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max, `${field} is too long.`).optional())

const orderIdField = z.string().trim().min(1, "Missing order.").max(64)
const shipmentIdField = z.string().trim().min(1, "Missing shipment.").max(64)
const trackingEventIdField = z.string().trim().min(1, "Missing tracking event.").max(64)

export const createShipmentSchema = z.object({
  orderId: orderIdField,
})

/** A calendar date from an `<input type="date">`. Blank falls back to "now"
 *  in the action, matching the column's own `@default(now())`. */
const eventDateField = z.preprocess(
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

export const addTrackingEventSchema = z.object({
  shipmentId: shipmentIdField,
  status: z.enum(TrackingStatus, { error: "Choose a status." }),
  location: optionalText("Location", 200),
  notes: optionalText("Notes", 1000),
  eventDate: eventDateField,
})

export type AddTrackingEventInput = z.infer<typeof addTrackingEventSchema>

export const voidTrackingEventSchema = z.object({
  trackingEventId: trackingEventIdField,
  reason: optionalText("Reason", 500),
})
