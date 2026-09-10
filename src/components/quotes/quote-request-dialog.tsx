"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  QuoteRequestForm,
  type QuoteRequestSubject,
} from "@/components/quotes/quote-request-form"
import { cn } from "@/lib/utils"

/**
 * The quotation form in a panel over the page the customer is on.
 *
 * ── Why a panel, not a page ───────────────────────────────────────────
 * The same reason the parts quick view is one: someone asking about a car is
 * looking at the car. Sending them to another page to type their name takes
 * the photographs away at the moment they are deciding, and on a phone the
 * way back is a long scroll. The panel asks the few things it needs, in
 * place, and hands them back to the listing exactly where they were.
 *
 * Mounted only while open, so every opening starts from a fresh form — a
 * confirmation from the last request never greets the next one — while the
 * contact details still carry over through remembered-contact.ts.
 */
interface QuoteRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  subject: QuoteRequestSubject
  submitLabel: string
  onSubmitted?: (quoteNumber: string) => void
}

export function QuoteRequestDialog({
  open,
  onOpenChange,
  title,
  description,
  subject,
  submitLabel,
  onSubmitted,
}: QuoteRequestDialogProps) {
  if (!open) return null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto overscroll-contain p-0 sm:max-w-xl">
        <QuoteRequestPanel
          title={title}
          description={description}
          subject={subject}
          submitLabel={submitLabel}
          onSubmitted={onSubmitted}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

/**
 * The panel's contents without the dialog around it — for a surface that is
 * already a dialog (the parts list), which switches its own body to this
 * rather than stacking a second modal on top of itself.
 */
export function QuoteRequestPanel({
  title,
  description,
  subject,
  submitLabel,
  onSubmitted,
  onDone,
  header,
}: {
  title: string
  description: string
  subject: QuoteRequestSubject
  submitLabel: string
  onSubmitted?: (quoteNumber: string) => void
  onDone?: () => void
  /** Rendered above the title, e.g. a "back to your list" control. */
  header?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 p-5 sm:p-7">
      {header}
      <div className="flex flex-col gap-1.5">
        {/* Padded on the right so a long title does not run under the
            dialog's own close button. */}
        <DialogTitle className="pr-8 font-heading text-title font-semibold">{title}</DialogTitle>
        <DialogDescription className="text-small">{description}</DialogDescription>
      </div>

      {/* A gold hairline under the heading — the brand accent used as a
          separator, not as paint. */}
      <div aria-hidden="true" className="h-px w-12 bg-gold" />

      <QuoteRequestForm
        subject={subject}
        submitLabel={submitLabel}
        onSubmitted={onSubmitted}
        onDone={onDone}
      />
    </div>
  )
}

/**
 * A button that opens the quotation panel — what a server-rendered page
 * places where it wants a "Get a quote".
 *
 * Every prop is plain data, so a Server Component can render it with the
 * subject it already has (a vehicle's slug and label, a catalogue's source)
 * and the only client JavaScript on the page is this button and the panel it
 * opens.
 */
export function QuoteRequestButton({
  subject,
  title,
  description,
  submitLabel,
  children,
  variant = "default",
  size = "lg",
  className,
}: {
  subject: QuoteRequestSubject
  title: string
  description: string
  submitLabel: string
  children: React.ReactNode
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "sm" | "default" | "lg" | "xl"
  className?: string
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(className)}
      >
        {children}
      </Button>

      <QuoteRequestDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        subject={subject}
        submitLabel={submitLabel}
      />
    </>
  )
}
