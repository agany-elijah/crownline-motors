import "server-only"

import { getEmailFromAddress, getResendClient } from "@/lib/email/resend-client"

/**
 * The one function that actually sends a quotation email, through Resend.
 *
 * Returns a result rather than throwing: a failed send (bad address,
 * provider outage, missing API key) is an expected, recoverable outcome the
 * caller must show the operator a sentence about — not an unhandled
 * exception. See `resend-client.ts` for why the key can legitimately be
 * absent right now.
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
}

export type SendQuoteEmailResult = { ok: true } | { ok: false; error: string }

export async function sendQuoteEmail(input: SendQuoteEmailInput): Promise<SendQuoteEmailResult> {
  const resend = getResendClient()

  if (!resend) {
    return {
      ok: false,
      error:
        "Email sending isn't configured yet. Add RESEND_API_KEY (see .env.example) to send quotations by email, or send this one over WhatsApp instead.",
    }
  }

  const { error } = await resend.emails.send({
    from: getEmailFromAddress(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: textToSimpleHtml(input.text),
    attachments: input.attachment
      ? [{ filename: input.attachment.filename, content: input.attachment.content }]
      : undefined,
  })

  if (error) {
    console.error("[email] failed to send quotation email", error)
    return { ok: false, error: "Could not send the email. Please try again shortly." }
  }

  return { ok: true }
}

/** A minimal HTML rendering of the same plain-text body, so mail clients
 *  that prefer HTML still show readable paragraphs rather than one run-on
 *  line. Deliberately not a branded template — the PDF attachment already
 *  carries the logo and layout; this is the envelope, not the document. */
function textToSimpleHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#141414;white-space:pre-wrap;">${escaped}</div>`
}
