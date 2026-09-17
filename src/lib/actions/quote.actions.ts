"use server"

import { createHash, randomBytes } from "node:crypto"

import { revalidatePath } from "next/cache"

import { QuoteDispatchChannel, QuoteLineKind, QuoteStatus, QuoteType } from "@/generated/prisma/enums"
import { siteConfig } from "@/config/site"
import { recordAuditLog, logSecurityEvent } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import {
  QUOTE_STATUS_LABELS,
  canTransitionQuoteStatus,
  describeRefusedQuoteTransition,
  isQuoteConvertible,
  isQuoteEditable,
  isQuoteSendable,
} from "@/lib/constants/quote-status"
import {
  InsufficientStockError,
  UnlinkedQuoteLineError,
  VehicleUnavailableError,
  createOrderFromQuote,
} from "@/lib/orders/create-order-from-quote"
import { notificationNotice, notifyCustomerOrderConfirmed, resolveOrderContact } from "@/lib/email/notifications"
import { sendQuoteEmail, type SendQuoteEmailAttachment } from "@/lib/email/send-quote-email"
import { buildQuotationFilename, buildQuotePdfData, type QuotePdfSource } from "@/lib/pdf/quote-pdf-data"
import { renderQuotePdfBuffer } from "@/lib/pdf/render-quote-pdf"
import { prisma } from "@/lib/prisma"
import { buildQuoteMessage, defaultQuoteNote, type QuoteMessageInput } from "@/lib/quotes/quote-messages"
import { UnknownListingReferenceError, resolveQuoteLines } from "@/lib/quotes/quote-line-resolution"
import { computeQuoteTotals, lineTotalCents, quoteReadinessProblem } from "@/lib/quotes/quote-pricing"
import { getBusinessSettings, getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { fromCents } from "@/lib/utils/money"
import { isUniqueConstraintViolation } from "@/lib/utils/prisma-errors"
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp"
import { revalidateVehicleSurfaces } from "@/lib/cache/vehicle-surfaces"
import {
  convertQuoteSchema,
  quoteDetailsSchema,
  quoteDispatchSchema,
  quoteRefSchema,
  quoteStatusSchema,
} from "@/lib/validations/quote.schema"

/**
 * Server actions an operator uses to work a quotation: price it, send it,
 * and — once the customer has accepted — convert it into an order.
 *
 * Every action follows the order every mutation in this codebase follows:
 * validate with Zod, authorise, then write inside a transaction with an
 * audit record. None of them may assume the request came from the form —
 * a Server Action is a public POST endpoint the moment it is exported.
 */

interface QuoteFormState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Record<string, string[]>
}

function toFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> }
}): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>
}

/** Every screen a change to this quote can be seen on. */
function revalidateQuoteSurfaces(quoteId: string): void {
  revalidatePath(`${ADMIN_BASE_PATH}/quotes`)
  revalidatePath(`${ADMIN_BASE_PATH}/quotes/${quoteId}`)
}

/** Signals that the quote's core fields changed after the form was rendered. */
class StaleQuoteError extends Error {}

// ─────────────────────────────────────────────────────────────────────
// Pricing
// ─────────────────────────────────────────────────────────────────────

export interface QuoteDetailsFormState extends QuoteFormState {
  updatedAt?: string
}

const INVALID = "Check the highlighted fields and try again."

/**
 * Saves everything an operator edits on the quote detail page in one pass:
 * line items, fees (shipping, clearing, duty and the miscellaneous fourth
 * one), validity, the payment instructions and terms embedded in the PDF and
 * dispatch message, and the staff-only notes that never leave this screen.
 *
 * One save button, one action — a quote used to have a separate "Save
 * pricing" and "Save notes", which meant leaving one form to go save the
 * other. Notes carry no optimistic-concurrency risk of their own (nothing
 * else recomputes from them), so folding them into this transaction costs
 * nothing while removing a second button.
 *
 * Replaces the quote's line items wholesale from the submitted list rather
 * than diffing field-by-field in the browser — the editor already holds the
 * authoritative list, and reconciling it here (delete what is gone, update
 * what remains, create what is new) is simpler and harder to get wrong than
 * shipping a patch format across the wire.
 */
export async function updateQuoteDetailsAction(
  _prevState: QuoteDetailsFormState,
  formData: FormData
): Promise<QuoteDetailsFormState> {
  const parsed = quoteDetailsSchema.safeParse({
    quoteId: formData.get("quoteId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    lines: formData.get("lines"),
    shippingCost: formData.get("shippingCost"),
    clearingCost: formData.get("clearingCost"),
    importDuty: formData.get("importDuty"),
    otherCostsLabel: formData.get("otherCostsLabel"),
    otherCostsAmount: formData.get("otherCostsAmount"),
    validUntil: formData.get("validUntil"),
    paymentInstructions: formData.get("paymentInstructions"),
    terms: formData.get("terms"),
    adminNotes: formData.get("adminNotes"),
  })

  if (!parsed.success) {
    return { status: "error", message: INVALID, fieldErrors: toFieldErrors(parsed.error) }
  }

  const auth = await authorizePermission("quote:respond")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const {
    quoteId,
    expectedUpdatedAt,
    lines,
    shippingCost,
    clearingCost,
    importDuty,
    otherCostsLabel,
    otherCostsAmount,
    validUntil,
    paymentInstructions,
    terms,
    adminNotes,
  } = parsed.data

  const existing = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { status: true, items: { select: { id: true } } },
  })

  if (!existing) {
    return { status: "error", message: "That quote no longer exists." }
  }

  if (!isQuoteEditable(existing.status)) {
    return {
      status: "error",
      message: `This quote is ${QUOTE_STATUS_LABELS[existing.status].toLowerCase()} and its pricing cannot be edited from here. Reopen it for revision first.`,
    }
  }

  let savedAt: Date

  try {
    savedAt = await prisma.$transaction(async (tx) => {
      // A read, not a write — done first so an unknown reference is refused
      // before anything about the quote is touched.
      const resolved = await resolveQuoteLines(tx, lines)

      /**
       * The optimistic-concurrency check, exactly the shape
       * `updateSparePartAction` uses: matching `updatedAt` inside the UPDATE
       * closes the read-then-write race a separate comparison would leave
       * open. `count === 0` means someone else saved first.
       */
      const written = await tx.quote.updateMany({
        where: { id: quoteId, updatedAt: expectedUpdatedAt },
        data: {
          shippingCost: shippingCost ?? null,
          clearingCost: clearingCost ?? null,
          importDuty: importDuty ?? null,
          // A stray label with no amount is not "an other cost" — clearing
          // one whenever the other is absent keeps the pair honest, the same
          // way `pricingMode`/`price` are kept in step on SparePart.
          otherCostsLabel: otherCostsAmount !== undefined ? (otherCostsLabel ?? "Other costs") : null,
          otherCostsAmount: otherCostsAmount ?? null,
          validUntil: validUntil ?? null,
          paymentInstructions: paymentInstructions ?? null,
          terms: terms ?? null,
          adminNotes: adminNotes ?? null,
        },
      })

      if (written.count === 0) {
        throw new StaleQuoteError()
      }

      const existingIds = new Set(existing.items.map((item) => item.id))
      const incomingIds = new Set(
        resolved.filter((line) => line.id).map((line) => line.id as string)
      )
      const toDelete = [...existingIds].filter((id) => !incomingIds.has(id))

      if (toDelete.length > 0) {
        await tx.quoteItem.deleteMany({ where: { id: { in: toDelete }, quoteId } })
      }

      for (const line of resolved) {
        const data = {
          kind: line.kind,
          displayOrder: line.displayOrder,
          description: line.description,
          quantity: line.quantity,
          quotedUnitPrice: line.quotedUnitPrice,
          vehicleId: line.vehicleId,
          sparePartId: line.sparePartId,
        }

        if (line.id) {
          // Scoped to this quote by `updateMany`, not a bare `update` by id:
          // an id on the incoming form must actually belong to this quote,
          // or a tampered request could edit another quote's line.
          const result = await tx.quoteItem.updateMany({
            where: { id: line.id, quoteId },
            data,
          })

          if (result.count === 0) {
            throw new Error("A submitted line does not belong to this quote.")
          }
        } else {
          await tx.quoteItem.create({ data: { ...data, quoteId } })
        }
      }

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "QUOTE_DETAILS_UPDATED",
          entityType: "Quote",
          entityId: quoteId,
          metadata: { lineCount: resolved.length },
        },
        tx
      )

      const saved = await tx.quote.findUniqueOrThrow({
        where: { id: quoteId },
        select: { updatedAt: true },
      })

      return saved.updatedAt
    })
  } catch (error) {
    if (error instanceof StaleQuoteError) {
      return {
        status: "error",
        message:
          "Someone else saved changes to this quote while you were editing it. Reload the page to see the current details, then apply your changes again.",
      }
    }

    if (error instanceof UnknownListingReferenceError) {
      return { status: "error", message: error.message }
    }

    console.error("[quote] failed to update details", error)
    return { status: "error", message: "Could not save these changes. Please try again." }
  }

  revalidateQuoteSurfaces(quoteId)

  return { status: "success", message: "Details saved.", updatedAt: savedAt.toISOString() }
}

// ─────────────────────────────────────────────────────────────────────
// Status
// ─────────────────────────────────────────────────────────────────────

/**
 * Moves a quote to a new status by hand.
 *
 * `SENT` and `WON` are never valid targets here — see quote-status.ts for
 * why: a quote is marked sent by *sending* it (`sendQuoteDispatchAction`),
 * and won by *converting* it (`convertQuoteToOrderAction`), both of which do
 * real work beyond flipping a column. `canTransitionQuoteStatus` refuses
 * both regardless of what a crafted request asks for.
 */
export async function updateQuoteStatusAction(
  _prevState: QuoteFormState,
  formData: FormData
): Promise<QuoteFormState> {
  const parsed = quoteStatusSchema.safeParse({
    quoteId: formData.get("quoteId"),
    status: formData.get("status"),
    reason: formData.get("reason"),
  })

  if (!parsed.success) {
    return { status: "error", message: "That is not a valid status." }
  }

  const { quoteId, status, reason } = parsed.data

  // Accepting a quote is the step before it can be converted and money moves
  // — held to the same permission as the conversion itself, not the everyday
  // "work this enquiry" permission.
  const permission = status === QuoteStatus.ACCEPTED ? ("quote:accept" as const) : ("quote:respond" as const)

  const auth = await authorizePermission(permission)
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const existing = await prisma.quote.findUnique({ where: { id: quoteId }, select: { status: true } })
  if (!existing) {
    return { status: "error", message: "That quote no longer exists." }
  }

  if (existing.status === status) {
    // Most likely a double submit. Silence beats a second audit row
    // claiming a change that did not happen.
    return { status: "idle" }
  }

  if (!canTransitionQuoteStatus(existing.status, status)) {
    logSecurityEvent("quote_status_transition_refused", {
      actorId: auth.admin.id,
      quoteId,
      from: existing.status,
      to: status,
    })

    return { status: "error", message: describeRefusedQuoteTransition(existing.status, status) }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.quote.update({ where: { id: quoteId }, data: { status } })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "QUOTE_STATUS_CHANGED",
          entityType: "Quote",
          entityId: quoteId,
          metadata: {
            previousStatus: existing.status,
            newStatus: status,
            ...(reason ? { reason } : {}),
          },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[quote] failed to change quote status", error)
    return { status: "error", message: "Could not change the status. Please try again." }
  }

  revalidateQuoteSurfaces(quoteId)

  return { status: "success", message: `Status changed to ${QUOTE_STATUS_LABELS[status].toLowerCase()}.` }
}

// ─────────────────────────────────────────────────────────────────────
// Dispatch — WhatsApp / email
// ─────────────────────────────────────────────────────────────────────

export interface QuoteDispatchState {
  status: "idle" | "success" | "error"
  message?: string
  /** The wa.me URL for the client to open — click-to-chat can only ever be
   *  triggered by the operator's own click, never the server. Absent for
   *  email, which the server sends directly and needs no follow-up click. */
  dispatchUrl?: string
  channel?: QuoteDispatchChannel
}

/**
 * Sends a quotation to the customer, over WhatsApp or email.
 *
 * ── WhatsApp ────────────────────────────────────────────────────────────
 * The server builds the canonical message and a wa.me deep link, returned
 * for the client to render as a real link. A Server Action cannot itself
 * switch the operator's device into another app, and auto-navigating from
 * its result would run after an async round trip that most browsers' popup
 * blockers no longer treat as "in response to" a click — so
 * `QuoteDispatchDialog` shows the link as an explicit "Open in WhatsApp"
 * button instead. Click-to-chat also cannot carry a file attachment under
 * any circumstance, so the PDF here is always the secure link, never a true
 * attachment.
 *
 * ── Email ───────────────────────────────────────────────────────────────
 * Sent directly by the server through Resend (`sendQuoteEmail`), with the
 * rendered PDF as a genuine attachment when "Attach PDF quotation" is on.
 * Because that send either succeeds or fails before this function returns,
 * the status/audit transition below only runs once the email has actually
 * gone out — a failed send must never be recorded as SENT.
 *
 * Status only advances to `SENT` from an editable state (NEW/CONTACTED/SENT
 * itself); resending to a customer who has already replied ACCEPTED must not
 * silently undo that.
 */
export async function sendQuoteDispatchAction(
  _prevState: QuoteDispatchState,
  formData: FormData
): Promise<QuoteDispatchState> {
  const parsed = quoteDispatchSchema.safeParse({
    quoteId: formData.get("quoteId"),
    channel: formData.get("channel"),
    includeLink: formData.get("includeLink"),
    note: formData.get("note"),
    instructions: formData.get("instructions"),
    dispatchId: formData.get("dispatchId"),
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Choose WhatsApp, email, or both to send this quotation.",
    }
  }

  const auth = await authorizePermission("quote:respond")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const { quoteId, channel, includeLink, note, instructions, dispatchId } = parsed.data
  const sendsEmail = channel === QuoteDispatchChannel.EMAIL || channel === QuoteDispatchChannel.BOTH
  const sendsWhatsapp = channel === QuoteDispatchChannel.WHATSAPP || channel === QuoteDispatchChannel.BOTH

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: { select: { kind: true, description: true, quantity: true, quotedUnitPrice: true } },
    },
  })

  if (!quote) {
    return { status: "error", message: "That quote no longer exists." }
  }

  if (!isQuoteSendable(quote.status)) {
    return {
      status: "error",
      message: `This quote is ${QUOTE_STATUS_LABELS[quote.status].toLowerCase()} and cannot be sent from here.`,
    }
  }

  const fees = {
    shippingCost: quote.shippingCost?.toNumber() ?? null,
    clearingCost: quote.clearingCost?.toNumber() ?? null,
    importDuty: quote.importDuty?.toNumber() ?? null,
    otherCosts: quote.otherCostsAmount?.toNumber() ?? null,
  }
  const priced = quote.items.map((item) => ({
    kind: item.kind,
    quantity: item.quantity,
    unitPrice: item.quotedUnitPrice?.toNumber() ?? null,
  }))

  const readinessProblem = quoteReadinessProblem({
    lines: priced,
    fees,
    validUntil: quote.validUntil,
  })

  if (readinessProblem) {
    return { status: "error", message: readinessProblem }
  }

  if (sendsEmail && !quote.contactEmail) {
    return {
      status: "error",
      message:
        channel === QuoteDispatchChannel.BOTH
          ? "This customer has no email address on file, so the quotation cannot go by both channels. Send via WhatsApp instead."
          : "This customer has no email address on file. Send via WhatsApp instead, or add one.",
    }
  }

  if (sendsWhatsapp && !quote.contactWhatsapp) {
    return {
      status: "error",
      message:
        channel === QuoteDispatchChannel.BOTH
          ? "This customer has no WhatsApp number on file, so the quotation cannot go by both channels. Send via email instead."
          : "This customer has no WhatsApp number on file.",
    }
  }

  const mintingToken = Boolean(includeLink) && !quote.shareToken
  const shareToken = includeLink ? (quote.shareToken ?? randomBytes(32).toString("base64url")) : quote.shareToken

  const totals = computeQuoteTotals(priced, fees)
  const link = includeLink && shareToken ? `${siteConfig.url}/quotation/${shareToken}` : null

  const listedItems = quote.items
    .filter((item) => item.kind === QuoteLineKind.ITEM)
    .map((item) => ({
      description: item.description,
      quantity: item.quantity,
      // In cents, like every other total on the quotation, so the message and
      // the PDF can never disagree by a rounding cent.
      lineTotal: fromCents(
        lineTotalCents({ quantity: item.quantity, unitPrice: item.quotedUnitPrice?.toNumber() ?? 0 }) ?? 0
      ),
    }))

  const { businessName } = await getPublicSiteSettings()

  const messageInput: QuoteMessageInput = {
    siteName: businessName,
    customerName: quote.contactName ?? "Customer",
    quoteNumber: quote.quoteNumber,
    note: note && note.length > 0 ? note : defaultQuoteNote(businessName),
    items: listedItems,
    itemsSubtotal: totals.itemsSubtotal,
    accessoriesTotal: totals.accessoriesTotal,
    shippingCost: fees.shippingCost,
    clearingCost: fees.clearingCost,
    importDuty: fees.importDuty,
    otherCostsLabel: quote.otherCostsLabel,
    otherCostsAmount: fees.otherCosts,
    total: totals.total,
    // Guaranteed non-null: quoteReadinessProblem above refuses to proceed
    // without a validity date.
    validUntil: quote.validUntil as Date,
    link,
    paymentInstructions: quote.paymentInstructions,
    isVehicle: quote.type === QuoteType.VEHICLE,
    instructions: instructions ?? null,
  }

  // ── Actually reach the customer ──────────────────────────────────────
  // WhatsApp: build the deep link first and hand it back — nothing has been
  // "sent" until the operator clicks it. Built before any email goes out, so
  // a "both" dispatch with an unusable number fails before emailing anyone.
  // Email: send it for real, now, before touching the quote's status at all,
  // so a failed send is never recorded as SENT.
  let dispatchUrl: string | undefined

  if (sendsWhatsapp) {
    const whatsappMessage = buildQuoteMessage(messageInput, "WHATSAPP")
    const url = buildWhatsAppUrl({ phoneNumber: quote.contactWhatsapp as string, message: whatsappMessage.body })

    if (!url) {
      return {
        status: "error",
        message: "This customer's WhatsApp number could not be used. Check the number on file and message them directly.",
      }
    }

    dispatchUrl = url
  }

  if (sendsEmail) {
    const message = buildQuoteMessage(messageInput, "EMAIL")
    let attachment: SendQuoteEmailAttachment | undefined

    if (includeLink) {
      const pdfSource: QuotePdfSource = {
        quoteNumber: quote.quoteNumber,
        type: quote.type,
        createdAt: quote.createdAt,
        validUntil: quote.validUntil,
        shippingCost: fees.shippingCost,
        clearingCost: fees.clearingCost,
        importDuty: fees.importDuty,
        otherCostsLabel: quote.otherCostsLabel,
        otherCostsAmount: fees.otherCosts,
        paymentInstructions: quote.paymentInstructions,
        terms: quote.terms,
        contactName: quote.contactName,
        contactCity: quote.contactCity,
        contactPhone: quote.contactPhone,
        contactEmail: quote.contactEmail,
        items: quote.items.map((item) => ({
          kind: item.kind,
          description: item.description,
          quantity: item.quantity,
          quotedUnitPrice: item.quotedUnitPrice?.toNumber() ?? null,
        })),
      }

      attachment = {
        filename: buildQuotationFilename(quote.quoteNumber, quote.contactName ?? "Customer"),
        content: await renderQuotePdfBuffer(buildQuotePdfData(pdfSource, businessName)),
      }
    }

    /**
     * One dialog opening, one email. The key carries a digest of what is
     * being sent, so a double-click or a retry after a failed status write is
     * a no-op at the provider, while an operator who edits the message and
     * sends again from the same dialog still gets a real second send rather
     * than a conflict.
     */
    const idempotencyKey = dispatchId
      ? `quote-dispatch/${quoteId}/${dispatchId}/${createHash("sha256")
          .update(JSON.stringify([quote.contactEmail, message.subject, message.body, Boolean(attachment)]))
          .digest("hex")
          .slice(0, 32)}`
      : undefined

    const sendResult = await sendQuoteEmail({
      to: quote.contactEmail as string,
      subject: message.subject,
      text: message.body,
      attachment,
      idempotencyKey,
    })

    if (!sendResult.ok) {
      return { status: "error", message: sendResult.error }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (mintingToken) {
        await tx.quote.update({ where: { id: quoteId }, data: { shareToken } })
        await recordAuditLog(
          { actorId: auth.admin.id, action: "QUOTE_LINK_CREATED", entityType: "Quote", entityId: quoteId },
          tx
        )
      }

      // Only ever moves an open quote forward to SENT. A quote already
      // ACCEPTED (or, in principle, a resend racing another status change)
      // keeps its status — resending a reminder must not undo a customer's
      // acceptance.
      const advanceToSent = isQuoteEditable(quote.status) && quote.status !== QuoteStatus.SENT

      await tx.quote.update({
        where: { id: quoteId },
        data: {
          sentAt: new Date(),
          lastSentVia: channel,
          ...(advanceToSent ? { status: QuoteStatus.SENT } : {}),
        },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "QUOTE_SENT",
          entityType: "Quote",
          entityId: quoteId,
          metadata: {
            channel,
            includeLink: Boolean(includeLink),
            ...(note ? { note } : {}),
            ...(instructions ? { instructions } : {}),
          },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[quote] failed to record quotation dispatch", error)
    return {
      status: "error",
      message: sendsEmail
        ? "The email was sent, but the quote could not be marked as sent — refresh the page and check its status."
        : "Could not send this quotation. Please try again.",
    }
  }

  revalidateQuoteSurfaces(quoteId)

  return {
    status: "success",
    message:
      channel === QuoteDispatchChannel.EMAIL
        ? "Quotation emailed."
        : channel === QuoteDispatchChannel.BOTH
          ? "Quotation emailed — finish sending it on WhatsApp."
          : "Quotation sent.",
    dispatchUrl,
    channel,
  }
}

/**
 * Revokes the customer's PDF link.
 *
 * Clears `shareToken` rather than deleting the quote data behind it, so a
 * customer holding an old link — one sent in error, or after the deal fell
 * through — can no longer open the document. Sending the quotation again
 * mints a fresh token.
 */
export async function revokeQuoteLinkAction(
  _prevState: QuoteFormState,
  formData: FormData
): Promise<QuoteFormState> {
  const parsed = quoteRefSchema.safeParse({ quoteId: formData.get("quoteId") })
  if (!parsed.success) {
    return { status: "error", message: "That quote could not be identified." }
  }

  const auth = await authorizePermission("quote:respond")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const { quoteId } = parsed.data

  const existing = await prisma.quote.findUnique({ where: { id: quoteId }, select: { shareToken: true } })
  if (!existing) {
    return { status: "error", message: "That quote no longer exists." }
  }

  if (!existing.shareToken) {
    return { status: "idle" }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.quote.update({ where: { id: quoteId }, data: { shareToken: null } })
      await recordAuditLog(
        { actorId: auth.admin.id, action: "QUOTE_LINK_REVOKED", entityType: "Quote", entityId: quoteId },
        tx
      )
    })
  } catch (error) {
    console.error("[quote] failed to revoke quotation link", error)
    return { status: "error", message: "Could not revoke the link. Please try again." }
  }

  revalidateQuoteSurfaces(quoteId)

  return { status: "success", message: "The link has been revoked. It will no longer open the PDF." }
}

// ─────────────────────────────────────────────────────────────────────
// Convert to order
// ─────────────────────────────────────────────────────────────────────

export interface ConvertQuoteState {
  status: "idle" | "success" | "error"
  message?: string
  orderId?: string
  orderNumber?: string
}

/**
 * Converts an accepted quotation into a permanent order.
 *
 * The heavy lifting — reserving stock, locking a vehicle, building the
 * payment milestones — lives in `createOrderFromQuote`; this action owns
 * authorisation, the pre-flight checks that produce a message an operator
 * can act on, and translating that module's typed errors into one.
 */
export async function convertQuoteToOrderAction(
  _prevState: ConvertQuoteState,
  formData: FormData
): Promise<ConvertQuoteState> {
  const parsed = convertQuoteSchema.safeParse({
    quoteId: formData.get("quoteId"),
    confirmAccepted: formData.get("confirmAccepted"),
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Confirm that the customer has accepted this quotation.",
    }
  }

  const auth = await authorizePermission("quote:accept")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const { quoteId } = parsed.data

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      order: { select: { id: true } },
      items: {
        select: {
          kind: true,
          description: true,
          quantity: true,
          quotedUnitPrice: true,
          vehicleId: true,
          sparePartId: true,
          vehicle: { select: { slug: true } },
          sparePart: { select: { slug: true } },
        },
      },
    },
  })

  if (!quote) {
    return { status: "error", message: "That quote no longer exists." }
  }

  if (quote.order) {
    return { status: "error", message: "This quote has already been converted to an order." }
  }

  if (!isQuoteConvertible(quote.status)) {
    return {
      status: "error",
      message: `This quote is ${QUOTE_STATUS_LABELS[quote.status].toLowerCase()} and must be sent and accepted before it can become an order.`,
    }
  }

  const fees = {
    shippingCost: quote.shippingCost?.toNumber() ?? null,
    clearingCost: quote.clearingCost?.toNumber() ?? null,
    importDuty: quote.importDuty?.toNumber() ?? null,
    otherCosts: quote.otherCostsAmount?.toNumber() ?? null,
  }
  const priced = quote.items.map((item) => ({
    kind: item.kind,
    quantity: item.quantity,
    unitPrice: item.quotedUnitPrice?.toNumber() ?? null,
  }))

  const readinessProblem = quoteReadinessProblem({
    lines: priced,
    fees,
    validUntil: quote.validUntil,
    // The customer accepted while the quotation was valid; converting it
    // after the date must not undo their agreement. A quote still only SENT
    // has not been accepted, so its validity still applies.
    enforceValidity: quote.status !== QuoteStatus.ACCEPTED,
  })

  if (readinessProblem) {
    return { status: "error", message: readinessProblem }
  }

  const settings = await getBusinessSettings()

  let created: { id: string; orderNumber: string; totalAmount: number }

  try {
    created = await prisma.$transaction(async (tx) => {
      const order = await createOrderFromQuote(tx, {
        quoteId: quote.id,
        quoteType: quote.type,
        customerId: quote.customerId,
        items: quote.items.map((item) => ({
          kind: item.kind,
          description: item.description,
          quantity: item.quantity,
          quotedUnitPrice: item.quotedUnitPrice?.toNumber() ?? null,
          vehicleId: item.vehicleId,
          sparePartId: item.sparePartId,
        })),
        shippingCost: fees.shippingCost,
        clearingCost: fees.clearingCost,
        importDuty: fees.importDuty,
        otherCosts: fees.otherCosts,
        adminNotes: quote.adminNotes,
        milestonePercentages: {
          initial: settings.defaultInitialPercentage,
          mombasa: settings.defaultMombasaPercentage,
          final: settings.defaultFinalPercentage,
        },
        actorId: auth.admin.id,
      })

      await tx.quote.update({ where: { id: quoteId }, data: { status: QuoteStatus.WON } })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "QUOTE_CONVERTED",
          entityType: "Quote",
          entityId: quoteId,
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
        },
        tx
      )

      return order
    })
  } catch (error) {
    if (
      error instanceof UnlinkedQuoteLineError ||
      error instanceof VehicleUnavailableError ||
      error instanceof InsufficientStockError
    ) {
      return { status: "error", message: error.message }
    }

    // Two operators converting the same quote at once: the second transaction
    // fails on Order.quoteId's unique constraint rather than being prevented
    // by the `quote.order` check above, which cannot see the other one's
    // uncommitted write.
    if (isUniqueConstraintViolation(error)) {
      return { status: "error", message: "This quote has already been converted to an order." }
    }

    console.error("[quote] failed to convert quote to order", error)
    return { status: "error", message: "Could not create the order. Please try again." }
  }

  revalidateQuoteSurfaces(quoteId)
  revalidatePath(`${ADMIN_BASE_PATH}/orders`)
  revalidatePath(`${ADMIN_BASE_PATH}/orders/${created.id}`)

  for (const item of quote.items) {
    if (item.vehicleId) {
      // Reserved by the conversion, so it leaves the public catalogue too.
      revalidateVehicleSurfaces(item.vehicleId, item.vehicle?.slug ?? null)
    }

    if (item.sparePartId) {
      revalidatePath(`${ADMIN_BASE_PATH}/spare-parts`)
      revalidatePath(`${ADMIN_BASE_PATH}/spare-parts/${item.sparePartId}`)
      revalidatePath("/spare-parts")
      if (item.sparePart?.slug) revalidatePath(`/spare-parts/${item.sparePart.slug}`)
    }
  }

  const emailNotice = await emailOrderConfirmation(created, quote)

  return {
    status: "success",
    message: `Order created. ${emailNotice}`,
    orderId: created.id,
    orderNumber: created.orderNumber,
  }
}

/**
 * Tells the customer their order exists and what to pay first. Runs after
 * the conversion has committed; a failure is reported to the operator and
 * never undoes the order.
 */
async function emailOrderConfirmation(
  order: { id: string; orderNumber: string; totalAmount: number },
  quote: {
    customerId: string
    type: QuoteType
    contactEmail: string | null
    contactName: string | null
    paymentInstructions: string | null
  }
): Promise<string> {
  let customer: { email: string | null; fullName: string; deletedAt: Date | null } | null
  let milestones: { label: string; amountDue: { toNumber: () => number } }[]

  try {
    ;[customer, milestones] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: quote.customerId },
        select: { email: true, fullName: true, deletedAt: true },
      }),
      prisma.paymentMilestone.findMany({
        where: { orderId: order.id },
        orderBy: { sequence: "asc" },
        select: { label: true, amountDue: true },
      }),
    ])
  } catch (error) {
    console.error("[quote] could not load the order for its confirmation email", error)
    return notificationNotice("FAILED")
  }

  if (!customer) return notificationNotice("NO_RECIPIENT")

  const contact = resolveOrderContact({ quote, customer })
  const outcome = await notifyCustomerOrderConfirmed({
    to: contact.email,
    customerName: contact.name,
    orderId: order.id,
    orderNumber: order.orderNumber,
    isVehicle: quote.type === QuoteType.VEHICLE,
    totalAmount: order.totalAmount,
    milestones: milestones.map((milestone) => ({ label: milestone.label, amountDue: milestone.amountDue.toNumber() })),
    paymentInstructions: quote.paymentInstructions,
  })

  return notificationNotice(outcome)
}
