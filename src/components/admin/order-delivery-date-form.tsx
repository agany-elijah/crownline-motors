"use client"

import { useActionState, useId } from "react"
import { CalendarRange, CheckCircle2, Loader2 } from "lucide-react"

import { updateOrderDeliveryDateAction } from "@/lib/actions/order.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const INITIAL_STATE = { status: "idle" as const }

function toDateInputValue(date: Date | null): string {
  if (!date) return ""
  return date.toISOString().slice(0, 10)
}

/**
 * The expected delivery window a customer sees on Track My Order —
 * "between 17 and 30 October". A first day alone is a single-date estimate;
 * both empty clears it. Saved on its own, independent of the tracking events
 * (see the note on `Order.estimatedDeliveryDate`), so it can be given before
 * tracking starts and revised as the schedule firms up.
 */
export function OrderDeliveryDateForm({
  orderId,
  deliveryDate,
  deliveryDateLatest,
}: {
  orderId: string
  deliveryDate: Date | null
  deliveryDateLatest: Date | null
}) {
  const [state, formAction, isPending] = useActionState(updateOrderDeliveryDateAction, INITIAL_STATE)
  const fromId = useId()
  const toId = useId()

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-border pt-4">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-small font-medium">
          <CalendarRange aria-hidden="true" className="size-4 text-muted-foreground" />
          Expected delivery
        </span>
        <span className="text-xs text-muted-foreground">
          Shown to the customer on Track My Order. Leave the last day empty for a single date.
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label htmlFor={fromId} className="flex flex-col gap-1 text-xs text-muted-foreground">
          From
          <Input
            id={fromId}
            name="deliveryDate"
            type="date"
            defaultValue={toDateInputValue(deliveryDate)}
            className="h-9 w-40 rounded-md border-input bg-card px-2.5 text-small"
          />
        </label>
        <label htmlFor={toId} className="flex flex-col gap-1 text-xs text-muted-foreground">
          To
          <Input
            id={toId}
            name="deliveryDateLatest"
            type="date"
            defaultValue={toDateInputValue(deliveryDateLatest)}
            className="h-9 w-40 rounded-md border-input bg-card px-2.5 text-small"
          />
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-9">
          {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          Save
        </Button>
      </div>

      {state.status === "success" && state.message ? (
        <p role="status" className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 aria-hidden="true" className="size-3.5" />
          {state.message}
        </p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
