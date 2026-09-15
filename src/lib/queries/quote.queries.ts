import "server-only"

import { cache } from "react"

import type { Prisma } from "@/generated/prisma/client"
import { QuoteStatus, QuoteType, type QuoteDispatchChannel, type QuoteSource } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { summarizeOrderFinance, type OrderFinanceSummary } from "@/lib/orders/order-finance"
import { computeQuoteTotals, type QuoteTotals } from "@/lib/quotes/quote-pricing"
import type { QuoteListFilters } from "@/lib/validations/quote.schema"

/**
 * Reads for the quotation admin screens.
 *
 * Deliberately admin-only, mirroring `vehicle.queries.ts` and
 * `spare-part.queries.ts`: nothing here applies a visibility filter, because
 * an operator managing enquiries needs to see every one of them, including
 * lost and expired quotes.
 */

export const QUOTES_PER_PAGE = 20

const ITEM_SELECT = {
  kind: true,
  quantity: true,
  quotedUnitPrice: true,
} satisfies Prisma.QuoteItemSelect

function toItemTotals(
  items: readonly { kind: "ITEM" | "ACCESSORY"; quantity: number; quotedUnitPrice: Prisma.Decimal | null }[],
  fees: {
    shippingCost: Prisma.Decimal | null
    clearingCost: Prisma.Decimal | null
    importDuty: Prisma.Decimal | null
    otherCostsAmount: Prisma.Decimal | null
  }
): QuoteTotals {
  return computeQuoteTotals(
    items.map((item) => ({
      kind: item.kind,
      quantity: item.quantity,
      unitPrice: item.quotedUnitPrice?.toNumber() ?? null,
    })),
    {
      shippingCost: fees.shippingCost?.toNumber() ?? null,
      clearingCost: fees.clearingCost?.toNumber() ?? null,
      importDuty: fees.importDuty?.toNumber() ?? null,
      otherCosts: fees.otherCostsAmount?.toNumber() ?? null,
    }
  )
}

export interface QuoteListItem {
  id: string
  quoteNumber: string
  type: QuoteType
  status: QuoteStatus
  source: QuoteSource | null
  customerName: string
  contactPhone: string | null
  itemLineCount: number
  totals: QuoteTotals
  validUntil: Date | null
  sentAt: Date | null
  lastSentVia: QuoteDispatchChannel | null
  createdAt: Date
  updatedAt: Date
}

export interface QuoteListResult {
  quotes: QuoteListItem[]
  total: number
  page: number
  pageCount: number
}

function buildWhere(filters: QuoteListFilters): Prisma.QuoteWhereInput {
  const where: Prisma.QuoteWhereInput = {}

  if (filters.status) where.status = filters.status
  if (filters.type) where.type = filters.type

  if (filters.search) {
    const search = filters.search

    where.OR = [
      { quoteNumber: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
      { contactPhone: { contains: search, mode: "insensitive" } },
      { contactEmail: { contains: search, mode: "insensitive" } },
      { customer: { fullName: { contains: search, mode: "insensitive" } } },
    ]
  }

  return where
}

/** `id` breaks ties between quotes saved in the same second — see
 *  vehicle.queries.ts for why this matters for a paginated list. */
const LIST_ORDER_BY = [
  { createdAt: "desc" },
  { id: "asc" },
] satisfies Prisma.QuoteOrderByWithRelationInput[]

const LIST_SELECT = {
  id: true,
  quoteNumber: true,
  type: true,
  status: true,
  source: true,
  contactName: true,
  contactPhone: true,
  validUntil: true,
  sentAt: true,
  lastSentVia: true,
  createdAt: true,
  updatedAt: true,
  shippingCost: true,
  clearingCost: true,
  importDuty: true,
  otherCostsAmount: true,
  customer: { select: { fullName: true } },
  items: { select: ITEM_SELECT },
} satisfies Prisma.QuoteSelect

type ListRow = Prisma.QuoteGetPayload<{ select: typeof LIST_SELECT }>

function toListItem(row: ListRow): QuoteListItem {
  const totals = toItemTotals(row.items, row)

  return {
    id: row.id,
    quoteNumber: row.quoteNumber,
    type: row.type,
    status: row.status,
    source: row.source,
    customerName: row.customer.fullName,
    contactPhone: row.contactPhone,
    itemLineCount: totals.itemLineCount,
    totals,
    validUntil: row.validUntil,
    sentAt: row.sentAt,
    lastSentVia: row.lastSentVia,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listQuotes(filters: QuoteListFilters): Promise<QuoteListResult> {
  const where = buildWhere(filters)
  const page = Math.max(1, filters.page)

  const [total, rows] = await prisma.$transaction([
    prisma.quote.count({ where }),
    prisma.quote.findMany({
      where,
      orderBy: LIST_ORDER_BY,
      skip: (page - 1) * QUOTES_PER_PAGE,
      take: QUOTES_PER_PAGE,
      select: LIST_SELECT,
    }),
  ])

  const pageCount = Math.max(1, Math.ceil(total / QUOTES_PER_PAGE))

  // A page past the end (the last quotes on it moved status while it was
  // open) clamps to the last real page rather than showing an empty table
  // that reads as "nothing matches" — see listVehicles for the same rule.
  if (page > pageCount) {
    const lastPage = await prisma.quote.findMany({
      where,
      orderBy: LIST_ORDER_BY,
      skip: (pageCount - 1) * QUOTES_PER_PAGE,
      take: QUOTES_PER_PAGE,
      select: LIST_SELECT,
    })

    return { quotes: lastPage.map(toListItem), total, page: pageCount, pageCount }
  }

  return { quotes: rows.map(toListItem), total, page, pageCount }
}

/** Counts by status, for the list's filter chips. */
export const getQuoteStatusCounts = cache(async (): Promise<Record<string, number>> => {
  const rows = await prisma.quote.groupBy({ by: ["status"], _count: { _all: true } })

  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]))
})

/**
 * How many enquiries have arrived and not yet been picked up.
 *
 * Read on every dashboard-layout render to badge the "Quotes" nav entry —
 * cheap (one indexed count) and, because it runs on the server on every
 * navigation, it is current as of whichever page the operator just opened.
 * `QuoteLeadWatcher` polls a route handler backed by the same count to
 * surface new leads without a full navigation.
 */
export async function getNewQuoteLeadCount(): Promise<number> {
  return prisma.quote.count({ where: { status: QuoteStatus.NEW } })
}

export interface QuoteDetailItem {
  id: string
  kind: "ITEM" | "ACCESSORY"
  displayOrder: number
  description: string
  quantity: number
  quotedUnitPrice: number | null
  lineTotal: number | null
  reference: string | null
}

export interface QuoteDetailOrder {
  id: string
  orderNumber: string
  status: string
  finance: OrderFinanceSummary
  createdAt: Date
}

export interface QuoteDetail {
  id: string
  quoteNumber: string
  type: QuoteType
  status: QuoteStatus
  source: QuoteSource | null

  customerId: string
  customerName: string
  contactName: string | null
  contactPhone: string | null
  contactWhatsapp: string | null
  contactEmail: string | null
  contactCity: string | null

  linkedVehicle: { id: string; slug: string; make: string; model: string; year: number; referenceNumber: string } | null
  linkedSparePart: { id: string; slug: string; name: string; referenceNumber: string } | null

  requestedMake: string | null
  requestedModel: string | null
  preferredYear: number | null
  maxBudget: number | null
  preferredCountry: string | null
  fuelType: string | null
  transmission: string | null
  requestedPartName: string | null
  requestedPartNumber: string | null
  additionalRequirements: string | null

  items: QuoteDetailItem[]
  totals: QuoteTotals

  shippingCost: number | null
  clearingCost: number | null
  importDuty: number | null
  otherCostsLabel: string | null
  otherCostsAmount: number | null
  validUntil: Date | null
  paymentInstructions: string | null
  terms: string | null

  sentAt: Date | null
  lastSentVia: QuoteDispatchChannel | null
  shareToken: string | null

  adminNotes: string | null

  order: QuoteDetailOrder | null

  createdAt: Date
  updatedAt: Date
}

/**
 * One quotation by id, with everything its detail screen needs.
 *
 * Not `cache()`d: the detail page reads it once and every mutation on this
 * screen calls `revalidatePath` on the same URL, so a per-request cache
 * would only add a second, pointless layer atop what Next.js already gives
 * a Server Component within one render.
 */
export async function getQuoteById(id: string): Promise<QuoteDetail | null> {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, fullName: true } },
      linkedVehicle: {
        select: { id: true, slug: true, make: true, model: true, year: true, referenceNumber: true },
      },
      linkedSparePart: {
        select: { id: true, slug: true, name: true, referenceNumber: true },
      },
      items: {
        orderBy: { displayOrder: "asc" },
        include: {
          vehicle: { select: { referenceNumber: true } },
          sparePart: { select: { referenceNumber: true } },
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          milestones: {
            select: { id: true, sequence: true, label: true, amountDue: true, status: true },
          },
          payments: {
            select: { amount: true, status: true, milestoneId: true },
          },
        },
      },
    },
  })

  if (!quote) return null

  const items: QuoteDetailItem[] = quote.items.map((item) => ({
    id: item.id,
    kind: item.kind,
    displayOrder: item.displayOrder,
    description: item.description,
    quantity: item.quantity,
    quotedUnitPrice: item.quotedUnitPrice?.toNumber() ?? null,
    lineTotal:
      item.quotedUnitPrice === null ? null : item.quotedUnitPrice.toNumber() * item.quantity,
    reference: item.vehicle?.referenceNumber ?? item.sparePart?.referenceNumber ?? null,
  }))

  const totals = toItemTotals(quote.items, quote)

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    type: quote.type,
    status: quote.status,
    source: quote.source,

    customerId: quote.customerId,
    customerName: quote.customer.fullName,
    contactName: quote.contactName,
    contactPhone: quote.contactPhone,
    contactWhatsapp: quote.contactWhatsapp,
    contactEmail: quote.contactEmail,
    contactCity: quote.contactCity,

    linkedVehicle: quote.linkedVehicle,
    linkedSparePart: quote.linkedSparePart,

    requestedMake: quote.requestedMake,
    requestedModel: quote.requestedModel,
    preferredYear: quote.preferredYear,
    maxBudget: quote.maxBudget?.toNumber() ?? null,
    preferredCountry: quote.preferredCountry,
    fuelType: quote.fuelType,
    transmission: quote.transmission,
    requestedPartName: quote.requestedPartName,
    requestedPartNumber: quote.requestedPartNumber,
    additionalRequirements: quote.additionalRequirements,

    items,
    totals,

    shippingCost: quote.shippingCost?.toNumber() ?? null,
    clearingCost: quote.clearingCost?.toNumber() ?? null,
    importDuty: quote.importDuty?.toNumber() ?? null,
    otherCostsLabel: quote.otherCostsLabel,
    otherCostsAmount: quote.otherCostsAmount?.toNumber() ?? null,
    validUntil: quote.validUntil,
    paymentInstructions: quote.paymentInstructions,
    terms: quote.terms,

    sentAt: quote.sentAt,
    lastSentVia: quote.lastSentVia,
    shareToken: quote.shareToken,

    adminNotes: quote.adminNotes,

    order: quote.order
      ? {
          id: quote.order.id,
          orderNumber: quote.order.orderNumber,
          status: quote.order.status,
          createdAt: quote.order.createdAt,
          finance: summarizeOrderFinance({
            totalAmount: quote.order.totalAmount.toNumber(),
            milestones: quote.order.milestones.map((milestone) => ({
              id: milestone.id,
              sequence: milestone.sequence,
              label: milestone.label,
              amountDue: milestone.amountDue.toNumber(),
              status: milestone.status,
            })),
            payments: quote.order.payments.map((payment) => ({
              amount: payment.amount.toNumber(),
              status: payment.status,
              milestoneId: payment.milestoneId,
            })),
          }),
        }
      : null,

    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  }
}

/**
 * The one read the public quotation-PDF route is allowed to make.
 *
 * Selected explicitly rather than reusing `getQuoteById`: that function
 * returns internal fields — `adminNotes`, the customer's database id, the
 * linked-order relation — that must never reach an endpoint gated only by a
 * bearer token in a URL. Keeping the two queries separate means a field added
 * to the admin detail view cannot silently leak into the customer PDF by
 * accident.
 */
export interface QuotePdfSourceRow {
  quoteNumber: string
  type: QuoteType
  createdAt: Date
  validUntil: Date | null
  shippingCost: number | null
  clearingCost: number | null
  importDuty: number | null
  otherCostsLabel: string | null
  otherCostsAmount: number | null
  paymentInstructions: string | null
  terms: string | null
  contactName: string | null
  contactCity: string | null
  contactPhone: string | null
  contactEmail: string | null
  items: { kind: "ITEM" | "ACCESSORY"; description: string; quantity: number; quotedUnitPrice: number | null }[]
}

const QUOTE_PDF_SOURCE_SELECT = {
  quoteNumber: true,
  type: true,
  createdAt: true,
  validUntil: true,
  shippingCost: true,
  clearingCost: true,
  importDuty: true,
  otherCostsLabel: true,
  otherCostsAmount: true,
  paymentInstructions: true,
  terms: true,
  contactName: true,
  contactCity: true,
  contactPhone: true,
  contactEmail: true,
  items: {
    orderBy: { displayOrder: "asc" as const },
    select: { kind: true, description: true, quantity: true, quotedUnitPrice: true },
  },
} satisfies Prisma.QuoteSelect

function toQuotePdfSourceRow(
  quote: Prisma.QuoteGetPayload<{ select: typeof QUOTE_PDF_SOURCE_SELECT }>
): QuotePdfSourceRow {
  return {
    ...quote,
    shippingCost: quote.shippingCost?.toNumber() ?? null,
    clearingCost: quote.clearingCost?.toNumber() ?? null,
    importDuty: quote.importDuty?.toNumber() ?? null,
    otherCostsAmount: quote.otherCostsAmount?.toNumber() ?? null,
    items: quote.items.map((item) => ({
      kind: item.kind,
      description: item.description,
      quantity: item.quantity,
      quotedUnitPrice: item.quotedUnitPrice?.toNumber() ?? null,
    })),
  }
}

export async function getQuoteForPdf(shareToken: string): Promise<QuotePdfSourceRow | null> {
  const quote = await prisma.quote.findUnique({
    where: { shareToken },
    select: QUOTE_PDF_SOURCE_SELECT,
  })

  return quote ? toQuotePdfSourceRow(quote) : null
}

/**
 * The same narrow projection as `getQuoteForPdf`, keyed by id rather than
 * share token — for the admin "Preview quotation" action, which reviews the
 * PDF before a share link necessarily exists yet.
 *
 * Trusts its caller for authorization, like every other admin query in this
 * file: the route handler that calls this must check `quote:read` itself
 * (see `src/app/api/quotes/[id]/preview/route.ts`). It still returns the
 * same narrow shape as the token-based read — an operator previewing the
 * document should see exactly what the customer will, not a superset.
 */
export async function getQuoteForPdfById(id: string): Promise<QuotePdfSourceRow | null> {
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: QUOTE_PDF_SOURCE_SELECT,
  })

  return quote ? toQuotePdfSourceRow(quote) : null
}
