"use client"

import { useActionState, useId, useState } from "react"
import { Loader2, TriangleAlert } from "lucide-react"

import { cancelOrderAction } from "@/lib/actions/order.actions"
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
import { formatCurrency } from "@/lib/utils/format-currency"

const IDLE = { status: "idle" as const }

/**
 * Cancels an order, from its page.
 *
 * ── The warning ───────────────────────────────────────────────────────
 * Cancellation is no longer refused when the customer has already paid, so
 * this dialog carries the weight that the refusal used to: when confirmed
 * money is on the order, it says so before the operator can act, names the
 * exact amount, and states plainly that cancelling does not move it.
 *
 * The refund question is asked rather than assumed, because whether the money
 * has physically gone back is a fact only the operator has. Ticking it marks
 * every confirmed payment REFUNDED in the same transaction; leaving it
 * unticked cancels the order and leaves the ledger untouched, and the success
 * message then reminds them what is still outstanding.
 *
 * `amountPaid` comes from the order's live finance summary, which is derived
 * from confirmed payments (never a stored column) — so the figure here is the
 * same one the payments panel shows.
 */
export function OrderCancelDialog({
  orderId,
  orderNumber,
  amountPaid,
}: {
  orderId: string
  orderNumber: string
  amountPaid: number
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(cancelOrderAction, IDLE)
  const reasonId = useId()
  const refundId = useId()

  const hasPayments = amountPaid > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>Cancel order</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel order {orderNumber}?</DialogTitle>
        </DialogHeader>

        {/*
          The strong warning, and the first thing in the dialog when it
          applies — above the explanatory copy, not folded into it, because an
          operator cancelling a paid order needs to see the amount before they
          read anything else.
        */}
        {hasPayments ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3"
          >
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="flex flex-col gap-1 text-small">
              <p className="font-semibold text-destructive">
                This customer has already paid {formatCurrency(amountPaid)}.
              </p>
              <p className="text-muted-foreground">
                Cancelling does not return that money. Arrange the refund with the customer, then record it — either
                by ticking the box below, or from the payments panel once it has gone back.
              </p>
            </div>
          </div>
        ) : null}

        <p className="text-small text-muted-foreground">
          Reserved parts return to stock, and a vehicle this order reserved goes back on sale. This cannot be undone.
        </p>

        {state.status === "error" && state.message ? (
          <p role="alert" className="text-small text-destructive">
            {state.message}
          </p>
        ) : null}

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="orderId" value={orderId} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={reasonId} className="text-xs font-medium text-muted-foreground">
              Reason
            </Label>
            <Textarea
              id={reasonId}
              name="reason"
              rows={2}
              minLength={3}
              maxLength={500}
              required
              placeholder="Customer withdrew before shipping"
              className="min-h-16 rounded-md border-input px-2.5 py-2 text-small"
            />
          </div>

          {hasPayments ? (
            <label
              htmlFor={refundId}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-small"
            >
              <input
                id={refundId}
                name="refundPayments"
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded border-input"
              />
              <span className="flex flex-col gap-1">
                <span className="font-medium text-foreground">
                  Also mark {formatCurrency(amountPaid)} as refunded
                </span>
                <span className="text-muted-foreground">
                  Tick only if the money has actually been returned to the customer. This writes a refund to the
                  payment ledger and cannot be undone.
                </span>
              </span>
            </label>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Keep order</DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {hasPayments ? "Cancel anyway" : "Cancel order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
