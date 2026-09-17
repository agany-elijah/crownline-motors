import "server-only"

import { siteConfig } from "@/config/site"
import { getOperationalSettings, getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { adminPath } from "@/lib/constants/admin-routes"
import { renderEmailHtml, renderEmailText, type EmailBrand, type EmailContent, type EmailDetail } from "@/lib/email/email-layout"
import { sendEmail } from "@/lib/email/send-email"
import { prisma } from "@/lib/prisma"
import { firstNameOf, formatQuoteDate } from "@/lib/quotes/quote-messages"
import { trackingPagePath } from "@/lib/tracking/tracking-number"
import { formatCurrency } from "@/lib/utils/format-currency"

/**
 * The emails the system sends on its own, at each stage of an enquiry's life:
 *
 *   quote request received  → the customer, and every active administrator
 *   quote converted to order → the customer (order confirmed, what to pay)
 *   payment recorded         → the customer (receipt, balance, what is next)
 *   payment refunded         → the customer
 *   tracking activated       → the customer (their tracking number)
 *   tracking event recorded  → the customer (status, and any payment now due)
 *
 * Sending the quotation itself is not here: that stays an operator's decision
 * in the dispatch dialog, because it is the one message whose content they
 * choose.
 *
 * ── Switched by Settings → Notifications ──────────────────────────────
 * Every customer email here is *automatic*, so all of them stop when
 * "Automatic customer emails" is off. The staff alert needs both "New quote
 * received" and "Admin email notifications". The check happens here, in the
 * one function every email passes through, so no new notification can forget
 * it. An operator sending a quotation from the dispatch dialog is not
 * automatic and does not come through this file.
 *
 * ── Never the source of truth ─────────────────────────────────────────
 * Every function runs after the database write it describes has committed,
 * and none of them throws. An unreachable mailbox must not roll back a
 * recorded payment. Each returns an outcome so an operator-facing action can
 * say whether the customer was actually emailed.
 */

export type NotificationOutcome = "SENT" | "NO_RECIPIENT" | "NOT_CONFIGURED" | "DISABLED" | "FAILED"

type Audience = "customer" | "admin"

/** The sender's name as configured in Settings, and the public site's address. */
async function emailBrand(): Promise<EmailBrand> {
  return { siteName: (await getPublicSiteSettings()).businessName, siteUrl: siteConfig.url }
}

async function isAudienceEnabled(audience: Audience): Promise<boolean> {
  const { notifications } = await getOperationalSettings()

  return audience === "customer"
    ? notifications.customerEmailsEnabled
    : notifications.notifyAdminsOfNewQuotes && notifications.adminEmailNotificationsEnabled
}

async function deliver(
  kind: string,
  audience: Audience,
  to: string | readonly string[] | null,
  subject: string,
  content: EmailContent | ((brand: EmailBrand) => EmailContent),
  idempotencyKey: string
): Promise<NotificationOutcome> {
  if (!(await isAudienceEnabled(audience))) return "DISABLED"
  if (!to || to.length === 0) return "NO_RECIPIENT"

  try {
    const brand = await emailBrand()
    const body = typeof content === "function" ? content(brand) : content
    const result = await sendEmail({
      to,
      subject,
      text: renderEmailText(body, brand),
      html: renderEmailHtml(body, brand),
      idempotencyKey: `${kind}/${idempotencyKey}`,
    })

    if (result.ok) return "SENT"

    if (result.reason === "NOT_CONFIGURED") {
      console.warn(`[email] ${kind} not sent: RESEND_API_KEY is not configured`)
      return "NOT_CONFIGURED"
    }

    console.error(`[email] ${kind} could not be sent`)
    return "FAILED"
  } catch (error) {
    console.error(`[email] ${kind} failed while rendering or sending`, error)
    return "FAILED"
  }
}

/** The sentence an operator sees about the customer email, after their action. */
export function notificationNotice(outcome: NotificationOutcome): string {
  switch (outcome) {
    case "SENT":
      return "The customer has been emailed."
    case "NO_RECIPIENT":
      return "No email address is on file, so the customer was not emailed."
    case "NOT_CONFIGURED":
      return "Email is not configured yet (RESEND_API_KEY), so the customer was not emailed."
    case "DISABLED":
      return "Automatic customer emails are switched off in Settings, so the customer was not emailed."
    case "FAILED":
      return "The customer email could not be sent — let them know by WhatsApp or phone."
  }
}

/**
 * Who an order's emails go to: the address the customer gave on the enquiry
 * that became this order (where the operator has been replying), falling
 * back to their customer record. Nobody, once a customer has been erased.
 */
export function resolveOrderContact(order: {
  quote: { contactEmail: string | null; contactName: string | null }
  customer: { email: string | null; fullName: string; deletedAt: Date | null }
}): { email: string | null; name: string } {
  if (order.customer.deletedAt) return { email: null, name: "Customer" }

  return {
    email: order.quote.contactEmail ?? order.customer.email,
    name: order.quote.contactName ?? order.customer.fullName,
  }
}

function greeting(name: string): string {
  return `Hello ${firstNameOf(name)},`
}

function trackingUrl(trackingNumber: string): string {
  return `${siteConfig.url}${trackingPagePath(trackingNumber)}`
}

const CONTACT_CLOSING = `If anything is unclear, reply to this email or message us on WhatsApp — we are happy to help.`

// ─────────────────────────────────────────────────────────────────────
// Quotation requests
// ─────────────────────────────────────────────────────────────────────

export async function notifyCustomerQuoteReceived(input: {
  to: string | null
  customerName: string
  quoteNumber: string
  summary: string
}): Promise<NotificationOutcome> {
  return deliver(
    "quote-received",
    "customer",
    input.to,
    `We have received your request ${input.quoteNumber}`,
    (brand) => ({
      preheader: `Reference ${input.quoteNumber} — we will be in touch with your quotation.`,
      heading: "We have received your request",
      greeting: greeting(input.customerName),
      paragraphs: [
        `Thank you for contacting ${brand.siteName}. Your request has reached our team, and we will check availability and pricing before sending you a quotation by email or WhatsApp.`,
      ],
      details: [
        { label: "Reference", value: input.quoteNumber },
        { label: "Request", value: input.summary },
      ],
      closing: [`Please keep your reference handy — quote it whenever you contact us. ${CONTACT_CLOSING}`],
    }),
    input.quoteNumber
  )
}

export async function notifyAdminsOfQuoteRequest(input: {
  quoteId: string
  quoteNumber: string
  typeLabel: string
  summary: string
  contactName: string
  contactPhone: string
  contactWhatsapp: string
  contactEmail: string | null
  contactCity: string
  notes: string | null
}): Promise<NotificationOutcome> {
  // Checked before the administrator lookup, so a switched-off alert costs no query.
  if (!(await isAudienceEnabled("admin"))) return "DISABLED"

  let recipients: string[]

  try {
    const admins = await prisma.adminProfile.findMany({ where: { isActive: true }, select: { email: true } })
    recipients = admins.map((admin) => admin.email)
  } catch (error) {
    console.error("[email] could not load administrator addresses for a new quote request", error)
    return "FAILED"
  }

  const details: EmailDetail[] = [
    { label: "Reference", value: input.quoteNumber },
    { label: "Type", value: input.typeLabel },
    { label: "Request", value: input.summary },
    { label: "Name", value: input.contactName },
    { label: "Phone", value: input.contactPhone },
    { label: "WhatsApp", value: input.contactWhatsapp },
    { label: "Email", value: input.contactEmail ?? "Not given" },
    { label: "City", value: input.contactCity },
  ]

  return deliver(
    "admin-quote-request",
    "admin",
    recipients,
    `New quotation request ${input.quoteNumber} — ${input.contactName}`,
    {
      preheader: `${input.contactName} has asked for a quotation: ${input.summary}`,
      heading: "New quotation request",
      greeting: "Hello,",
      paragraphs: [
        `${input.contactName} has just requested a quotation on the website.`,
        ...(input.notes ? [`Customer notes:\n${input.notes.slice(0, 1500)}`] : []),
      ],
      details,
      callToAction: {
        label: "Open in dashboard",
        url: `${siteConfig.url}${adminPath(`/quotes/${input.quoteId}`)}`,
      },
    },
    input.quoteNumber
  )
}

// ─────────────────────────────────────────────────────────────────────
// Orders and payments
// ─────────────────────────────────────────────────────────────────────

export async function notifyCustomerOrderConfirmed(input: {
  to: string | null
  customerName: string
  orderId: string
  orderNumber: string
  isVehicle: boolean
  totalAmount: number
  milestones: readonly { label: string; amountDue: number }[]
  paymentInstructions: string | null
}): Promise<NotificationOutcome> {
  const first = input.milestones[0]

  return deliver(
    "order-confirmed",
    "customer",
    input.to,
    `Your order ${input.orderNumber} is confirmed`,
    {
      preheader: first
        ? `${first.label}: ${formatCurrency(first.amountDue)} is now due.`
        : `Order ${input.orderNumber} is confirmed.`,
      heading: "Your order is confirmed",
      greeting: greeting(input.customerName),
      paragraphs: [
        `Thank you for accepting your quotation. Your order ${input.orderNumber} is now confirmed.`,
        input.isVehicle && input.milestones.length > 1
          ? `Your vehicle is paid for in stages. ${first ? `The ${first.label.toLowerCase()} of ${formatCurrency(first.amountDue)} is due now` : "The first payment is due now"}, and we will email you when each later payment becomes due.`
          : `${first ? `Payment of ${formatCurrency(first.amountDue)} is due now` : "Payment is due now"}, before your order is prepared.`,
        ...(input.paymentInstructions && input.paymentInstructions.trim().length > 0
          ? [`How to pay:\n${input.paymentInstructions.trim()}`]
          : []),
      ],
      details: [
        { label: "Order number", value: input.orderNumber },
        { label: "Order total", value: formatCurrency(input.totalAmount) },
        ...input.milestones.map((milestone) => ({ label: milestone.label, value: formatCurrency(milestone.amountDue) })),
      ],
      closing: [
        input.isVehicle && input.milestones.length > 1
          ? "We will confirm every payment by email as soon as it is received. Once your initial payment is confirmed, that email also carries your tracking number."
          : "We will confirm your payment by email as soon as it is received, together with your tracking number.",
        CONTACT_CLOSING,
      ],
    },
    input.orderId
  )
}

export async function notifyCustomerPaymentConfirmed(input: {
  to: string | null
  customerName: string
  paymentId: string
  orderNumber: string
  amount: number
  milestoneLabel: string
  methodLabel: string
  reference: string | null
  paymentDate: Date
  totalPaid: number
  balance: number
  next: { label: string; amount: number; dueNow: boolean } | null
  /**
   * Set when this payment started tracking. The receipt then carries the
   * tracking number, so the customer gets it in the same email as the
   * confirmation of the payment that earned it — not in a second message.
   */
  tracking?: { trackingNumber: string; subject: string } | null
}): Promise<NotificationOutcome> {
  const nextSentence =
    input.balance <= 0
      ? "Your order is now paid in full. Thank you."
      : input.next
        ? input.next.dueNow
          ? `Your next payment, the ${input.next.label.toLowerCase()} of ${formatCurrency(input.next.amount)}, is due now.`
          : `Your next payment is the ${input.next.label.toLowerCase()} of ${formatCurrency(input.next.amount)}. We will email you when it becomes due.`
        : `The remaining balance on your order is ${formatCurrency(input.balance)}.`

  return deliver(
    "payment-confirmed",
    "customer",
    input.to,
    input.tracking
      ? `Payment received — your tracking number is ${input.tracking.trackingNumber}`
      : `Payment received for order ${input.orderNumber}`,
    {
      preheader: input.tracking
        ? `We have confirmed your payment of ${formatCurrency(input.amount)}. Track your order with ${input.tracking.trackingNumber}.`
        : `We have confirmed your payment of ${formatCurrency(input.amount)}.`,
      heading: "Payment received",
      greeting: greeting(input.customerName),
      paragraphs: [
        `We have received and confirmed your payment of ${formatCurrency(input.amount)} towards the ${input.milestoneLabel.toLowerCase()} for order ${input.orderNumber}.`,
        ...(input.tracking
          ? [
              `Your order has now started its journey. Your tracking number is ${input.tracking.trackingNumber} — enter it on our Track My Order page at any time to see where your order is and when to expect it.`,
            ]
          : []),
        nextSentence,
      ],
      details: [
        ...(input.tracking ? [{ label: "Tracking number", value: input.tracking.trackingNumber }] : []),
        { label: "Order number", value: input.orderNumber },
        { label: "Payment for", value: input.milestoneLabel },
        { label: "Amount", value: formatCurrency(input.amount) },
        { label: "Method", value: input.methodLabel },
        ...(input.reference ? [{ label: "Reference", value: input.reference }] : []),
        { label: "Payment date", value: formatQuoteDate(input.paymentDate) },
        { label: "Total paid", value: formatCurrency(input.totalPaid) },
        { label: "Remaining balance", value: formatCurrency(input.balance) },
      ],
      ...(input.tracking
        ? { callToAction: { label: "Track my order", url: trackingUrl(input.tracking.trackingNumber) } }
        : {}),
      closing: [
        input.tracking
          ? "Please keep this email as your receipt. We will email you each time your order reaches a new stage."
          : "Please keep this email as your receipt.",
        CONTACT_CLOSING,
      ],
    },
    input.paymentId
  )
}

export async function notifyCustomerPaymentRefunded(input: {
  to: string | null
  customerName: string
  paymentId: string
  orderNumber: string
  amount: number
  balance: number
}): Promise<NotificationOutcome> {
  return deliver(
    "payment-refunded",
    "customer",
    input.to,
    `Refund recorded for order ${input.orderNumber}`,
    {
      preheader: `A refund of ${formatCurrency(input.amount)} has been recorded.`,
      heading: "Refund recorded",
      greeting: greeting(input.customerName),
      paragraphs: [
        `We have recorded a refund of ${formatCurrency(input.amount)} on order ${input.orderNumber}. This amount no longer counts towards your order.`,
      ],
      details: [
        { label: "Order number", value: input.orderNumber },
        { label: "Refunded", value: formatCurrency(input.amount) },
        { label: "Remaining balance", value: formatCurrency(input.balance) },
      ],
      closing: [CONTACT_CLOSING],
    },
    input.paymentId
  )
}

// ─────────────────────────────────────────────────────────────────────
// Tracking
// ─────────────────────────────────────────────────────────────────────

export async function notifyCustomerTrackingActivated(input: {
  to: string | null
  customerName: string
  shipmentId: string
  orderNumber: string
  trackingNumber: string
  subject: string
}): Promise<NotificationOutcome> {
  return deliver(
    "tracking-activated",
    "customer",
    input.to,
    `Your tracking number: ${input.trackingNumber}`,
    {
      preheader: `Follow order ${input.orderNumber} with tracking number ${input.trackingNumber}.`,
      heading: "Your order is on its way",
      greeting: greeting(input.customerName),
      paragraphs: [
        `Your order ${input.orderNumber} is now being tracked. Enter the tracking number below on our website at any time to see where it is.`,
      ],
      details: [
        { label: "Tracking number", value: input.trackingNumber },
        { label: "Order number", value: input.orderNumber },
        { label: "Order", value: input.subject },
      ],
      callToAction: { label: "Track my order", url: trackingUrl(input.trackingNumber) },
      closing: ["We will also email you each time your order reaches a new stage.", CONTACT_CLOSING],
    },
    input.shipmentId
  )
}

export async function notifyCustomerTrackingUpdate(input: {
  to: string | null
  customerName: string
  eventId: string
  trackingNumber: string
  statusLabel: string
  location: string | null
  eventDate: Date
  paymentNowDue: { label: string; amount: number } | null
}): Promise<NotificationOutcome> {
  return deliver(
    "tracking-update",
    "customer",
    input.to,
    `Tracking update: ${input.statusLabel} (${input.trackingNumber})`,
    {
      preheader: `${input.statusLabel}${input.location ? ` — ${input.location}` : ""}`,
      heading: input.statusLabel,
      greeting: greeting(input.customerName),
      paragraphs: [
        `There is an update on your order. Its status is now: ${input.statusLabel}.`,
        ...(input.paymentNowDue
          ? [
              `Payment now due: your ${input.paymentNowDue.label.toLowerCase()} of ${formatCurrency(input.paymentNowDue.amount)} is now due. Please use the payment details on your quotation, and keep your payment reference.`,
            ]
          : []),
      ],
      details: [
        { label: "Tracking number", value: input.trackingNumber },
        { label: "Status", value: input.statusLabel },
        { label: "Date", value: formatQuoteDate(input.eventDate) },
        ...(input.location ? [{ label: "Location", value: input.location }] : []),
      ],
      callToAction: { label: "View full journey", url: trackingUrl(input.trackingNumber) },
      closing: [CONTACT_CLOSING],
    },
    input.eventId
  )
}
