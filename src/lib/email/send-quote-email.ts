import "server-only"

import { escapeHtml } from "@/lib/email/email-layout"
import { sendEmail } from "@/lib/email/send-email"

/**
 * Sends a quotation email, through the shared `sendEmail`.
 *
 * Returns a sentence the dispatch dialog shows the operator, rather than
 * throwing: a failed send (bad address, provider outage, missing API key) is
 * an expected, recoverable outcome.
 */

export interface SendQuoteEmailAttachment {
  filename: string
  content: Buffer
}

export interface SendQuoteEmailInput {
  to: string
  subject: string
  /** Plain-text body — the same canonical text WhatsApp sends, so a
   *  customer who receives both reads the same figures either way. */
  text: string
  /** The rendered quotation PDF, attached when the operator has the
   *  "Attach PDF quotation" toggle on. Omitted for a text-only send. */
  attachment?: SendQuoteEmailAttachment
  idempotencyKey?: string
}

export type SendQuoteEmailResult = { ok: true } | { ok: false; error: string }

export async function sendQuoteEmail(input: SendQuoteEmailInput): Promise<SendQuoteEmailResult> {
  const result = await sendEmail({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: textToSimpleHtml(input.text),
    attachments: input.attachment ? [input.attachment] : undefined,
    idempotencyKey: input.idempotencyKey,
  })

  if (result.ok) {
    return { ok: true }
  }

  return {
    ok: false,
    error:
      result.reason === "NOT_CONFIGURED"
        ? "Email sending isn't configured yet. Add RESEND_API_KEY (see .env.example) to send quotations by email, or send this one over WhatsApp instead."
        : "Could not send the email. Please try again shortly.",
  }
}

/** A minimal HTML rendering of the same plain-text body, so mail clients
 *  that prefer HTML still show readable paragraphs rather than one run-on
 *  line. Deliberately not a branded template — the PDF attachment already
 *  carries the logo and layout; this is the envelope, not the document. */
function textToSimpleHtml(text: string): string {
  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#141414;white-space:pre-wrap;">${escapeHtml(text)}</div>`
}
