"use client"

import { useActionState, useId, useState } from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { convertQuoteToOrderAction, type ConvertQuoteState } from "@/lib/actions/quote.actions"
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
import { useQuotePricing } from "@/lib/quotes/quote-pricing-context"
import { formatCurrency } from "@/lib/utils/format-currency"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

const INITIAL_STATE: ConvertQuoteState = { status: "idle" }

interface QuoteConvertDialogProps {
  quoteId: string
  total: number
  disabled?: boolean
  disabledReason?: string
}

/**
 * Converts an accepted quotation into an order.
 *
 * The confirmation checkbox is the "accepted and paid" gate the brief asks
 * for, made explicit rather than inferred from status alone: converting
 * reserves real inventory (a vehicle, or stock a customer elsewhere might
 * also want), so it should never happen from a stray click.
 */
export function QuoteConvertDialog({ quoteId, total, disabled = false, disabledReason }: QuoteConvertDialogProps) {
  const router = useRouter()
  const { isDirty } = useQuotePricing()
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [state, formAction, isPending] = useActionState(convertQuoteToOrderAction, INITIAL_STATE)
  const confirmId = useId()

  useEffect(() => {
    if (state.status === "success" && state.orderId) {
      router.push(`${ADMIN_BASE_PATH}/orders/${state.orderId}`)
    }
    // Only ever fires once per successful conversion — `state` only changes
    // identity when the action runs again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  /**
   * `convertQuoteToOrderAction` reads the quote from the database, never
   * from the live draft — converting reserves real stock and freezes a
   * total onto the new order, so it can never trust unsaved client state.
   * That means unsaved edits here are worse than on Send: converting while
   * dirty would silently build the order from the *old*, saved figures
   * while the screen shows the new ones, not just fail with a stale-looking
   * error. Blocking it here, before the confirmation dialog even opens, is
   * what stops that mismatch from ever reaching the server.
   */
  const effectiveDisabled = disabled || isDirty
  const effectiveReason = disabled
    ? disabledReason
    : isDirty
      ? "You have unsaved changes — save the details before converting this quote."
      : undefined

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
          Convert to order
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to order</DialogTitle>
            <DialogDescription>{formatCurrency(total)} · permanent</DialogDescription>
          </DialogHeader>

          {state.status === "error" && state.message ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          {state.status === "success" ? (
            <Alert>
              <CheckCircle2 aria-hidden="true" className="text-gold-ink" />
              <AlertDescription>
                Order {state.orderNumber} created. Opening it now…
              </AlertDescription>
            </Alert>
          ) : (
            <form action={formAction} className="flex flex-col gap-4">
              <input type="hidden" name="quoteId" value={quoteId} />
              <input type="hidden" name="confirmAccepted" value={confirmed ? "true" : ""} />

              <label htmlFor={confirmId} className="flex items-start gap-2.5 text-small">
                <input
                  id={confirmId}
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-0.5 size-4 rounded border-input"
                />
                <span>The customer has accepted this quotation and payment can proceed.</span>
              </label>

              <DialogFooter>
                <Button type="submit" disabled={isPending || !confirmed}>
                  {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                  Create order
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
