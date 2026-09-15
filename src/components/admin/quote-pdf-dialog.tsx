"use client"

import { useState } from "react"
import { AlertTriangle, Download, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useQuotePricing } from "@/lib/quotes/quote-pricing-context"

/**
 * "Generate PDF" — lets an operator see the exact branded quotation a
 * customer would receive, without going through the send flow first.
 *
 * Renders the same `/api/quotes/[id]/preview` route `QuoteDispatchDialog`'s
 * own "Preview quotation" link opens in a new tab, but here embedded in an
 * `<iframe>` so the document can be reviewed on this page — most browsers
 * render a PDF natively inside one. The iframe is only mounted while the
 * dialog is open, so an operator who never opens it never pays for the
 * render.
 */
export function QuotePdfDialog({ quoteId }: { quoteId: string }) {
  const { totals, isDirty } = useQuotePricing()
  const [open, setOpen] = useState(false)

  const canGenerate = totals.itemLineCount > 0
  const previewHref = `/api/quotes/${quoteId}/preview`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGenerate}
            title={canGenerate ? undefined : "Add at least one item to generate a PDF."}
          />
        }
      >
        <FileText aria-hidden="true" />
        Generate PDF
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Quotation PDF</DialogTitle>
        </DialogHeader>

        {isDirty ? (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
            Unsaved changes are not included.
          </p>
        ) : null}

        {open ? (
          <iframe
            src={previewHref}
            title="Quotation PDF preview"
            className="h-[70vh] w-full rounded-md ring-1 ring-foreground/10"
          />
        ) : null}

        <DialogFooter className="sm:justify-between">
          <Button render={<a href={previewHref} download />} type="button" variant="outline" size="sm">
            <Download aria-hidden="true" />
            Download
          </Button>
          <DialogClose render={<Button type="button" variant="outline" size="sm" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
