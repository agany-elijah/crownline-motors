import { fromCents, toCents, toCentsOrNull } from "@/lib/utils/money"

/**
 * What a quotation comes to.
 *
 * ── Derived, never stored ─────────────────────────────────────────────
 * A quote's total is computed from its lines and fees on every read — the
 * same principle the schema applies to an order's balance. A stored total
 * would be one more column every edit path had to remember to update, and
 * the first one that forgot would send a customer a PDF whose total does not
 * add up. The figure is frozen exactly once: into Order.totalAmount, when the
 * quote is converted.
 *
 * Pure, and used by the operator's editor (live, as they type), the server
 * action that validates a save, the PDF, the dispatch message and the
 * conversion — so all five agree to the cent by construction.
 */

export type QuoteLineKindValue = "ITEM" | "ACCESSORY"

export interface PricedQuoteLine {
  kind: QuoteLineKindValue
  quantity: number
  /** Per unit. Null while the operator has not priced the line. */
  unitPrice: number | null
}

export interface QuoteFees {
  shippingCost: number | null
  clearingCost: number | null
  importDuty: number | null
}

export interface QuoteTotals {
  /** ITEM lines — the vehicle or parts themselves. */
  itemsSubtotal: number
  /** ACCESSORY lines. */
  accessoriesTotal: number
  /** The three fees, summed. Unquoted fees contribute nothing. */
  feesTotal: number
  total: number
  /** Lines with no price yet. A quote with any cannot be sent or converted. */
  unpricedLines: number
  /** How many ITEM lines there are. A quote with none has nothing to sell. */
  itemLineCount: number
}

/** One line's total in cents: unit × quantity, or null while unpriced. */
export function lineTotalCents(line: Pick<PricedQuoteLine, "quantity" | "unitPrice">): number | null {
  if (line.unitPrice === null) return null

  return toCents(line.unitPrice) * line.quantity
}

export function computeQuoteTotals(
  lines: readonly PricedQuoteLine[],
  fees: QuoteFees
): QuoteTotals {
  let itemsCents = 0
  let accessoriesCents = 0
  let unpricedLines = 0
  let itemLineCount = 0

  for (const line of lines) {
    if (line.kind === "ITEM") itemLineCount += 1

    const cents = lineTotalCents(line)

    if (cents === null) {
      unpricedLines += 1
      continue
    }

    if (line.kind === "ITEM") itemsCents += cents
    else accessoriesCents += cents
  }

  const feesCents =
    (toCentsOrNull(fees.shippingCost) ?? 0) +
    (toCentsOrNull(fees.clearingCost) ?? 0) +
    (toCentsOrNull(fees.importDuty) ?? 0)

  return {
    itemsSubtotal: fromCents(itemsCents),
    accessoriesTotal: fromCents(accessoriesCents),
    feesTotal: fromCents(feesCents),
    total: fromCents(itemsCents + accessoriesCents + feesCents),
    unpricedLines,
    itemLineCount,
  }
}

/**
 * Why a quotation is not ready to leave the building, or null if it is.
 *
 * Shared by the dispatch action and the conversion so that "can this be
 * sent" and "can this become an order" never disagree about what a finished
 * quotation is. Each reason is a sentence an operator can act on.
 */
export function quoteReadinessProblem(input: {
  lines: readonly PricedQuoteLine[]
  fees: QuoteFees
  validUntil: Date | null
  now?: Date
}): string | null {
  const totals = computeQuoteTotals(input.lines, input.fees)

  if (totals.itemLineCount === 0) {
    return "Add at least one item to the quotation before sending it."
  }

  if (totals.unpricedLines > 0) {
    return totals.unpricedLines === 1
      ? "One line has no price yet. Price every line before sending."
      : `${totals.unpricedLines} lines have no price yet. Price every line before sending.`
  }

  if (totals.total <= 0) {
    return "The quotation totals nothing. Check the prices before sending."
  }

  if (!input.validUntil) {
    return "Set the date this quotation is valid until before sending it."
  }

  if (isPastValidity(input.validUntil, input.now)) {
    return "This quotation's validity date has passed. Extend it before sending or converting."
  }

  return null
}

/**
 * Has the validity date passed?
 *
 * `validUntil` is stored as the start of the chosen day in UTC and honoured
 * for the whole of it — a quotation "valid until 30 September" is still good
 * on the afternoon of the 30th in Juba (UTC+2). So it lapses at the end of
 * that UTC day, never at the moment the day begins.
 */
export function isPastValidity(validUntil: Date, now: Date = new Date()): boolean {
  const endOfDay = Date.UTC(
    validUntil.getUTCFullYear(),
    validUntil.getUTCMonth(),
    validUntil.getUTCDate(),
    23,
    59,
    59,
    999
  )

  return now.getTime() > endOfDay
}

/** Today plus `days`, as the start of that UTC day — the shape `validUntil` is stored in. */
export function validityDateFrom(days: number, now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days)
  )
}
