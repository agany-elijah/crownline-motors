import { formatCurrency } from "@/lib/utils/format-currency"

/**
 * The message an operator sends a customer with their quotation.
 *
 * ── Why this is built in one place for both channels ──────────────────
 * WhatsApp and email carry the same quotation, and a customer who receives
 * both (or forwards one to a relative paying for the car) must read the same
 * figures in both. One builder, two renderings: WhatsApp gets its `*bold*`
 * markup, email gets plain text and a subject line.
 *
 * ── What goes in, and what does not ───────────────────────────────────
 * The greeting, what is being quoted, the breakdown, the total, the validity
 * date, and either the secure PDF link or — when the operator chooses a
 * text-only message — the payment instructions themselves. Nothing internal:
 * no admin notes, no supplier, no reference beyond the quote number the
 * customer will quote back.
 *
 * Pure. The dispatch dialog builds the preview with it in the browser and the
 * server builds the canonical copy with it, so they cannot drift.
 */

export type QuoteMessageChannel = "WHATSAPP" | "EMAIL"

export interface QuoteMessageLine {
  description: string
  quantity: number
  lineTotal: number
}

export interface QuoteMessageInput {
  siteName: string
  customerName: string
  quoteNumber: string
  /** ITEM lines, in the order the operator arranged them. */
  items: readonly QuoteMessageLine[]
  itemsSubtotal: number
  accessoriesTotal: number
  shippingCost: number | null
  clearingCost: number | null
  importDuty: number | null
  total: number
  validUntil: Date
  /** The secure PDF link, or null for a text-only message. */
  link: string | null
  paymentInstructions: string | null
  isVehicle: boolean
}

/** Beyond this many items a WhatsApp message stops being read. The PDF
 *  carries the full list. */
const MAX_LISTED_ITEMS = 8

export function formatQuoteDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

/** "Santos" from "Santos Agany"; the whole thing when it is one word. */
export function firstNameOf(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0]
  return first && first.length > 0 ? first : fullName.trim()
}

export function buildQuoteMessage(
  input: QuoteMessageInput,
  channel: QuoteMessageChannel
): { subject: string; body: string } {
  const bold = (text: string) => (channel === "WHATSAPP" ? `*${text}*` : text)
  const lines: string[] = []

  lines.push(`Hello ${firstNameOf(input.customerName)},`)
  lines.push("")
  lines.push(`Thank you for your enquiry. Here is your quotation from ${input.siteName}.`)
  lines.push("")
  lines.push(bold(`Quotation ${input.quoteNumber}`))

  const listed = input.items.slice(0, MAX_LISTED_ITEMS)

  for (const item of listed) {
    lines.push(
      item.quantity > 1
        ? `${item.quantity} × ${item.description} — ${formatCurrency(item.lineTotal)}`
        : `${item.description} — ${formatCurrency(item.lineTotal)}`
    )
  }

  if (input.items.length > listed.length) {
    lines.push(`…and ${input.items.length - listed.length} more on the quotation.`)
  }

  lines.push("")

  // The subtotal line only earns its place when there is something to add to
  // it; a single car with no extras would otherwise show its price twice.
  const hasAdditions =
    input.accessoriesTotal > 0 ||
    input.shippingCost !== null ||
    input.clearingCost !== null ||
    input.importDuty !== null

  if (hasAdditions) {
    lines.push(
      `${input.isVehicle ? "Vehicle" : "Items"}: ${formatCurrency(input.itemsSubtotal)}`
    )
    if (input.accessoriesTotal > 0) {
      lines.push(`Accessories & extras: ${formatCurrency(input.accessoriesTotal)}`)
    }
    if (input.shippingCost !== null) {
      lines.push(`Shipping: ${formatCurrency(input.shippingCost)}`)
    }
    if (input.clearingCost !== null) {
      lines.push(`Clearing: ${formatCurrency(input.clearingCost)}`)
    }
    if (input.importDuty !== null) {
      lines.push(`Import duty: ${formatCurrency(input.importDuty)}`)
    }
  }

  lines.push(bold(`Total: ${formatCurrency(input.total)}`))
  lines.push("")
  lines.push(`This quotation is valid until ${formatQuoteDate(input.validUntil)}.`)

  if (input.link) {
    lines.push("")
    lines.push("View and download your quotation (PDF):")
    lines.push(input.link)
  } else if (input.paymentInstructions && input.paymentInstructions.trim().length > 0) {
    lines.push("")
    lines.push(bold("How to pay"))
    lines.push(input.paymentInstructions.trim())
  }

  lines.push("")
  lines.push("To accept, simply reply to this message. We are happy to answer any questions.")
  lines.push("")
  lines.push(input.siteName)

  return {
    subject: `Your quotation ${input.quoteNumber} from ${input.siteName}`,
    body: lines.join("\n"),
  }
}

/**
 * A `mailto:` link that opens the operator's own mail app with the message
 * written.
 *
 * ── Why mailto and not a mail service ─────────────────────────────────
 * The stack has no transactional email provider (it is not on the approved
 * list, and adding one is its own decision). A mailto link sends from the
 * dealership's real mailbox, so replies land where staff already work and
 * the sent copy sits in their Sent folder — which for a quotation is exactly
 * where it should be.
 *
 * Every component is percent-encoded with `encodeURIComponent`, never
 * `URLSearchParams`: the latter encodes spaces as "+", which several mail
 * clients show literally. Line breaks are CRLF, as RFC 6068 specifies for a
 * mailto body.
 */
export function buildMailtoUrl(input: { to: string; subject: string; body: string }): string {
  const body = input.body.replace(/\r?\n/g, "\r\n")

  // The "@" is left readable: RFC 6068 permits it percent-encoded, and some
  // mail clients then fail to recognise the address at all.
  const to = encodeURIComponent(input.to).replace(/%40/g, "@")

  return `mailto:${to}?subject=${encodeURIComponent(
    input.subject
  )}&body=${encodeURIComponent(body)}`
}
