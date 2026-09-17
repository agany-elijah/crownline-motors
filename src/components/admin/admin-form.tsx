import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * One group of a long dashboard form: what the group is, beside the fields.
 *
 * From `lg` the title and its one sentence sit in a narrow column to the left
 * and the fields in a panel to the right, so an operator scanning a seventeen-
 * field form reads a column of headings rather than hunting for them between
 * inputs. Below `lg` the heading simply sits above its panel.
 *
 * `internal` marks a group no customer will ever see — a dashed edge and a
 * recessed surface, so "is this public?" is answered before a word is read.
 */
export function AdminFormSection({
  id,
  title,
  description,
  badge,
  variant = "default",
  children,
  className,
  bodyClassName,
}: {
  id?: string
  title: React.ReactNode
  description?: React.ReactNode
  /** A small status beside the title — "Shown on the website", "3 hidden". */
  badge?: React.ReactNode
  variant?: "default" | "internal"
  children: React.ReactNode
  className?: string
  /** Layout of the panel's contents. Defaults to a single column. */
  bodyClassName?: string
}) {
  const headingId = id ? `${id}-heading` : undefined

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "grid min-w-0 scroll-mt-24 gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-10",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-2 lg:pt-1">
        <h2 id={headingId} className="text-h3 text-foreground">
          {title}
        </h2>
        {badge ? <div className="flex flex-wrap items-center gap-2">{badge}</div> : null}
        {description ? <p className="text-small text-muted-foreground">{description}</p> : null}
      </div>

      <div
        className={cn(
          "min-w-0 rounded-xl border p-5 sm:p-6",
          variant === "internal"
            ? "border-dashed border-border bg-sunken/70"
            : "border-border bg-card shadow-[var(--shadow-subtle)]",
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  )
}

/**
 * A small fact beside a form section's title.
 */
export function AdminFormBadge({
  icon,
  tone = "neutral",
  children,
}: {
  icon?: React.ReactNode
  tone?: "neutral" | "gold" | "warning"
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium [&_svg]:size-3.5",
        tone === "gold" && "border-gold-ink/25 bg-accent text-gold-ink",
        tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
        tone === "neutral" && "border-border bg-secondary text-muted-foreground"
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/**
 * The save bar pinned to the bottom of the viewport while any part of its form
 * is on screen.
 *
 * `sticky` rather than `fixed`: it stays the form's last child, still submits
 * natively, and comes to rest at the form's own end instead of floating over
 * whatever follows it on the page. The negative margins take it to the edges
 * of the dashboard's content column, matching the shell's own padding.
 */
export function AdminFormActionBar({
  children,
  hint,
}: {
  children: React.ReactNode
  /** A quiet line on the left — what saving will do. */
  hint?: React.ReactNode
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-2 border-t border-border bg-background/85 px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-background/75 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {hint ? <p className="text-small text-muted-foreground">{hint}</p> : <span aria-hidden="true" />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">{children}</div>
      </div>
    </div>
  )
}

/**
 * Where a multi-step job stands: "Enter the details → Add photographs →
 * Publish". An ordered list, so the sequence is in the markup and not only in
 * the connecting rules; the current step is announced with `aria-current`.
 *
 * Wayfinding an operator needs once and then glances past, so it is one quiet
 * line rather than a row of cards.
 */
export function AdminStepTrail({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-small">
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "upcoming"

        return (
          <li key={step} className="flex items-center gap-3">
            {index > 0 ? <span aria-hidden="true" className="hidden h-px w-6 bg-border sm:block" /> : null}
            <span aria-current={state === "current" ? "step" : undefined} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] tabular-nums",
                  state === "current" && "bg-foreground text-background ring-2 ring-gold/60 ring-offset-2 ring-offset-background",
                  state === "done" && "bg-gold text-gold-foreground",
                  state === "upcoming" && "border border-border bg-card text-muted-foreground"
                )}
              >
                {index + 1}
              </span>
              <span className={state === "upcoming" ? "text-muted-foreground" : "font-medium text-foreground"}>
                {step}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
