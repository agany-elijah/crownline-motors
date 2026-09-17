import type { ReactNode } from "react"
import { FileText, PackageCheck, Send } from "lucide-react"

import type { QuoteDispatchChannel } from "@/generated/prisma/enums"
import { QUOTE_CHANNEL_LABELS } from "@/lib/constants/quote-status"

interface ActivityEvent {
  icon: ReactNode
  label: string
  detail?: string
  date: Date
}

interface QuoteActivityTimelineProps {
  createdAt: Date
  sentAt: Date | null
  lastSentVia: QuoteDispatchChannel | null
  order: { orderNumber: string; createdAt: Date } | null
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })

/**
 * A short, honest history of this quote — only events the schema actually
 * records a timestamp for. No fabricated "status changed" entries: `Quote`
 * has no per-transition audit trail of its own to draw one from (that lives
 * in `AuditLog`, which this screen does not query), so the timeline shows
 * exactly what it can stand behind.
 */
export function QuoteActivityTimeline({ createdAt, sentAt, lastSentVia, order }: QuoteActivityTimelineProps) {
  const events: ActivityEvent[] = [
    { icon: <FileText aria-hidden="true" />, label: "Quote received", date: createdAt },
  ]

  if (sentAt) {
    events.push({
      icon: <Send aria-hidden="true" />,
      label: "Quotation sent",
      detail: lastSentVia ? QUOTE_CHANNEL_LABELS[lastSentVia] : undefined,
      date: sentAt,
    })
  }

  if (order) {
    events.push({
      icon: <PackageCheck aria-hidden="true" />,
      label: `Order ${order.orderNumber} created`,
      date: order.createdAt,
    })
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime())

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-subtle)]">
      <h2 className="text-small font-medium text-foreground">Activity</h2>

      <ol className="flex flex-col">
        {events.map((event, index) => (
          <li key={index} className="relative flex gap-3 pb-4 last:pb-0">
            {/* The thread between events, stopping at the last one. */}
            {index < events.length - 1 ? (
              <span aria-hidden="true" className="absolute top-7 bottom-0 left-3 w-px -translate-x-1/2 bg-border" />
            ) : null}
            <span
              className={
                index === events.length - 1
                  ? "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-gold-ink/30 bg-accent text-gold-ink [&_svg]:size-3.5"
                  : "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground [&_svg]:size-3.5"
              }
            >
              {event.icon}
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-small font-medium">
                {event.label}
                {event.detail ? <span className="text-muted-foreground"> · {event.detail}</span> : null}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">{DATE_FORMAT.format(event.date)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
