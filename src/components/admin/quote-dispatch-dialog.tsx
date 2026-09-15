"use client"

import { useActionState, useId, useState, type ReactNode } from "react"
import { AlertCircle, CheckCircle2, ExternalLink, Eye, Loader2, Mail, Send } from "lucide-react"

import { QuoteDispatchChannel } from "@/generated/prisma/enums"
import { sendQuoteDispatchAction, type QuoteDispatchState } from "@/lib/actions/quote.actions"
import { siteConfig } from "@/config/site"
import { defaultQuoteNote } from "@/lib/quotes/quote-messages"
import { useQuotePricing } from "@/lib/quotes/quote-pricing-context"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"

const INITIAL_STATE: QuoteDispatchState = { status: "idle" }

interface QuoteDispatchDialogProps {
  quoteId: string
  customerName: string
  contactEmail: string | null
  contactWhatsapp: string | null
  /** True once this quote has been sent at least once — swaps every label
   *  in this component from "Send" to "Resend" so an operator editing an
   *  already-sent quote (a price changed, the customer never got it) is not
   *  left wondering whether pressing the button re-sends it or objects that
   *  it was already sent. */
  alreadySent?: boolean
  disabled?: boolean
  disabledReason?: string
}

const CHANNEL_LABEL: Record<QuoteDispatchChannel, string> = {
  [QuoteDispatchChannel.WHATSAPP]: "WhatsApp",
  [QuoteDispatchChannel.EMAIL]: "Email",
}

/**
 * Sends a quotation to the customer, over WhatsApp or email — the modal the
 * developer brief asks for: a customer summary for confirmation, the two
 * channels as selectable cards, an "Attach PDF quotation" toggle, and an
 * editable opening note, with the primary button's label following whichever
 * channel is selected.
 *
 * ── Why "attach" means a link on WhatsApp but a real attachment on email ──
 * WhatsApp click-to-chat has no mechanism to pre-attach a file to a
 * conversation under any implementation — that is a WhatsApp limitation, not
 * a shortcut taken here — so its message always carries a secure link
 * instead. Email is sent for real, server-side, through Resend
 * (`sendQuoteEmail`), with the rendered PDF as a genuine binary attachment.
 * One toggle, "Attach PDF quotation", drives both: the label describes the
 * intent ("give the customer the document") rather than the channel-specific
 * mechanics, which the helper text below it spells out.
 *
 * ── Why the WhatsApp link is a click, not an automatic redirect ─────────
 * The Server Action returns a wa.me URL once the message is ready to send —
 * it cannot itself switch the operator's device into another app.
 * Auto-navigating from the action's result would run after an async round
 * trip, which most browsers' popup blockers correctly treat as no longer
 * "in response to" the click that started it. A visible link the operator
 * clicks is a direct, trusted gesture and opens every time. Email needs no
 * such step — the server has already sent it.
 */
export function QuoteDispatchDialog({
  quoteId,
  customerName,
  contactEmail,
  contactWhatsapp,
  alreadySent = false,
  disabled = false,
  disabledReason,
}: QuoteDispatchDialogProps) {
  const hasEmail = Boolean(contactEmail)
  const hasWhatsapp = Boolean(contactWhatsapp)

  const { readinessProblem, isDirty, totals } = useQuotePricing()

  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<QuoteDispatchChannel>(
    hasWhatsapp ? QuoteDispatchChannel.WHATSAPP : QuoteDispatchChannel.EMAIL
  )
  const [includeLink, setIncludeLink] = useState(true)
  const [note, setNote] = useState(() => defaultQuoteNote(siteConfig.name))
  const [state, formAction, isPending] = useActionState(sendQuoteDispatchAction, INITIAL_STATE)
  const includeLinkId = useId()
  const noteId = useId()

  const verb = alreadySent ? "Resend" : "Send"

  /**
   * Three independent reasons this can refuse to open, checked in the order
   * an operator would actually resolve them.
   *
   * `isDirty` goes first and deliberately short-circuits `readinessProblem`:
   * `sendQuoteDispatchAction` re-reads the quote from the database, never
   * from this draft, so a draft that looks complete on screen is not the
   * same thing as a database row that is. Showing the field-level message
   * here instead — "add a price", "set a validity date" — would have an
   * operator "fix" a field that was already filled in, resubmit, and watch
   * the exact same message come back, because the database still has the
   * old value. See the file note on `isDirty` in quote-pricing-context.tsx.
   */
  const dirtyReason = "You have unsaved changes — save the details before sending this quotation."
  const effectiveDisabled = disabled || isDirty || Boolean(readinessProblem)
  const effectiveReason = disabled
    ? disabledReason
    : isDirty
      ? dirtyReason
      : (readinessProblem ?? undefined)

  const canPreview = totals.itemLineCount > 0
  const previewHref = `/api/quotes/${quoteId}/preview`

  return (
    <div className="flex flex-col items-end gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              type="button"
              size="sm"
              disabled={effectiveDisabled}
              title={effectiveDisabled ? effectiveReason : undefined}
            />
          }
        >
          {verb} quotation
        </DialogTrigger>

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{verb} quotation</DialogTitle>
            <DialogDescription>Review the details below, then choose how to send it.</DialogDescription>
          </DialogHeader>

          {state.status === "success" ? (
            <div className="flex flex-col gap-4">
              <Alert>
                <CheckCircle2 aria-hidden="true" className="text-gold-ink" />
                <AlertDescription>
                  {state.channel === QuoteDispatchChannel.EMAIL
                    ? `The quotation has been emailed to ${contactEmail}.`
                    : "The quotation has been marked as sent. Finish sending it below."}
                </AlertDescription>
              </Alert>

              {state.channel === QuoteDispatchChannel.WHATSAPP && state.dispatchUrl ? (
                <Button
                  render={<a href={state.dispatchUrl} target="_blank" rel="noopener noreferrer" />}
                  variant="whatsapp"
                  size="lg"
                >
                  <ExternalLink aria-hidden="true" />
                  Open in WhatsApp
                </Button>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-5">
              <input type="hidden" name="quoteId" value={quoteId} />
              <input type="hidden" name="channel" value={channel} />
              <input type="hidden" name="note" value={note} />

              {state.status === "error" && state.message ? (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              ) : null}

              {/* Customer summary — confirmation before anything goes out. */}
              <div className="flex flex-col gap-1 rounded-xl bg-accent/30 p-4 ring-1 ring-foreground/10">
                <p className="text-small font-semibold text-foreground">{customerName}</p>
                <p className="flex items-center gap-1.5 text-small text-muted-foreground">
                  <WhatsAppGlyph className="size-3.5 shrink-0" />
                  {contactWhatsapp ?? "No WhatsApp number on file"}
                </p>
                <p className="flex items-center gap-1.5 text-small text-muted-foreground">
                  <Mail aria-hidden="true" className="size-3.5 shrink-0" />
                  {contactEmail ?? "No email address on file"}
                </p>
              </div>

              {/* Channel selector — two selectable cards. */}
              <div className="flex flex-col gap-2">
                <span className="text-meta text-muted-foreground">Send via</span>
                <div role="radiogroup" aria-label="Send via" className="grid grid-cols-2 gap-2.5">
                  <ChannelCard
                    label="WhatsApp"
                    detail={contactWhatsapp ?? "Not on file"}
                    icon={<WhatsAppGlyph className="size-5 text-[#11823f]" />}
                    selected={channel === QuoteDispatchChannel.WHATSAPP}
                    disabled={!hasWhatsapp}
                    onSelect={() => setChannel(QuoteDispatchChannel.WHATSAPP)}
                  />
                  <ChannelCard
                    label="Email"
                    detail={contactEmail ?? "Not on file"}
                    icon={<Mail aria-hidden="true" className="size-5 text-gold-ink" />}
                    selected={channel === QuoteDispatchChannel.EMAIL}
                    disabled={!hasEmail}
                    onSelect={() => setChannel(QuoteDispatchChannel.EMAIL)}
                  />
                </div>
              </div>

              <label htmlFor={includeLinkId} className="flex items-start gap-2.5 text-small">
                <input
                  id={includeLinkId}
                  type="checkbox"
                  name="includeLink"
                  checked={includeLink}
                  onChange={(event) => setIncludeLink(event.target.checked)}
                  className="mt-0.5 size-4 rounded border-input"
                />
                <span>
                  Attach PDF quotation
                  <span className="block text-muted-foreground">
                    {includeLink
                      ? channel === QuoteDispatchChannel.EMAIL
                        ? "The quotation PDF will be attached to the email."
                        : "The message will include a secure link to the PDF."
                      : "The message will include the figures and payment instructions as text only."}
                  </span>
                </span>
              </label>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={noteId} className="text-meta text-muted-foreground">
                  Message
                </label>
                <Textarea
                  id={noteId}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder={defaultQuoteNote(siteConfig.name)}
                />
                <p className="text-xs text-muted-foreground">
                  Sent above the figures and total. The prices and payment details below it always
                  come from the quotation itself and can&apos;t be edited here.
                </p>
              </div>

              <DialogFooter className="items-center sm:justify-between">
                <Button
                  render={<a href={previewHref} target="_blank" rel="noopener noreferrer" />}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!canPreview}
                  title={canPreview ? undefined : "Add at least one item to preview the quotation."}
                >
                  <Eye aria-hidden="true" />
                  Preview quotation
                </Button>

                <Button
                  type="submit"
                  disabled={
                    isPending ||
                    effectiveDisabled ||
                    (channel === QuoteDispatchChannel.EMAIL ? !hasEmail : !hasWhatsapp)
                  }
                >
                  {isPending ? (
                    <Loader2 aria-hidden="true" className="animate-spin" />
                  ) : channel === QuoteDispatchChannel.WHATSAPP ? (
                    <WhatsAppGlyph className="size-4" />
                  ) : (
                    <Send aria-hidden="true" />
                  )}
                  {verb} via {CHANNEL_LABEL[channel]}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {effectiveDisabled && effectiveReason ? (
        <p className="max-w-56 text-right text-xs text-muted-foreground">{effectiveReason}</p>
      ) : null}
    </div>
  )
}

interface ChannelCardProps {
  label: string
  detail: string
  icon: ReactNode
  selected: boolean
  disabled: boolean
  onSelect: () => void
}

function ChannelCard({ label, detail, icon, selected, disabled, onSelect }: ChannelCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors duration-fast",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:opacity-45",
        selected
          ? "border-gold-ink/60 bg-accent/50 shadow-[var(--shadow-subtle)]"
          : "border-border bg-card hover:border-gold-ink/30"
      )}
    >
      {icon}
      <span className="flex flex-col gap-0.5">
        <span className="text-small font-semibold text-foreground">{label}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  )
}
