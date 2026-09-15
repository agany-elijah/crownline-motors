"use client"

import { useActionState, useId } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

import { updateOrderDeliveryDateAction } from "@/lib/actions/order.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const INITIAL_STATE = { status: "idle" as const }

function toDateInputValue(date: Date | null): string {
  if (!date) return ""
  return date.toISOString().slice(0, 10)
}

/**
 * The one thing an operator edits directly on the delivery estimate: a date,
 * saved on its own. Independent of the shipment/tracking timeline — see the
 * note on `Order.estimatedDeliveryDate`.
 */
export function OrderDeliveryDateForm({
  orderId,
  deliveryDate,
}: {
  orderId: string
  deliveryDate: Date | null
}) {
  const [state, formAction, isPending] = useActionState(updateOrderDeliveryDateAction, INITIAL_STATE)
  const fieldId = useId()

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <Label htmlFor={fieldId} className="text-small font-medium text-muted-foreground">
        Estimated delivery date
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={fieldId}
          name="deliveryDate"
          type="date"
          defaultValue={toDateInputValue(deliveryDate)}
          className="h-9 w-44 rounded-md border-input px-2.5 text-small"
        />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          Save
        </Button>
      </div>
      {state.status === "success" && state.message ? (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 aria-hidden="true" className="size-3.5" />
          {state.message}
        </p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p className="text-xs text-destructive">{state.message}</p>
      ) : null}
    </form>
  )
}
