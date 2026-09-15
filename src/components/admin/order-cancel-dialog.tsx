"use client"

import { useActionState, useId, useState } from "react"
import { Loader2 } from "lucide-react"

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

const IDLE = { status: "idle" as const }

/**
 * Cancels an order, from its page. The server decides whether it may — a
 * cancellation is refused while confirmed payments remain — and says why;
 * this dialog only collects the reason the audit trail records.
 */
export function OrderCancelDialog({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(cancelOrderAction, IDLE)
  const reasonId = useId()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>Cancel order</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel order {orderNumber}?</DialogTitle>
        </DialogHeader>

        <p className="text-small text-muted-foreground">
          A reserved vehicle goes back on sale and reserved parts return to stock. Any confirmed payment must be
          reversed or refunded first. This cannot be undone.
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

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Keep order</DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              Cancel order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
