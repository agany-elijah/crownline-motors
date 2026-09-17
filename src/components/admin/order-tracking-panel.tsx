"use client"

import { useActionState, useId, useState } from "react"
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, MapPin, Plus, Truck } from "lucide-react"

import {
  addTrackingEventAction,
  createShipmentAction,
  voidTrackingEventAction,
} from "@/lib/actions/tracking.actions"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/admin/status-badge"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { Textarea } from "@/components/ui/textarea"
import { TRACKING_STATUS_TONES } from "@/lib/constants/tracking-status"
import {
  recordableTrackingStages,
  trackingStageLabel,
  type TrackingStageConfig,
} from "@/lib/settings/tracking-stages"
import type { OrderShipment, OrderTrackingEvent } from "@/lib/queries/order.queries"
import { cn } from "@/lib/utils"

const CREATE_INITIAL = { status: "idle" as const }

const FIELD = "h-9 rounded-md border-input px-2.5 text-small placeholder:text-muted-foreground/70"
const EVENT_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * The order-page tracking surface: activates a shipment, records events
 * against it, and lets an operator void a mistaken one — the admin side of
 * the customer-facing "Track My Order" timeline.
 *
 * The tracking number is shown ready to hand over: copied, or sent straight
 * to the customer's WhatsApp. It is also emailed to them automatically when
 * tracking is activated, and every update after that is emailed too.
 */
export function OrderTrackingPanel({
  orderId,
  shipment,
  customerEmail,
  shareUrl,
  activationProblem,
  lockedReason,
  stages,
}: {
  /** Settings → Orders & tracking: stage names, order and which may be recorded. */
  stages: TrackingStageConfig
  orderId: string
  shipment: OrderShipment | null
  customerEmail: string | null
  /** wa.me link that opens a chat with the customer, tracking number filled in. */
  shareUrl: string | null
  /** Why tracking cannot be activated yet, or null when it can. */
  activationProblem: string | null
  /** Why no further updates may be recorded, or null when they may. */
  lockedReason: string | null
}) {
  const [createState, createAction, isCreating] = useActionState(createShipmentAction, CREATE_INITIAL)

  if (!shipment) {
    if (activationProblem) {
      return (
        <div className="flex flex-col gap-1">
          <p className="text-small text-muted-foreground">Not activated.</p>
          <p className="text-small text-muted-foreground">{activationProblem}</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3">
        <p className="text-small text-muted-foreground">Not activated.</p>

        <form action={createAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <Button type="submit" size="sm" variant="outline" disabled={isCreating}>
            {isCreating ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Truck aria-hidden="true" />
            )}
            Activate tracking
          </Button>
        </form>

        {createState.status === "error" && createState.message ? (
          <p className="text-xs text-destructive">{createState.message}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-lg bg-accent/30 p-4 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Customer tracking number</span>
            <span className="font-mono text-h3 font-semibold tracking-wide">{shipment.trackingNumber}</span>
            {shipment.currentLocation ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin aria-hidden="true" className="size-3" />
                {shipment.currentLocation}
              </span>
            ) : null}
          </div>
          <StatusBadge tone={TRACKING_STATUS_TONES[shipment.currentStatus]}>
            {trackingStageLabel(stages, shipment.shipmentType, shipment.currentStatus)}
          </StatusBadge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyTrackingNumber value={shipment.trackingNumber} />
          {shareUrl ? (
            <Button
              render={<a href={shareUrl} target="_blank" rel="noopener noreferrer" />}
              variant="whatsapp"
              size="sm"
            >
              <WhatsAppGlyph className="size-4" />
              Send on WhatsApp
            </Button>
          ) : null}
        </div>

        {customerEmail ? null : (
          <p className="text-xs text-muted-foreground">No email on file.</p>
        )}
      </div>

      {lockedReason ? (
        <p className="border-t border-border/60 pt-4 text-small text-muted-foreground">{lockedReason}</p>
      ) : (
        <AddTrackingEventForm shipmentId={shipment.id} shipmentType={shipment.shipmentType} stages={stages} />
      )}

      {shipment.events.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {shipment.events.map((event) => (
            <TrackingEventRow
              key={event.id}
              event={event}
              label={trackingStageLabel(stages, shipment.shipmentType, event.status)}
            />
          ))}
        </ol>
      ) : null}
    </div>
  )
}

function CopyTrackingNumber({ value }: { value: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopyState("copied")
    } catch (error) {
      // Clipboard access is refused outside a secure context or by browser
      // policy; say so rather than pretending it worked.
      console.error("[tracking] could not copy the tracking number", error)
      setCopyState("failed")
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={copy}>
        {copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copyState === "copied" ? "Copied" : "Copy number"}
      </Button>
      <span role="status" className={copyState === "failed" ? "text-xs text-destructive" : "sr-only"}>
        {copyState === "failed"
          ? "Could not copy — select the number and copy it manually."
          : copyState === "copied"
            ? "Tracking number copied"
            : ""}
      </span>
    </>
  )
}

function AddTrackingEventForm({
  shipmentId,
  shipmentType,
  stages,
}: {
  shipmentId: string
  shipmentType: OrderShipment["shipmentType"]
  stages: TrackingStageConfig
}) {
  const [state, formAction, isPending] = useActionState(addTrackingEventAction, CREATE_INITIAL)
  const statusId = useId()
  const locationId = useId()
  const dateId = useId()
  const notesId = useId()
  // Enabled stages only, in the configured order. The action refuses a
  // turned-off stage too — this list is a convenience, not the rule.
  const timeline = recordableTrackingStages(stages, shipmentType)

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-border/60 pt-4">
      <input type="hidden" name="shipmentId" value={shipmentId} />

      {state.status === "error" && state.message ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle aria-hidden="true" className="size-3.5" />
          {state.message}
        </p>
      ) : null}

      {state.status === "success" && state.message ? (
        <p role="status" className="flex items-start gap-1.5 text-xs text-success">
          <CheckCircle2 aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={statusId} className="text-xs font-medium text-muted-foreground">
            New status
          </Label>
          <select
            id={statusId}
            name="status"
            defaultValue=""
            required
            className={cn(
              "w-full border bg-card text-foreground outline-none transition-colors",
              "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
              FIELD
            )}
          >
            <option value="" disabled>
              Choose a status…
            </option>
            {timeline.map((stage) => (
              <option key={stage.status} value={stage.status}>
                {stage.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={dateId} className="text-xs font-medium text-muted-foreground">
            Date
          </Label>
          <Input id={dateId} name="eventDate" type="date" defaultValue={todayInputValue()} className={FIELD} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={locationId} className="text-xs font-medium text-muted-foreground">
            Location
          </Label>
          <Input
            id={locationId}
            name="location"
            placeholder="e.g. Mombasa Port"
            className={FIELD}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={notesId} className="text-xs font-medium text-muted-foreground">
          Notes
        </Label>
        <Textarea
          id={notesId}
          name="notes"
          rows={2}
          maxLength={1000}
          placeholder="Internal"
          className="min-h-16 rounded-md border-input px-2.5 py-2 text-small placeholder:text-muted-foreground/70"
        />
      </div>

      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}
          Add update
        </Button>
      </div>
    </form>
  )
}

function TrackingEventRow({ event, label }: { event: OrderTrackingEvent; label: string }) {
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidState, voidAction, isVoiding] = useActionState(voidTrackingEventAction, CREATE_INITIAL)
  const reasonId = useId()

  return (
    <li
      className={cn(
        "flex items-start justify-between gap-3 border-t border-border/60 pt-3 first:border-t-0 first:pt-0",
        event.isVoided && "opacity-50"
      )}
    >
      <div className="flex flex-col gap-0.5">
        <p className={cn("text-small font-medium", event.isVoided && "line-through")}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground">
          {EVENT_DATE_FORMAT.format(event.eventDate)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        {event.notes ? <p className="text-xs text-muted-foreground">{event.notes}</p> : null}
        {event.isVoided ? (
          <p className="text-xs text-destructive">
            Voided{event.voidReason ? ` — ${event.voidReason}` : ""}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Recorded by {event.createdByAdminName}</p>
        )}
      </div>

      {!event.isVoided ? (
        <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
          <DialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>Void</DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Void this update?</DialogTitle>
            </DialogHeader>

            {voidState.status === "error" && voidState.message ? (
              <p className="text-small text-destructive">{voidState.message}</p>
            ) : null}

            <form
              action={voidAction}
              onSubmit={() => setVoidOpen(false)}
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="trackingEventId" value={event.id} />
              <Label htmlFor={reasonId} className="sr-only">
                Reason
              </Label>
              <Textarea
                id={reasonId}
                name="reason"
                rows={2}
                maxLength={500}
                placeholder="e.g. Wrong status selected"
                className="min-h-16 rounded-md border-input px-2.5 py-2 text-small"
              />
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button type="submit" variant="destructive" disabled={isVoiding}>
                  {isVoiding ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                  Void update
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </li>
  )
}
