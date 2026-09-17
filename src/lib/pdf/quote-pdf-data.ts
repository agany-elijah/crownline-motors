import { QuoteType } from "@/generated/prisma/enums"
import { computeQuoteTotals, type PricedQuoteLine, type QuoteFees } from "@/lib/quotes/quote-pricing"

/**
 * Maps a quotation's stored fields to what the PDF actually renders.
 *
 * Pure and separate from the database read (`getQuoteForPdf` in
 * quote.queries.ts) so the two can be tested and reasoned about
 * independently: this file decides what a customer sees, that one decides
 * what is allowed to reach it. Nothing internal is threaded through here —
 * no admin notes, no customer id, no supplier information — the source
 * query already leaves those out, and this function has no field to carry
 * them in even if it did.
 */

export interface QuotePdfSourceLine {
  kind: "ITEM" | "ACCESSORY"
  description: string
  quantity: number
  quotedUnitPrice: number | null
}

export interface QuotePdfSource {
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
  items: readonly QuotePdfSourceLine[]
}

export interface QuotePdfLine {
  description: string
  quantity: number
  unitPrice: number | null
  lineTotal: number | null
  kind: "ITEM" | "ACCESSORY"
}

export interface QuotePdfData {
  siteName: string
  quoteNumber: string
  issuedAt: Date
  validUntil: Date | null
  customerName: string
  customerCity: string | null
  customerPhone: string | null
  customerEmail: string | null
  lines: QuotePdfLine[]
  itemsSubtotal: number
  accessoriesTotal: number
  shippingCost: number | null
  clearingCost: number | null
  importDuty: number | null
  otherCostsLabel: string | null
  otherCostsAmount: number | null
  total: number
  paymentInstructions: string | null
  terms: string | null
  isVehicle: boolean
}

/**
 * `Quotation-CLM-Q-2026-000045-John-Doe.pdf` — the pattern the dispatch and
 * preview routes both name the file with, so a customer sees the same
 * filename whether the PDF was attached to an email, downloaded from the
 * secure link, or previewed by an operator.
 *
 * The customer name is sanitised rather than trusted as-is: it comes from a
 * public quote-request form (`contactName`), and a filename is exactly the
 * kind of string a browser or mail client interprets structurally (path
 * separators, quotes) rather than displaying inertly.
 */
export function buildQuotationFilename(quoteNumber: string, customerName: string): string {
  const safeName = customerName
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `Quotation-${quoteNumber}-${safeName || "Customer"}.pdf`
}

/** `siteName` is Settings → Business information → Business name, printed on the document. */
export function buildQuotePdfData(source: QuotePdfSource, siteName: string): QuotePdfData {
  const priced: PricedQuoteLine[] = source.items.map((item) => ({
    kind: item.kind,
    quantity: item.quantity,
    unitPrice: item.quotedUnitPrice,
  }))
  const fees: QuoteFees = {
    shippingCost: source.shippingCost,
    clearingCost: source.clearingCost,
    importDuty: source.importDuty,
    otherCosts: source.otherCostsAmount,
  }
  const totals = computeQuoteTotals(priced, fees)

  return {
    siteName,
    quoteNumber: source.quoteNumber,
    issuedAt: source.createdAt,
    validUntil: source.validUntil,
    customerName: source.contactName ?? "Customer",
    customerCity: source.contactCity,
    customerPhone: source.contactPhone,
    customerEmail: source.contactEmail,
    lines: source.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.quotedUnitPrice,
      lineTotal:
        item.quotedUnitPrice === null ? null : item.quotedUnitPrice * item.quantity,
      kind: item.kind,
    })),
    itemsSubtotal: totals.itemsSubtotal,
    accessoriesTotal: totals.accessoriesTotal,
    shippingCost: source.shippingCost,
    clearingCost: source.clearingCost,
    importDuty: source.importDuty,
    otherCostsLabel: source.otherCostsLabel,
    otherCostsAmount: source.otherCostsAmount,
    total: totals.total,
    paymentInstructions: source.paymentInstructions,
    terms: source.terms,
    isVehicle: source.type === QuoteType.VEHICLE,
  }
}
