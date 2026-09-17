import * as React from "react"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The strip at the top of a vehicle or part page that says whether customers
 * can see the listing, and offers the moves available from here.
 *
 * Only a published listing is visible on the website (see the public queries,
 * which pin the status), so "live" is a yes/no rather than a reading of each
 * status. The warnings a move would carry — no photographs, no price — sit
 * underneath, in the same panel as the button they are about.
 */
export function ListingStatusBar({
  badge,
  live,
  actions,
  children,
}: {
  badge: React.ReactNode
  live: boolean
  actions: React.ReactNode
  /** Result messages and warnings. */
  children?: React.ReactNode
}) {
  const hasMessages = React.Children.toArray(children).length > 0

  return (
    <section
      aria-labelledby="listing-status-heading"
      className="flex flex-col rounded-xl border border-border bg-card shadow-[var(--shadow-subtle)]"
    >
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="listing-status-heading" className="text-small font-medium text-muted-foreground">
            Listing status
          </h2>
          {badge}
          <span className="inline-flex items-center gap-2 text-small text-foreground">
            {/* Still, not pulsing: a light that blinks all day on a page an
                operator works in is noise, not status. */}
            <span
              aria-hidden="true"
              className={cn(
                "size-2 shrink-0 rounded-full",
                live ? "bg-success ring-4 ring-success/15" : "bg-muted-foreground/40 ring-4 ring-muted-foreground/10"
              )}
            />
            {live ? "Live on the website" : "Not visible on the website"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      {hasMessages ? (
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:px-6">{children}</div>
      ) : null}
    </section>
  )
}

/**
 * A listing's public address, for the page header. A link only while the
 * listing is live — any other status is a page the website will not serve, and
 * a link to a 404 reads as a fault.
 */
export function ListingWebAddress({ path, live }: { path: string; live: boolean }) {
  return live ? (
    <a
      href={path}
      target="_blank"
      rel="noopener noreferrer"
      className="group/web inline-flex items-center gap-1 font-mono text-xs text-muted-foreground underline-offset-4 transition-colors duration-fast hover:text-gold-ink hover:underline"
    >
      {path}
      <ArrowUpRight
        aria-hidden="true"
        className="size-3 transition-transform duration-fast group-hover/web:translate-x-px group-hover/web:-translate-y-px"
      />
      <span className="sr-only">(opens the live listing in a new tab)</span>
    </a>
  ) : (
    <span className="font-mono text-xs text-muted-foreground">{path}</span>
  )
}
