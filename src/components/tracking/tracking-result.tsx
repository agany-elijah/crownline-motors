import type { ReactNode } from "react"
import Image from "next/image"
import { ArrowRight, CalendarRange, Check, Clock3, MapPin, PartyPopper } from "lucide-react"

import { JourneyArt } from "@/components/tracking/journey-art"
import { JOURNEY_ICONS } from "@/components/tracking/journey-icons"
import type { PublicTrackingResult } from "@/lib/queries/tracking.queries"
import type { CustomerJourney, CustomerJourneyPhase } from "@/lib/tracking/customer-journey"
import { cn } from "@/lib/utils"
import { formatCalendarDate, formatDateRange } from "@/lib/utils/format-date-range"

/**
 * A tracked order, as its customer sees it.
 *
 * Three things, in the order a customer asks them: where is it now, when will
 * it reach me, and what happens next. The journey underneath is drawn in its
 * few major phases (see customer-journey.ts), with dates only where a step has
 * actually been recorded — nothing here is estimated except the delivery
 * window, which an operator set and which is labelled as expected.
 */
export function TrackingResult({
  result,
  journey,
  supportAction,
}: {
  result: PublicTrackingResult
  journey: CustomerJourney
  /** The WhatsApp button, rendered by the page, which owns the configured number. */
  supportAction?: ReactNode
}) {
  const { current, currentStage, next, finished } = journey
  const typeLabel = result.shipmentType === "VEHICLE" ? "Vehicle order" : "Spare-parts order"

  return (
    <article aria-labelledby="tracking-result-heading" className="flex flex-col gap-6">
      {/* ── Where it is now ─────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-raised)] ring-1 ring-foreground/10">
        <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="relative aspect-[16/10] md:aspect-auto md:min-h-72">
            {result.imageUrl ? (
              <Image
                src={result.imageUrl}
                alt=""
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover"
              />
            ) : (
              <JourneyArt
                image={current.image}
                icon={current.icon}
                sizes="(min-width: 768px) 40vw, 100vw"
                className="absolute inset-0"
              />
            )}
          </div>

          <div className="flex flex-col gap-6 p-6 md:p-8">
            <div className="flex flex-col gap-2">
              <span className="eyebrow text-gold-ink">{typeLabel}</span>
              <h2 id="tracking-result-heading" className="text-h2">
                {result.subject}
              </h2>
              <p className="text-small text-muted-foreground">
                Tracking number <span className="font-mono text-foreground">{result.trackingNumber}</span>
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-xl bg-secondary/70 p-4 sm:p-5">
              <span className="text-meta font-medium text-muted-foreground uppercase">
                {finished ? "Journey complete" : "Current stage"}
              </span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="relative flex size-2.5 shrink-0">
                  {!finished ? (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-60 motion-reduce:animate-none" />
                  ) : null}
                  <span className={cn("relative inline-flex size-2.5 rounded-full", finished ? "bg-success" : "bg-gold")} />
                </span>
                <span className="text-title font-semibold">{current.title}</span>
                {currentStage.label && currentStage.label !== current.title ? (
                  <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                    {currentStage.label}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-small text-muted-foreground">
                {result.currentLocation ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin aria-hidden="true" className="size-4 text-gold-ink" />
                    {result.currentLocation}
                  </span>
                ) : null}
                <span className="flex items-center gap-1.5">
                  <Clock3 aria-hidden="true" className="size-4 text-gold-ink" />
                  Updated {formatCalendarDate(result.lastUpdated)}
                </span>
              </div>
            </div>

            {result.expectedDelivery && !finished ? (
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-ink">
                  <CalendarRange aria-hidden="true" className="size-5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-small text-muted-foreground">
                    {result.expectedDelivery.latest ? "Expected to reach you between" : "Expected to reach you by"}
                  </span>
                  <span className="text-title font-semibold">
                    {formatDateRange(result.expectedDelivery.earliest, result.expectedDelivery.latest)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    An estimate from our team, updated as the schedule firms up.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── The journey, in its major phases ────────────────────── */}
      <section
        aria-labelledby="journey-progress-heading"
        className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10 md:p-8"
      >
        <h3 id="journey-progress-heading" className="mb-6 text-h3">
          Your order&apos;s journey
        </h3>
        <ol aria-label="Order journey" className="flex flex-col md:flex-row">
          {journey.phases.map((phase, index) => (
            <PhaseStep key={phase.id} phase={phase} last={index === journey.phases.length - 1} />
          ))}
        </ol>
      </section>

      {/* ── What happens next ───────────────────────────────────── */}
      <section
        aria-labelledby="whats-next-heading"
        data-tone="dark"
        className="gold-ambient flex flex-col gap-5 overflow-hidden rounded-2xl bg-foreground p-6 text-background md:flex-row md:items-center md:justify-between md:p-8"
      >
        <div className="flex max-w-2xl flex-col gap-2">
          <span className="eyebrow text-gold">{finished ? "All done" : "What happens next"}</span>
          {finished ? (
            <>
              <h3 id="whats-next-heading" className="flex items-center gap-2 text-h3">
                <PartyPopper aria-hidden="true" className="size-5 text-gold" />
                Your order has reached you
              </h3>
              <p className="text-body text-background/70">
                Thank you for choosing us. If anything about your order needs our attention, we are a message away.
              </p>
            </>
          ) : (
            <>
              {currentStage.description ? (
                <p className="text-body text-background/70">{currentStage.description}</p>
              ) : null}
              <h3 id="whats-next-heading" className="flex items-center gap-2 text-h3">
                {next ? (
                  <>
                    Next: {next.title}
                    <ArrowRight aria-hidden="true" className="size-5 text-gold" />
                  </>
                ) : (
                  "Almost there"
                )}
              </h3>
              <p className="text-body text-background/70">
                {next
                  ? next.summary
                  : "This is the final stage. We will be in touch to arrange the handover."}{" "}
                We email you each time your order moves on.
              </p>
            </>
          )}
        </div>
        {supportAction ? <div className="shrink-0">{supportAction}</div> : null}
      </section>
    </article>
  )
}

function PhaseStep({ phase, last }: { phase: CustomerJourneyPhase; last: boolean }) {
  const Icon = JOURNEY_ICONS[phase.icon]

  return (
    <li
      aria-current={phase.state === "current" ? "step" : undefined}
      className="relative flex flex-1 gap-4 pb-7 last:pb-0 md:flex-col md:gap-3 md:pr-4 md:pb-0"
    >
      {/* The connecting line: down on a phone, across from `md`. Gold as far
          as the journey has gone. */}
      {!last ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-11 bottom-0 left-[21px] w-0.5 rounded-full md:top-[21px] md:right-0 md:bottom-auto md:left-11 md:h-0.5 md:w-auto",
            phase.state === "complete" ? "bg-gold" : "bg-border"
          )}
        />
      ) : null}

      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
          phase.state === "complete" && "bg-gold text-gold-foreground",
          phase.state === "current" && "bg-foreground text-gold ring-4 ring-gold/30",
          phase.state === "upcoming" && "bg-secondary text-muted-foreground ring-1 ring-border"
        )}
      >
        {phase.state === "complete" ? <Check className="size-5" strokeWidth={2.5} /> : <Icon className="size-5" strokeWidth={1.75} />}
      </span>

      <div className="flex min-w-0 flex-col gap-0.5 pt-1 md:pt-0">
        <p className={cn("text-body font-semibold", phase.state === "upcoming" && "text-muted-foreground")}>
          {phase.title}
          <span className="sr-only">
            {phase.state === "complete" ? " — completed" : phase.state === "current" ? " — current stage" : " — upcoming"}
          </span>
        </p>
        <p className="text-small text-muted-foreground">
          {phase.state === "current" ? (
            <span className="font-medium text-gold-ink">In progress{phase.date ? ` · ${formatCalendarDate(phase.date)}` : ""}</span>
          ) : phase.date ? (
            formatCalendarDate(phase.date)
          ) : phase.state === "complete" ? (
            "Completed"
          ) : (
            "Upcoming"
          )}
        </p>
      </div>
    </li>
  )
}
