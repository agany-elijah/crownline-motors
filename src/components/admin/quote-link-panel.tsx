"use client"

import { useActionState, useRef } from "react"
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react"

import { revokeQuoteLinkAction } from "@/lib/actions/quote.actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"

const INITIAL_STATE = { status: "idle" as const }

/** The customer's secure PDF link, once one has been minted for this quote. */
export function QuoteLinkPanel({ quoteId, link }: { quoteId: string; link: string }) {
  const [state, formAction, isPending] = useActionState(revokeQuoteLinkAction, INITIAL_STATE)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-subtle)]">
      <div className="flex flex-col gap-2">
        <h2 className="text-small font-medium text-foreground">Customer PDF link</h2>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="group/link flex items-start gap-2 rounded-md border border-border bg-sunken/60 px-3 py-2 font-mono text-xs break-all text-foreground transition-colors duration-fast hover:border-gold-ink/40 hover:text-gold-ink"
        >
          <span className="min-w-0 flex-1">{link}</span>
          <ExternalLink aria-hidden="true" className="mt-px size-3.5 shrink-0 text-muted-foreground group-hover/link:text-gold-ink" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>

      {state.status === "success" && state.message ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" className="text-success" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form ref={formRef} action={formAction}>
        <input type="hidden" name="quoteId" value={quoteId} />
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline" size="sm" disabled={isPending}>
              {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              Revoke link
            </Button>
          }
          title="Revoke this link?"
          description="The link will stop opening the document. Sending the quotation again creates a new one."
          confirmLabel="Revoke link"
          destructive
          pending={isPending}
          onConfirm={() => formRef.current?.requestSubmit()}
        />
      </form>
    </section>
  )
}
