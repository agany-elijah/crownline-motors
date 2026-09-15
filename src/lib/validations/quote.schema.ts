import { z } from "zod"

import {
  FuelType,
  PreferredCountry,
  QuoteDispatchChannel,
  QuoteSource,
  QuoteStatus,
  QuoteType,
  TransmissionType,
} from "@/generated/prisma/enums"
import { MAX_CART_LINES, MAX_ITEM_QUANTITY } from "@/lib/cart/cart-storage"
import { VEHICLE_YEAR_MIN, vehicleYearMax } from "@/lib/constants/vehicle-options"
import { parseMoneyInput } from "@/lib/utils/money"
import { DEFAULT_DIAL_COUNTRY, findDialCode, normalizePhoneNumber } from "@/lib/utils/phone"

/**
 * Validation for quotations: the public request forms, and every operator
 * action on a quote.
 *
 * ── The public schema is the only thing between the internet and the table
 * The request form is the one write path an anonymous visitor can reach, so
 * nothing about its shape is assumed. Every field is bounded, every
 * identifier is re-read from the database by the action rather than trusted,
 * and a price is never accepted from the browser at all — the server prices
 * from the catalogue, or leaves the line for an operator to price.
 */

/** "", whitespace and null all mean "not given". */
function blankToUndefined(value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string" && value.trim() === "") return undefined
  return value
}

const optionalText = (field: string, max: number) =>
  z.preprocess(
    blankToUndefined,
    z.string().trim().max(max, `${field} is too long.`).optional()
  )

/** See `checkboxField` in vehicle.schema.ts for why this is read strictly. */
const checkboxField = z
  .union([z.string(), z.boolean(), z.null()])
  .optional()
  .transform((value) => value === true || value === "true" || value === "on")

/** A selected dial-code country, falling back to the default rather than
 *  erroring: the select only offers valid ones, and a hand-edited value is
 *  better read as South Sudan than refused. */
const dialCountryField = z
  .string()
  .optional()
  .transform((value) => (findDialCode(value) ? (value as string) : DEFAULT_DIAL_COUNTRY))

/**
 * A person's name, as they write it.
 *
 * Letters from any script, spaces, apostrophes, hyphens and full stops —
 * "Nyandeng Deng-Garang", "Ma'en", "J. Lado". What is refused is the shape of
 * spam rather than of names: links, angle brackets, and digits-only strings.
 */
const personNameField = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(120, "That name is too long.")
  .refine((value) => !/https?:\/\/|www\.|[<>]/i.test(value), {
    message: "Enter your name only.",
  })
  .refine((value) => /\p{L}/u.test(value), { message: "Enter your full name." })

const emailField = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "That email address is too long.")
    .pipe(z.email("Enter a valid email address, or leave it blank."))
    .optional()
)

/** Customer notes. Long enough for a real requirement, short enough that a
 *  single request cannot fill an operator's screen. */
export const QUOTE_NOTES_MAX = 2000

/**
 * The name of the form's honeypot field.
 *
 * Rendered off-screen and out of the tab order, so a person never fills it
 * and a form-filling bot usually does. A non-empty value is answered with the
 * same neutral confirmation a real request gets and nothing is stored — a bot
 * told "rejected" simply learns which field to leave blank.
 *
 * Deliberately a name no browser autofill heuristic maps to a personal field
 * ("website", "company" and "nickname" all get filled by some password
 * managers, which would silently discard a real customer's request).
 */
export const QUOTE_HONEYPOT_FIELD = "crownline_confirm_hp"

/** The three shapes a public request takes. */
export const QUOTE_REQUEST_KINDS = ["VEHICLE_LISTING", "PARTS_LIST", "GENERAL"] as const
export type QuoteRequestKind = (typeof QUOTE_REQUEST_KINDS)[number]

/**
 * The parts list, as posted: `[{ slug, quantity }]` in one JSON string.
 *
 * One string, not repeated fields, for the reason the settings form gives:
 * `FormData` returns repeated fields as parallel lists that lose their
 * pairing the moment one is short. Names and prices are deliberately absent
 * — the action re-reads every part by slug and describes and prices it from
 * the catalogue, so a tampered basket buys nothing.
 */
const partsListField = z.preprocess(
  (value) => {
    if (typeof value !== "string" || value.trim() === "") return undefined

    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  },
  z
    .array(
      z.object({
        slug: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .regex(/^[a-z0-9-]+$/, "That part could not be identified."),
        quantity: z.coerce
          .number()
          .int()
          .min(1, "Quantities start at one.")
          .max(MAX_ITEM_QUANTITY, `At most ${MAX_ITEM_QUANTITY} of one part per request.`),
      })
    )
    .min(1, "Your parts list is empty.")
    .max(MAX_CART_LINES, `At most ${MAX_CART_LINES} different parts per request.`)
    .optional()
)

const slugField = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .max(200)
    .regex(/^[a-z0-9-]+$/, "That vehicle could not be identified.")
    .optional()
)

const optionalEnum = <T extends Record<string, string>>(values: T) =>
  z.preprocess(blankToUndefined, z.enum(values).optional())

const preferredYearField = z.preprocess(
  blankToUndefined,
  z.coerce
    .number({ error: "Enter a year." })
    .int("Enter a year.")
    .min(VEHICLE_YEAR_MIN, "That year is too early.")
    .max(vehicleYearMax(), "That year is too late.")
    .optional()
)

const budgetField = z.preprocess(
  blankToUndefined,
  z
    .string()
    .transform((value, ctx) => {
      const parsed = parseMoneyInput(value)

      if (parsed === null) {
        ctx.addIssue({ code: "custom", message: "Enter an amount in US dollars, e.g. 25000." })
        return z.NEVER
      }

      return parsed
    })
    .optional()
)

/**
 * The public request, as the server action reads it.
 *
 * Contact fields are common to every kind; the rest depends on `requestKind`
 * and is enforced in `superRefine`, so each kind carries exactly what it
 * needs and a crafted POST cannot, say, attach a parts list to a vehicle
 * enquiry.
 *
 * Phone numbers leave this schema normalised to E.164 (see utils/phone.ts),
 * which is what customer deduplication and the WhatsApp link both need.
 */
export const quoteRequestSchema = z
  .object({
    requestKind: z.enum(QUOTE_REQUEST_KINDS, { error: "That request could not be read." }),
    source: z.enum(QuoteSource, { error: "That request could not be read." }),
    /** GENERAL only: which catalogue the enquiry is about. */
    domain: optionalEnum(QuoteType),

    fullName: personNameField,
    phoneCountry: dialCountryField,
    phone: z.string().trim().min(1, "Enter your phone number.").max(32, "That number is too long."),
    whatsappSameAsPhone: checkboxField,
    whatsappCountry: dialCountryField,
    whatsapp: optionalText("WhatsApp number", 32),
    email: emailField,
    city: z
      .string()
      .trim()
      .min(2, "Enter your city or town.")
      .max(80, "That place name is too long.")
      .refine((value) => !/https?:\/\/|[<>]/i.test(value), {
        message: "Enter a city or town.",
      }),

    notes: optionalText("Your message", QUOTE_NOTES_MAX),

    vehicleSlug: slugField,
    items: partsListField,

    // Optional detail on a general request (the Get a Quote page).
    make: optionalText("Make", 60),
    model: optionalText("Model", 60),
    preferredYear: preferredYearField,
    maxBudget: budgetField,
    preferredCountry: optionalEnum(PreferredCountry),
    fuelType: optionalEnum(FuelType),
    transmission: optionalEnum(TransmissionType),
    partName: optionalText("Part name", 120),
    partNumber: optionalText("Part number", 60),
  })
  .superRefine((value, ctx) => {
    const unreadable = "That request could not be read. Reload the page and try again."

    if (value.requestKind === "VEHICLE_LISTING") {
      if (!value.vehicleSlug) ctx.addIssue({ code: "custom", path: ["vehicleSlug"], message: unreadable })
      if (value.source !== QuoteSource.VEHICLE_PAGE)
        ctx.addIssue({ code: "custom", path: ["source"], message: unreadable })
    }

    if (value.requestKind === "PARTS_LIST") {
      if (!value.items) ctx.addIssue({ code: "custom", path: ["items"], message: "Your parts list is empty." })
      if (value.source !== QuoteSource.SPARE_PART_CART)
        ctx.addIssue({ code: "custom", path: ["source"], message: unreadable })
    }

    if (value.requestKind === "GENERAL") {
      const generalSources: QuoteSource[] = [
        QuoteSource.VEHICLE_CATALOGUE,
        QuoteSource.SPARE_PART_CATALOGUE,
        QuoteSource.QUOTE_PAGE,
      ]

      if (!value.domain) ctx.addIssue({ code: "custom", path: ["domain"], message: "Choose what you are looking for." })
      if (!generalSources.includes(value.source))
        ctx.addIssue({ code: "custom", path: ["source"], message: unreadable })

      /**
       * A catalogue's own form can only raise an enquiry about that
       * catalogue. The source is what reporting later reads ("which page
       * generates enquiries"), and a crafted POST filing a parts enquiry as
       * coming from the cars catalogue would quietly falsify it.
       */
      const impliedDomain: Partial<Record<QuoteSource, QuoteType>> = {
        [QuoteSource.VEHICLE_CATALOGUE]: QuoteType.VEHICLE,
        [QuoteSource.SPARE_PART_CATALOGUE]: QuoteType.SPARE_PART,
      }
      const implied = impliedDomain[value.source]

      if (implied && value.domain && implied !== value.domain) {
        ctx.addIssue({ code: "custom", path: ["domain"], message: unreadable })
      }

      /**
       * A general request is *only* its description, so there has to be
       * one: either a message long enough to act on, or the structured
       * fields that say the same thing.
       */
      const described =
        (value.notes?.length ?? 0) >= 10 ||
        Boolean(value.make || value.model || value.partName || value.partNumber)

      if (!described) {
        ctx.addIssue({
          code: "custom",
          path: ["notes"],
          message: "Tell us what you are looking for — a sentence or two is enough.",
        })
      }
    }

    if (!value.whatsappSameAsPhone && !value.whatsapp) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp"],
        message: "Enter your WhatsApp number, or tick “Same as my phone number”.",
      })
    }
  })
  .transform((value, ctx) => {
    const phone = normalizePhoneNumber(value.phone, value.phoneCountry)

    if (!phone) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a valid phone number, e.g. 912 345 678.",
      })
      return z.NEVER
    }

    let whatsapp: string = phone

    if (!value.whatsappSameAsPhone && value.whatsapp) {
      const normalised = normalizePhoneNumber(value.whatsapp, value.whatsappCountry)

      if (!normalised) {
        ctx.addIssue({
          code: "custom",
          path: ["whatsapp"],
          message: "Enter a valid WhatsApp number.",
        })
        return z.NEVER
      }

      whatsapp = normalised
    }

    return { ...value, phone, whatsapp }
  })

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>

// ─────────────────────────────────────────────────────────────────────
// Operator actions
// ─────────────────────────────────────────────────────────────────────

const quoteIdField = z.string().trim().min(1, "Missing quote.").max(64)

/** Lines per quotation. Past this it is a tender, not a quote, and the PDF
 *  stops fitting on the pages a customer will actually read. */
export const QUOTE_MAX_LINES = 30

/** Per-line quantity ceiling. A vehicle line is held to one separately. */
export const QUOTE_LINE_MAX_QUANTITY = 100

/** Our own listing references — the only way a line is linked to stock. */
export const LISTING_REFERENCE_PATTERN = /^CLM-(V|SP)-\d{4}-\d{6}$/

const unitPriceField = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return null
    if (typeof value === "number") return String(value)
    if (typeof value === "string" && value.trim() === "") return null
    return value
  },
  z.union([
    z.null(),
    z.string().transform((value, ctx) => {
      const parsed = parseMoneyInput(value)

      if (parsed === null) {
        ctx.addIssue({
          code: "custom",
          message: "Prices are whole dollars or dollars and cents, e.g. 22500 or 1800.50.",
        })
        return z.NEVER
      }

      return parsed
    }),
  ])
)

export const quoteLineSchema = z
  .object({
    /** An existing line's id, or absent for a new one. */
    id: z.string().trim().max(64).optional(),
    kind: z.enum(["ITEM", "ACCESSORY"]),
    description: z
      .string()
      .trim()
      .min(1, "Every line needs a description.")
      .max(300, "Keep each description under 300 characters."),
    quantity: z.coerce
      .number({ error: "Quantities are whole numbers." })
      .int("Quantities are whole numbers.")
      .min(1, "Quantities start at one.")
      .max(QUOTE_LINE_MAX_QUANTITY, `At most ${QUOTE_LINE_MAX_QUANTITY} per line.`),
    unitPrice: unitPriceField,
    /** CLM-V-… or CLM-SP-…, linking the line to a listing. */
    reference: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toUpperCase() || undefined : undefined),
      z
        .string()
        .regex(LISTING_REFERENCE_PATTERN, "Use a listing reference such as CLM-V-2026-000123.")
        .optional()
    ),
  })
  .superRefine((line, ctx) => {
    if (line.kind === "ACCESSORY" && line.reference) {
      ctx.addIssue({
        code: "custom",
        path: ["reference"],
        message: "Accessories are not linked to a listing.",
      })
    }

    // A vehicle is one physical unit; two of the same car is not a thing.
    if (line.reference?.startsWith("CLM-V-") && line.quantity !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "A vehicle line is always quantity one.",
      })
    }
  })

export type QuoteLineInput = z.infer<typeof quoteLineSchema>

const optionalMoneyField = (field: string) =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .transform((value, ctx) => {
        const parsed = parseMoneyInput(value)

        if (parsed === null) {
          ctx.addIssue({ code: "custom", message: `${field} must be an amount, e.g. 1800 or 1800.50.` })
          return z.NEVER
        }

        return parsed
      })
      .optional()
  )

/** A calendar date from an `<input type="date">`, stored as the start of
 *  that day in UTC — the shape `isPastValidity` expects. */
const validUntilField = z.preprocess(
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

      const oneYearAhead = Date.now() + 366 * 24 * 60 * 60 * 1000

      if (date.getTime() > oneYearAhead) {
        ctx.addIssue({ code: "custom", message: "A quotation cannot be valid for more than a year." })
        return z.NEVER
      }

      return date
    })
    .optional()
)

/**
 * Everything an operator edits on the quote detail page, saved by the one
 * "Save details" action: line items, fees (including the miscellaneous
 * fourth one), validity, the text that ends up in the PDF and dispatch
 * message, and the staff-only notes that never leave this screen.
 */
export const quoteDetailsSchema = z.object({
  quoteId: quoteIdField,
  /** Optimistic concurrency — see updateVehicleAction for the mechanism. */
  expectedUpdatedAt: z.coerce.date({ error: "Reload the page and try again." }),
  lines: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value
      if (value.trim() === "") return []

      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    },
    z.array(quoteLineSchema).max(QUOTE_MAX_LINES, `At most ${QUOTE_MAX_LINES} lines per quotation.`)
  ),
  shippingCost: optionalMoneyField("Shipping"),
  clearingCost: optionalMoneyField("Clearing"),
  importDuty: optionalMoneyField("Import duty"),
  otherCostsLabel: optionalText("Other costs label", 120),
  otherCostsAmount: optionalMoneyField("Other costs"),
  validUntil: validUntilField,
  paymentInstructions: optionalText("Payment instructions", 2000),
  terms: optionalText("Terms", 3000),
  adminNotes: optionalText("Internal notes", 5000),
})

export type QuoteDetailsInput = z.infer<typeof quoteDetailsSchema>

export const quoteStatusSchema = z.object({
  quoteId: quoteIdField,
  status: z.enum(QuoteStatus, { error: "That is not a valid status." }),
  /** Why a quote was lost or reopened — recorded in the audit trail. */
  reason: optionalText("Reason", 500),
})

export const quoteDispatchSchema = z.object({
  quoteId: quoteIdField,
  channel: z.enum(QuoteDispatchChannel, { error: "Choose WhatsApp, email, or both." }),
  includeLink: checkboxField,
  /** The operator's editable opening line. Blank falls back to
   *  `defaultQuoteNote` server-side — see `sendQuoteDispatchAction`. */
  note: optionalText("Message", 2000),
  /** Optional notes or instructions printed under the figures. */
  instructions: optionalText("Additional notes", 2000),
  /**
   * Minted by the dialog each time it opens, so a double-click or a retried
   * request cannot email the same quotation twice. A malformed value only
   * loses that protection; it never blocks a send.
   */
  dispatchId: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^[A-Za-z0-9-]{8,64}$/)
      .optional()
      .catch(undefined)
  ),
})

export const quoteRefSchema = z.object({ quoteId: quoteIdField })

export const convertQuoteSchema = z
  .object({
    quoteId: quoteIdField,
    /** The operator's explicit confirmation that the customer accepted. An
     *  order is only ever created from an accepted quote (schema §6). */
    confirmAccepted: checkboxField,
  })
  .refine((value) => value.confirmAccepted, {
    path: ["confirmAccepted"],
    message: "Confirm that the customer has accepted this quotation.",
  })

export const quoteListFiltersSchema = z.object({
  search: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(QuoteStatus).optional().catch(undefined),
  type: z.enum(QuoteType).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
})

export type QuoteListFilters = z.infer<typeof quoteListFiltersSchema>
