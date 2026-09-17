"use client"

import { useActionState, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { QuoteStatus } from "@/generated/prisma/enums"
import { updateQuoteStatusAction } from "@/lib/actions/quote.actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MANUAL_QUOTE_TRANSITIONS, transitionLabel } from "@/lib/constants/quote-status"

const INITIAL_STATE = { status: "idle" as const }

interface QuoteStatusControlProps {
  quoteId: string
  status: QuoteStatus
}

/**
 * Manual status moves for a quote — everything except becoming SENT (which
 * happens by sending it) or WON (which happens by converting it). See
 * quote-status.ts for why those two are deliberately absent here.
 *
 * Marking a quote lost or expired asks for a reason first: it is a closed
 * door, and the note is what answers "why did we lose this one" the next
 * time anyone looks at this quote — or reports on a month of them.
 */
export function QuoteStatusControl({ quoteId, status }: QuoteStatusControlProps) {
  const [state, formAction, isPending] = useActionState(updateQuoteStatusAction, INITIAL_STATE)
  const [reasonDialogTarget, setReasonDialogTarget] = useState<QuoteStatus | null>(null)

  const transitions = MANUAL_QUOTE_TRANSITIONS[status]

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-subtle)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-small font-medium text-foreground">Status</h2>
        <p className="text-xs text-muted-foreground">
          Sending and converting move a quote on by themselves; these are the other moves.
        </p>
      </div>

      {state.status === "success" && state.message ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" className="text-success" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {transitions.length === 0 ? (
        <p className="text-small text-muted-foreground">No further moves from here.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {transitions.map((target) => {
            const needsReason = target === QuoteStatus.REJECTED || target === QuoteStatus.EXPIRED

            if (needsReason) {
              return (
                <Dialog
                  key={target}
                  open={reasonDialogTarget === target}
                  onOpenChange={(open) => setReasonDialogTarget(open ? target : null)}
                >
                  <DialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={isPending} />}>
                    {transitionLabel(status, target)}
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{transitionLabel(status, target)}</DialogTitle>
                    </DialogHeader>

                    <form
                      action={formAction}
                      onSubmit={() => setReasonDialogTarget(null)}
                      className="flex flex-col gap-3"
                    >
                      <input type="hidden" name="quoteId" value={quoteId} />
                      <input type="hidden" name="status" value={target} />
                      <Label htmlFor={`reason-${target}`} className="sr-only">
                        Reason
                      </Label>
                      <Textarea
                        id={`reason-${target}`}
                        name="reason"
                        rows={3}
                        maxLength={500}
                        placeholder="e.g. Customer chose another dealer"
                      />
                      <DialogFooter>
                        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                        <Button type="submit" variant="destructive">
                          {transitionLabel(status, target)}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )
            }

            return (
              <form key={target} action={formAction}>
                <input type="hidden" name="quoteId" value={quoteId} />
                <input type="hidden" name="status" value={target} />
                <Button type="submit" disabled={isPending} variant="outline" size="sm">
                  {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                  {transitionLabel(status, target)}
                </Button>
              </form>
            )
          })}
        </div>
      )}
    </section>
  )
}
