import "server-only"

import { getEmailFromAddress, getResendClient } from "@/lib/email/resend-client"

/**
 * The one function that hands an email to Resend. Quotation dispatch and
 * every automatic notification go through it.
 *
 * Returns a result rather than throwing: a failed send is an expected,
 * recoverable outcome — the database write that prompted the email has
 * already happened and must not be undone because a mailbox was unreachable.
 * Callers decide what to tell the operator.
 */

export interface EmailAttachment {
  filename: string
  content: Buffer
}

export interface SendEmailInput {
  to: string | readonly string[]
  subject: string
  text: string
  html: string
  attachments?: readonly EmailAttachment[]
  /** Makes a retried send of the same message a no-op at Resend (24 hours). */
  idempotencyKey?: string
}

export type SendEmailResult =
  | { ok: true }
  | { ok: false; reason: "NOT_CONFIGURED" | "PROVIDER_ERROR" }

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getResendClient()

  if (!resend) {
    return { ok: false, reason: "NOT_CONFIGURED" }
  }

  try {
    const { error } = await resend.emails.send(
      {
        from: getEmailFromAddress(),
        to: typeof input.to === "string" ? input.to : [...input.to],
        // A subject is a header; a line break in one is header injection.
        subject: input.subject.replace(/[\r\n]+/g, " ").trim(),
        text: input.text,
        html: input.html,
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
        })),
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
    )

    if (error) {
      // The provider's error names the problem (invalid sender, domain not
      // verified, quota). The recipient address is deliberately not logged.
      console.error("[email] Resend rejected the message", { name: error.name, message: error.message })
      return { ok: false, reason: "PROVIDER_ERROR" }
    }

    return { ok: true }
  } catch (error) {
    console.error("[email] could not reach Resend", error)
    return { ok: false, reason: "PROVIDER_ERROR" }
  }
}
