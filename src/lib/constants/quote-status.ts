import {
  QuoteDispatchChannel,
  QuoteSource,
  QuoteStatus,
  QuoteType,
} from "@/generated/prisma/enums"
import type { StatusTone } from "@/components/admin/status-badge"

/**
 * The quote lifecycle: what each status is called, how it looks, and which
 * moves between them are allowed.
 *
 * ── Why the matrix lives here, not in a component ─────────────────────
 * Exactly the lesson vehicle-status-transitions.ts records: a rule that only
 * exists in the browser is not a rule. The status control renders its buttons
 * from this table and the server action refuses anything the table does not
 * list, so a stale tab or a crafted POST cannot, for instance, reopen a quote
 * that has already become an order. Pure data, no server imports, so both
 * sides read the same definition.
 *
 * ── The shape of it ───────────────────────────────────────────────────
 *
 *    NEW ──► CONTACTED ──► SENT ──► ACCEPTED ──► WON (order created)
 *     │          │           │  ▲       │
 *     │          │           │  └───────┘ reopened to revise
 *     └──────────┴───────────┴──────────┴──► LOST (REJECTED)
 *                            └──► EXPIRED ──► reopened
 *
 * Two moves are deliberately absent from the manual control:
 *
 *   - Into SENT. A quotation is marked sent by *sending* it, through the
 *     dispatch action, which is the only path that checks it is fully priced
 *     and in date. A button that merely set the flag would let an unpriced
 *     quote read as sent.
 *   - Into WON. That is the conversion, which creates the order, reserves the
 *     stock and builds the payment milestones in one transaction. A status
 *     change that skipped all of that would be a "won" quote with no order.
 */

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  SENT: "Quote sent",
  ACCEPTED: "Accepted",
  WON: "Won",
  // Stored as REJECTED — the value predates this screen — and shown as Lost,
  // which is what an operator calls a quote that did not become a sale
  // whoever walked away.
  REJECTED: "Lost",
  EXPIRED: "Expired",
}

export const QUOTE_STATUS_DESCRIPTIONS: Record<QuoteStatus, string> = {
  NEW: "Just arrived. Nobody has picked it up yet.",
  CONTACTED: "Being worked: the customer has been contacted and the quotation is being prepared.",
  SENT: "The priced quotation has been sent. Waiting for the customer's answer.",
  ACCEPTED: "The customer has accepted. Convert it to an order to reserve the stock.",
  WON: "Converted into an order.",
  REJECTED: "Closed without a sale.",
  EXPIRED: "The validity date passed without an answer.",
}

export const QUOTE_STATUS_TONES: Record<QuoteStatus, StatusTone> = {
  NEW: "warning",
  CONTACTED: "neutral",
  SENT: "neutral",
  ACCEPTED: "positive",
  WON: "positive",
  REJECTED: "muted",
  EXPIRED: "muted",
}

/**
 * The order statuses appear in — chips, the list filter, the dashboard. The
 * enum's own order is append-only (see schema.prisma) and reads out of
 * sequence, so display order is stated here once.
 */
export const QUOTE_STATUS_ORDER: readonly QuoteStatus[] = [
  QuoteStatus.NEW,
  QuoteStatus.CONTACTED,
  QuoteStatus.SENT,
  QuoteStatus.ACCEPTED,
  QuoteStatus.WON,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
]

export const QUOTE_TYPE_LABELS: Record<QuoteType, string> = {
  VEHICLE: "Vehicle",
  SPARE_PART: "Spare parts",
}

export const QUOTE_SOURCE_LABELS: Record<QuoteSource, string> = {
  VEHICLE_PAGE: "Vehicle page",
  VEHICLE_CATALOGUE: "Cars catalogue",
  SPARE_PART_CART: "Parts list",
  SPARE_PART_CATALOGUE: "Parts catalogue",
  QUOTE_PAGE: "Get a Quote page",
}

export const QUOTE_CHANNEL_LABELS: Record<QuoteDispatchChannel, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
}

/**
 * Moves an operator may make by hand. See the note above for why SENT and
 * WON are never targets here.
 */
export const MANUAL_QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  NEW: [QuoteStatus.CONTACTED, QuoteStatus.REJECTED],
  CONTACTED: [QuoteStatus.REJECTED],
  SENT: [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED],
  // Back to SENT reopens an accepted quote for revision — the only way to
  // change figures a customer has already agreed to, and an audited one.
  ACCEPTED: [QuoteStatus.SENT, QuoteStatus.REJECTED],
  // Terminal. The order exists, and a cancelled order does not resurrect
  // its quote: Order.quoteId is unique, so a new sale needs a new quote.
  WON: [],
  REJECTED: [QuoteStatus.CONTACTED],
  EXPIRED: [QuoteStatus.CONTACTED],
}

export function canTransitionQuoteStatus(from: QuoteStatus, to: QuoteStatus): boolean {
  return MANUAL_QUOTE_TRANSITIONS[from].includes(to)
}

/** What the button that moves a quote to `to` says. */
export const QUOTE_TRANSITION_LABELS: Record<QuoteStatus, string> = {
  NEW: "Mark as new",
  CONTACTED: "Mark as contacted",
  SENT: "Reopen for revision",
  ACCEPTED: "Customer accepted",
  WON: "Won",
  REJECTED: "Mark as lost",
  EXPIRED: "Mark as expired",
}

/** Reopening moves out of a closed state and reads differently from a forward move. */
export function transitionLabel(from: QuoteStatus, to: QuoteStatus): string {
  if (to === QuoteStatus.CONTACTED && (from === QuoteStatus.REJECTED || from === QuoteStatus.EXPIRED)) {
    return "Reopen"
  }

  return QUOTE_TRANSITION_LABELS[to]
}

/**
 * May the quotation's figures be edited in this status?
 *
 * Open until the customer has said yes. After ACCEPTED the figures are what
 * the customer agreed to, and changing them silently — the customer's PDF
 * link renders the live quote — would be the dealership moving the price
 * after the handshake. Reopening to SENT first makes that a deliberate,
 * audited step.
 */
export function isQuoteEditable(status: QuoteStatus): boolean {
  return (
    status === QuoteStatus.NEW ||
    status === QuoteStatus.CONTACTED ||
    status === QuoteStatus.SENT
  )
}

/** May the quotation be sent (or re-sent) to the customer in this status? */
export function isQuoteSendable(status: QuoteStatus): boolean {
  return isQuoteEditable(status) || status === QuoteStatus.ACCEPTED
}

/** May it be converted into an order in this status? */
export function isQuoteConvertible(status: QuoteStatus): boolean {
  return status === QuoteStatus.SENT || status === QuoteStatus.ACCEPTED
}

/**
 * Statuses in which the quote is still a live piece of work. Used by the
 * dashboard count and as the list's default emphasis.
 */
export const OPEN_QUOTE_STATUSES: readonly QuoteStatus[] = [
  QuoteStatus.NEW,
  QuoteStatus.CONTACTED,
  QuoteStatus.SENT,
  QuoteStatus.ACCEPTED,
]

export function describeRefusedQuoteTransition(from: QuoteStatus, to: QuoteStatus): string {
  return `This quote is ${QUOTE_STATUS_LABELS[from].toLowerCase()} and cannot be moved to ${QUOTE_STATUS_LABELS[to].toLowerCase()} from here. Reload the page to see the actions available now.`
}
