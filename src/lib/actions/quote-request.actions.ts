"use server"

import { after } from "next/server"

import { QuoteLineKind, QuoteType } from "@/generated/prisma/enums"
import { logSecurityEvent } from "@/lib/audit"
import { notifyAdminsOfQuoteRequest, notifyCustomerQuoteReceived } from "@/lib/email/notifications"
import { MAX_ITEM_QUANTITY } from "@/lib/cart/cart-storage"
import { getClientIp } from "@/lib/auth/client-ip"
import {
  QUOTE_REQUEST_MAX_PER_IP,
  QUOTE_REQUEST_MAX_PER_PHONE,
  QUOTE_REQUEST_WINDOW_MS,
  RATE_LIMIT_SCOPES,
  consumeRateLimit,
  pruneExpiredAttempts,
  type RateLimitKey,
} from "@/lib/auth/rate-limit"
import { prisma } from "@/lib/prisma"
import { publicSparePartWhere } from "@/lib/queries/public-spare-part.queries"
import { publicVehicleWhere } from "@/lib/queries/public-vehicle.queries"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { VEHICLE_INFO_FIELDS, resolveVisibility, shown } from "@/lib/visibility/product-visibility"
import { resolveCustomerForEnquiry } from "@/lib/quotes/customer-resolution"
import {
  sparePartLineDescription,
  vehicleLineDescription,
} from "@/lib/quotes/quote-subjects"
import { generateReference } from "@/lib/utils/generate-reference"
import {
  QUOTE_HONEYPOT_FIELD,
  quoteRequestSchema,
  type QuoteRequestInput,
} from "@/lib/validations/quote.schema"

/**
 * The public quotation request — the one write path an anonymous visitor can
 * reach.
 *
 * One action serves every request surface: the "Get a quote" panel on a
 * vehicle page, "Request items" in the parts list, the "haven't found it?"
 * panels on both catalogues, and the Get a Quote page. They differ only in
 * what they are *about*, which `requestKind` carries, so a single validated
 * path writes every enquiry the same way and there is no second, less careful
 * one.
 *
 * ── What is never trusted ─────────────────────────────────────────────
 *   - Identifiers. A vehicle or part arrives as a slug and is re-read here
 *     through the same visibility rule the public catalogue uses, so a
 *     request cannot be raised against a draft, an archived listing or a car
 *     already reserved for someone else.
 *   - Descriptions and prices. The line's wording is snapshotted from the
 *     catalogue on the server; no price is accepted from the browser at all.
 *     Lines start unpriced and an operator prices them — see QuoteItem.
 *   - The contact details, as identity. They are stored on the enquiry as a
 *     snapshot and used to *find* a customer, never to overwrite one. See
 *     customer-resolution.ts.
 *
 * ── Abuse controls ────────────────────────────────────────────────────
 * Rate limited per host and per phone number, with a honeypot field for
 * form-filling bots. Both answer in the same neutral way wherever the answer
 * would otherwise teach an attacker something.
 */

export interface QuoteRequestState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Record<string, string[]>
  /**
   * What the customer typed, echoed back so a rejected submission does not
   * wipe the form. React resets a `<form action>` to its defaults once the
   * action settles, whatever the outcome — see VehicleFormState.values for
   * the long version.
   */
  values?: Record<string, string>
  /** The reference the customer can quote back, on success. */
  quoteNumber?: string
  /** Parts that had left the catalogue since they were shortlisted. */
  skippedItems?: number
}

/**
 * The fields echoed back on a failed submission. An allowlist, so neither
 * the honeypot nor Next.js's own action fields are serialised back into the
 * page.
 */
const ECHOED_FIELDS = [
  "fullName",
  "phoneCountry",
  "phone",
  "whatsappSameAsPhone",
  "whatsappCountry",
  "whatsapp",
  "email",
  "city",
  "notes",
  "domain",
  "make",
  "model",
  "preferredYear",
  "maxBudget",
  "preferredCountry",
  "fuelType",
  "transmission",
  "partName",
  "partNumber",
] as const

/** Past the longest field the schema accepts; a longer value is already
 *  invalid and echoing all of it would only carry a payload back and forth. */
const MAX_ECHOED_LENGTH = 2100

function echoedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}

  for (const field of ECHOED_FIELDS) {
    const value = formData.get(field)
    if (typeof value === "string") values[field] = value.slice(0, MAX_ECHOED_LENGTH)
  }

  return values
}

const RATE_LIMITED_MESSAGE =
  "You have sent several requests in the last hour. Please try again a little later, or message us on WhatsApp and we will help straight away."

const GENERIC_FAILURE =
  "We could not send your request just now. Please try again in a moment, or message us on WhatsApp."

/** A requested subject that has left the catalogue since the page loaded. */
class SubjectUnavailableError extends Error {}

interface PreparedLine {
  kind: QuoteLineKind
  displayOrder: number
  description: string
  quantity: number
  vehicleId?: string
  sparePartId?: string
}

interface PreparedSubject {
  type: QuoteType
  linkedVehicleId: string | null
  lines: PreparedLine[]
  skippedItems: number
}

/**
 * Resolves what the request is about into quotation lines, from the
 * catalogue as it stands now.
 */
async function prepareSubject(input: QuoteRequestInput): Promise<PreparedSubject> {
  if (input.requestKind === "VEHICLE_LISTING") {
    const [vehicle, { catalogDisplay }] = await Promise.all([
      prisma.vehicle.findFirst({
        // `publicVehicleWhere`, so a slug that is no longer published — sold,
        // reserved for another customer, withdrawn — cannot be requested.
        where: publicVehicleWhere({ slug: input.vehicleSlug }),
        select: {
          id: true,
          make: true,
          model: true,
          year: true,
          transmission: true,
          hiddenFields: true,
        },
      }),
      getPublicSiteSettings(),
    ])

    if (!vehicle) throw new SubjectUnavailableError()

    // The line is echoed straight back to the customer in the acknowledgement
    // email, so it names the car only by what the listing shows them.
    const visible = resolveVisibility(VEHICLE_INFO_FIELDS, catalogDisplay.vehicle, vehicle.hiddenFields)

    return {
      type: QuoteType.VEHICLE,
      linkedVehicleId: vehicle.id,
      lines: [
        {
          kind: QuoteLineKind.ITEM,
          displayOrder: 0,
          description: vehicleLineDescription({
            make: vehicle.make,
            model: vehicle.model,
            year: shown(visible.year, vehicle.year),
            transmission: shown(visible.transmission, vehicle.transmission),
          }),
          // A vehicle is one physical unit.
          quantity: 1,
          vehicleId: vehicle.id,
        },
      ],
      skippedItems: 0,
    }
  }

  if (input.requestKind === "PARTS_LIST") {
    /**
     * The same part listed twice (a hand-edited basket) is merged rather
     * than creating two lines an operator would have to reconcile.
     */
    const quantities = new Map<string, number>()
    for (const item of input.items ?? []) {
      quantities.set(
        item.slug,
        // Merged lines stay inside the same per-part ceiling a single line has.
        Math.min(MAX_ITEM_QUANTITY, (quantities.get(item.slug) ?? 0) + item.quantity)
      )
    }

    const parts = await prisma.sparePart.findMany({
      where: publicSparePartWhere({ slug: { in: [...quantities.keys()] } }),
      select: { id: true, slug: true, name: true },
    })

    if (parts.length === 0) throw new SubjectUnavailableError()

    const bySlug = new Map(parts.map((part) => [part.slug, part]))
    const lines: PreparedLine[] = []

    // In the order the customer shortlisted them.
    for (const [slug, quantity] of quantities) {
      const part = bySlug.get(slug)
      if (!part) continue

      lines.push({
        kind: QuoteLineKind.ITEM,
        displayOrder: lines.length,
        description: sparePartLineDescription(part),
        quantity,
        sparePartId: part.id,
      })
    }

    return {
      type: QuoteType.SPARE_PART,
      linkedVehicleId: null,
      lines,
      skippedItems: quantities.size - lines.length,
    }
  }

  // GENERAL: an enquiry about something not (or not yet) in the catalogue.
  // No lines — the operator adds them once they have sourced the answer.
  return {
    type: input.domain ?? QuoteType.VEHICLE,
    linkedVehicleId: null,
    lines: [],
    skippedItems: 0,
  }
}

/**
 * The structured "what I am looking for" fields, kept only where they mean
 * something for the enquiry's domain. A crafted POST sending a fuel type with
 * a parts enquiry has it ignored rather than stored as noise an operator
 * then has to interpret.
 */
function requestedDetails(input: QuoteRequestInput, type: QuoteType) {
  if (input.requestKind !== "GENERAL") {
    return {}
  }

  const common = {
    requestedMake: input.make ?? null,
    requestedModel: input.model ?? null,
    preferredYear: input.preferredYear ?? null,
  }

  if (type === QuoteType.SPARE_PART) {
    return {
      ...common,
      requestedPartName: input.partName ?? null,
      requestedPartNumber: input.partNumber ?? null,
    }
  }

  return {
    ...common,
    maxBudget: input.maxBudget ?? null,
    preferredCountry: input.preferredCountry ?? null,
    fuelType: input.fuelType ?? null,
    transmission: input.transmission ?? null,
  }
}

async function buildRateLimitKeys(phone: string): Promise<{
  ip: RateLimitKey | null
  phone: RateLimitKey
}> {
  const ip = await getClientIp()

  return {
    // Omitted rather than bucketed under a placeholder when unreadable — see
    // client-ip.ts: a shared "unknown" bucket would let one visitor lock out
    // everyone whose address could not be read.
    ip: ip ? { scope: RATE_LIMIT_SCOPES.quoteRequestIp, identifier: ip } : null,
    phone: { scope: RATE_LIMIT_SCOPES.quoteRequestPhone, identifier: phone },
  }
}

/** A one-line description of the enquiry, for the acknowledgement emails. */
function enquirySummary(input: QuoteRequestInput, subject: PreparedSubject): string {
  const described = subject.lines.map((line) =>
    line.quantity > 1 ? `${line.quantity} × ${line.description}` : line.description
  )

  if (described.length === 1) return described[0]
  if (described.length > 1) {
    return `${described.length} items: ${described.slice(0, 3).join("; ")}${described.length > 3 ? "; …" : ""}`
  }

  const vehicle = [input.preferredYear, input.make, input.model].filter(Boolean).join(" ")

  if (subject.type === QuoteType.SPARE_PART) {
    const part = input.partName ?? "Spare part"
    return vehicle ? `${part} for ${vehicle}` : part
  }

  return vehicle || "Vehicle enquiry"
}

export async function submitQuoteRequestAction(
  _prevState: QuoteRequestState,
  formData: FormData
): Promise<QuoteRequestState> {
  const values = echoedValues(formData)

  /**
   * The honeypot. A person never sees this field; a bot that fills it gets
   * the same shape of reply a person does, minus the reference, and nothing
   * is written. Logged so a spike is visible.
   */
  const trap = formData.get(QUOTE_HONEYPOT_FIELD)
  if (typeof trap === "string" && trap.trim().length > 0) {
    logSecurityEvent("quote_request_honeypot_triggered", {})
    return {
      status: "success",
      message: "Thank you — your request has been received. We will be in touch shortly.",
    }
  }

  const parsed = quoteRequestSchema.safeParse({
    requestKind: formData.get("requestKind"),
    source: formData.get("source"),
    domain: formData.get("domain"),
    fullName: formData.get("fullName") ?? "",
    phoneCountry: formData.get("phoneCountry") ?? undefined,
    phone: formData.get("phone") ?? "",
    whatsappSameAsPhone: formData.get("whatsappSameAsPhone"),
    whatsappCountry: formData.get("whatsappCountry") ?? undefined,
    whatsapp: formData.get("whatsapp"),
    email: formData.get("email"),
    city: formData.get("city") ?? "",
    notes: formData.get("notes"),
    vehicleSlug: formData.get("vehicleSlug"),
    items: formData.get("items"),
    make: formData.get("make"),
    model: formData.get("model"),
    preferredYear: formData.get("preferredYear"),
    maxBudget: formData.get("maxBudget"),
    preferredCountry: formData.get("preferredCountry"),
    fuelType: formData.get("fuelType"),
    transmission: formData.get("transmission"),
    partName: formData.get("partName"),
    partNumber: formData.get("partNumber"),
  })

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>

    /**
     * An error on a field the customer cannot see — the request kind, the
     * source, the vehicle slug — means the page is stale or the POST was
     * crafted. Surfaced as the form's message rather than attached to a
     * field that is not rendered.
     */
    const hidden = ["requestKind", "source", "vehicleSlug", "items", "domain"]
      .map((field) => fieldErrors[field]?.[0])
      .find(Boolean)

    return {
      status: "error",
      message: hidden ?? "Please check the highlighted details and try again.",
      fieldErrors,
      values,
    }
  }

  const input = parsed.data

  // ── Throttle ──────────────────────────────────────────────────────────
  // Counted and checked in one step, before anything is stored, so a burst
  // of parallel submissions cannot all pass the check together — see
  // consumeRateLimit.
  const keys = await buildRateLimitKeys(input.phone)

  const verdict = await consumeRateLimit(
    [
      ...(keys.ip ? [{ key: keys.ip, max: QUOTE_REQUEST_MAX_PER_IP }] : []),
      { key: keys.phone, max: QUOTE_REQUEST_MAX_PER_PHONE },
    ],
    QUOTE_REQUEST_WINDOW_MS
  )

  if (!verdict.allowed) {
    logSecurityEvent("quote_request_rate_limited", {})
    // Housekeeping rides on the refusal path, where it costs nothing a real
    // customer notices.
    await pruneExpiredAttempts()

    return { status: "error", message: RATE_LIMITED_MESSAGE, values }
  }

  // ── What is being asked about ───────────────────────────────────────
  let subject: PreparedSubject

  try {
    subject = await prepareSubject(input)
  } catch (error) {
    if (error instanceof SubjectUnavailableError) {
      return {
        status: "error",
        message:
          input.requestKind === "VEHICLE_LISTING"
            ? "Sorry — this vehicle has just been reserved or taken off the market. Tell us what you are looking for through Get a Quote and we will find you an alternative."
            : "The parts in your list are no longer listed. Remove them and add them again from the catalogue, or describe what you need through Get a Quote.",
        values,
      }
    }

    console.error("[quote-request] failed to resolve the request subject", error)
    return { status: "error", message: GENERIC_FAILURE, values }
  }

  const write = () =>
    prisma.$transaction(async (tx) => {
      const customer = await resolveCustomerForEnquiry(tx, {
        fullName: input.fullName,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        city: input.city,
      })

      // Allocated inside the transaction, so a failed insert rolls the
      // counter back and leaves no gap in the quote series.
      const quoteNumber = await generateReference(tx, "QUOTE")

      const created = await tx.quote.create({
        data: {
          quoteNumber,
          customerId: customer.id,
          type: subject.type,
          source: input.source,
          linkedVehicleId: subject.linkedVehicleId,
          ...requestedDetails(input, subject.type),
          additionalRequirements: input.notes ?? null,
          contactName: input.fullName,
          contactPhone: input.phone,
          contactWhatsapp: input.whatsapp,
          contactEmail: input.email ?? null,
          contactCity: input.city,
          items: subject.lines.length > 0 ? { create: subject.lines } : undefined,
        },
        select: { id: true },
      })

      return { quoteNumber, quoteId: created.id }
    })

  let written: { quoteNumber: string; quoteId: string }

  try {
    // Simultaneous submissions from one identity are serialised inside
    // resolveCustomerForEnquiry, so there is no race here to retry.
    written = await write()
  } catch (error) {
    console.error("[quote-request] failed to store the request", error)
    return { status: "error", message: GENERIC_FAILURE, values }
  }

  /**
   * The acknowledgement to the customer and the alert to staff go out after
   * the response, so the customer is not kept waiting on two email round
   * trips. Neither can fail the request: it is already stored, and each
   * notification logs its own failure (see notifications.ts).
   */
  const summary = enquirySummary(input, subject)
  after(async () => {
    await Promise.all([
      notifyCustomerQuoteReceived({
        to: input.email ?? null,
        customerName: input.fullName,
        quoteNumber: written.quoteNumber,
        summary,
      }),
      notifyAdminsOfQuoteRequest({
        quoteId: written.quoteId,
        quoteNumber: written.quoteNumber,
        typeLabel: subject.type === QuoteType.SPARE_PART ? "Spare parts" : "Vehicle",
        summary,
        contactName: input.fullName,
        contactPhone: input.phone,
        contactWhatsapp: input.whatsapp,
        contactEmail: input.email ?? null,
        contactCity: input.city,
        notes: input.notes ?? null,
      }),
    ])
  })

  return {
    status: "success",
    message: "Thank you — your request has been received.",
    quoteNumber: written.quoteNumber,
    skippedItems: subject.skippedItems,
  }
}
