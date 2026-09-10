"use server"

import { QuoteLineKind, QuoteType } from "@/generated/prisma/enums"
import { logSecurityEvent } from "@/lib/audit"
import { MAX_ITEM_QUANTITY } from "@/lib/cart/cart-storage"
import { getClientIp } from "@/lib/auth/client-ip"
import {
  QUOTE_REQUEST_MAX_PER_IP,
  QUOTE_REQUEST_MAX_PER_PHONE,
  QUOTE_REQUEST_WINDOW_MS,
  RATE_LIMIT_SCOPES,
  checkRateLimit,
  pruneExpiredAttempts,
  recordAttempt,
  type RateLimitKey,
} from "@/lib/auth/rate-limit"
import { prisma } from "@/lib/prisma"
import { publicSparePartWhere } from "@/lib/queries/public-spare-part.queries"
import { publicVehicleWhere } from "@/lib/queries/public-vehicle.queries"
import { resolveCustomerForEnquiry } from "@/lib/quotes/customer-resolution"
import {
  sparePartLineDescription,
  vehicleLineDescription,
} from "@/lib/quotes/quote-subjects"
import { generateReference } from "@/lib/utils/generate-reference"
import { isUniqueConstraintViolation } from "@/lib/utils/prisma-errors"
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
    const vehicle = await prisma.vehicle.findFirst({
      // `publicVehicleWhere`, so a slug that is no longer published — sold,
      // reserved for another customer, withdrawn — cannot be requested.
      where: publicVehicleWhere({ slug: input.vehicleSlug }),
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        transmission: true,
        referenceNumber: true,
      },
    })

    if (!vehicle) throw new SubjectUnavailableError()

    return {
      type: QuoteType.VEHICLE,
      linkedVehicleId: vehicle.id,
      lines: [
        {
          kind: QuoteLineKind.ITEM,
          displayOrder: 0,
          description: vehicleLineDescription(vehicle),
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
      select: { id: true, slug: true, name: true, referenceNumber: true, oemPartNumber: true },
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
  const keys = await buildRateLimitKeys(input.phone)

  const [ipVerdict, phoneVerdict] = await Promise.all([
    keys.ip
      ? checkRateLimit([keys.ip], {
          max: QUOTE_REQUEST_MAX_PER_IP,
          windowMs: QUOTE_REQUEST_WINDOW_MS,
        })
      : Promise.resolve({ allowed: true, remaining: QUOTE_REQUEST_MAX_PER_IP }),
    checkRateLimit([keys.phone], {
      max: QUOTE_REQUEST_MAX_PER_PHONE,
      windowMs: QUOTE_REQUEST_WINDOW_MS,
    }),
  ])

  if (!ipVerdict.allowed || !phoneVerdict.allowed) {
    logSecurityEvent("quote_request_rate_limited", {
      bucket: !ipVerdict.allowed ? "ip" : "phone",
    })
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

      await tx.quote.create({
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

      return quoteNumber
    })

  let quoteNumber: string

  try {
    quoteNumber = await write()
  } catch (error) {
    /**
     * Two submissions with the same new email address can race between the
     * customer lookup and the insert. The loser hits the unique index; one
     * retry finds the row the winner created and links to it.
     */
    if (isUniqueConstraintViolation(error)) {
      try {
        quoteNumber = await write()
      } catch (retryError) {
        console.error("[quote-request] failed to store the request after retry", retryError)
        return { status: "error", message: GENERIC_FAILURE, values }
      }
    } else {
      console.error("[quote-request] failed to store the request", error)
      return { status: "error", message: GENERIC_FAILURE, values }
    }
  }

  // Counted on success: a stored request is exactly what is being throttled.
  await recordAttempt(keys.ip ? [keys.ip, keys.phone] : [keys.phone])

  return {
    status: "success",
    message: "Thank you — your request has been received.",
    quoteNumber,
    skippedItems: subject.skippedItems,
  }
}
