import { Check, MapPin } from "lucide-react"

import {
  SHIPMENT_TYPE_LABELS,
  TRACKING_STATUS_LABELS,
  trackingTimelineFor,
} from "@/lib/constants/tracking-status"
import type { PublicTrackingEvent, PublicTrackingResult } from "@/lib/queries/tracking.queries"
import { cn } from "@/lib/utils"

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

type StageState = "complete" | "current" | "upcoming"

function latestEventFor(events: readonly PublicTrackingEvent[], status: PublicTrackingEvent["status"]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].status === status) return events[index]
  }
  return undefined
}

/**
 * A shipment's journey, as its customer sees it: every stage of the timeline
 * for its type, ticked off up to where it is now.
 *
 * The same component renders a vehicle import and a parts delivery — the
 * stages come from `trackingTimelineFor`, so a customer never has to know
 * there are two logistics chains behind the page.
 */
export function TrackingTimeline({ result }: { result: PublicTrackingResult }) {
  const stages = trackingTimelineFor(result.shipmentType)
  const currentIndex = stages.indexOf(result.currentStatus)
  const finished = currentIndex === stages.length - 1

  return (
    <article
      aria-labelledby="tracking-result-heading"
      className="flex flex-col gap-8 rounded-xl bg-card p-6 shadow-[var(--shadow-subtle)] ring-1 ring-foreground/10 md:p-8"
    >
      <header className="flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-gold-ink">{SHIPMENT_TYPE_LABELS[result.shipmentType]} shipment</span>
          <h2 id="tracking-result-heading" className="text-h2">
            {result.subject}
          </h2>
          <p className="text-small text-muted-foreground">
            Tracking number <span className="font-mono text-foreground">{result.trackingNumber}</span>
          </p>
        </div>

        <div className="flex flex-col gap-1.5 md:items-end">
          <span className="text-meta text-muted-foreground">Current status</span>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-4 py-1.5 text-small font-semibold text-background">
            <span aria-hidden="true" className="size-2 rounded-full bg-gold" />
            {TRACKING_STATUS_LABELS[result.currentStatus]}
          </span>
          {result.currentLocation ? (
            <span className="flex items-center gap-1 text-small text-muted-foreground">
              <MapPin aria-hidden="true" className="size-3.5" />
              {result.currentLocation}
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">Last updated {DATE_FORMAT.format(result.lastUpdated)}</span>
        </div>
      </header>

      <ol aria-label="Order journey" className="flex flex-col">
        {stages.map((stage, index) => {
          const state: StageState =
            index < currentIndex || (finished && index === currentIndex)
              ? "complete"
              : index === currentIndex
                ? "current"
                : "upcoming"
          const event = state === "upcoming" ? undefined : latestEventFor(result.events, stage)
          const isLast = index === stages.length - 1

          return (
            <li
              key={stage}
              aria-current={state === "current" ? "step" : undefined}
              className="relative flex gap-4 pb-7 last:pb-0"
            >
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-8 bottom-1 left-[13px] w-0.5 rounded-full",
                    index < currentIndex ? "bg-gold" : "bg-border"
                  )}
                />
              ) : null}

              <span
                aria-hidden="true"
                className={cn(
                  "relative flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                  state === "complete" && "border-gold bg-gold text-gold-foreground",
                  state === "current" && "border-gold bg-background ring-4 ring-gold/25",
                  state === "upcoming" && "border-border bg-background"
                )}
              >
                {state === "complete" ? (
                  <Check className="size-4" strokeWidth={3} />
                ) : state === "current" ? (
                  <span className="size-2.5 rounded-full bg-gold" />
                ) : null}
              </span>

              <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                <p className={cn("text-body font-medium", state === "upcoming" && "text-muted-foreground")}>
                  {TRACKING_STATUS_LABELS[stage]}
                  <span className="sr-only">
                    {state === "complete" ? " — completed" : state === "current" ? " — current stage" : " — not yet reached"}
                  </span>
                </p>
                {event ? (
                  <p className="text-small text-muted-foreground">
                    {DATE_FORMAT.format(event.eventDate)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </article>
  )
}
