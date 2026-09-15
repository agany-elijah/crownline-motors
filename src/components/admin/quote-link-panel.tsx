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
    <div className="flex flex-col gap-3 rounded-lg bg-secondary/40 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-small font-medium">Customer PDF link</p>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1.5 text-small text-gold-ink hover:underline"
        >
          {link}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </div>

      {state.status === "success" && state.message ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" className="text-gold-ink" />
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
    </div>
  )
}
