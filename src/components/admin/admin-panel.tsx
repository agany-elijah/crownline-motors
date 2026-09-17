import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The dashboard's one surface for grouped content.
 *
 * Every detail page used to carry its own copy of the panel classes; this is
 * that recipe, once. A panel is a hairline-bordered sheet a step brighter than
 * the canvas. Its header, when it has one, is part of the sheet rather than a
 * tinted bar — the title and the controls beside it are what separate it from
 * the body, not a background.
 *
 * `flush` removes the body padding for content that brings its own edges — a
 * table or a divided list that should run to the panel's border.
 */
export function AdminPanel({
  title,
  description,
  actions,
  children,
  footer,
  flush = false,
  id,
  className,
  bodyClassName,
  as: Component = "section",
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  /** Right-aligned beside the title. */
  actions?: React.ReactNode
  children: React.ReactNode
  /** A closing band — a total, a secondary action. */
  footer?: React.ReactNode
  flush?: boolean
  id?: string
  className?: string
  bodyClassName?: string
  as?: "section" | "div" | "aside"
}) {
  const headingId = id && title ? `${id}-heading` : undefined

  return (
    <Component
      id={id}
      aria-labelledby={Component === "section" ? headingId : undefined}
      data-slot="admin-panel"
      className={cn(
        "flex min-w-0 scroll-mt-24 flex-col rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-subtle)]",
        className
      )}
    >
      {title || actions ? (
        <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title ? (
              <h2 id={headingId} className="text-h3 text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? <p className="max-w-2xl text-small text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="-mt-1 -mr-2 flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-4",
          flush ? (title || actions ? "pt-4" : "") : cn("px-5 pb-5 sm:px-6 sm:pb-6", title || actions ? "pt-4" : "pt-5 sm:pt-6"),
          bodyClassName
        )}
      >
        {children}
      </div>

      {footer ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-border bg-sunken/60 px-5 py-3.5 sm:px-6">
          {footer}
        </footer>
      ) : null}
    </Component>
  )
}

/**
 * One figure, with what it is and — optionally — what it is made of.
 *
 * The number is set large, with lining figures, so a row of these
 * reads like an instrument cluster: the label tells you which gauge, the
 * figure is what you came for.
 */
export function AdminStat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  /** `attention` draws the figure in gold, for the one number that wants acting on. */
  tone?: "default" | "attention"
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <span className="flex items-center gap-2 text-small text-muted-foreground">
        {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} /> : null}
        {label}
      </span>
      <span
        className={cn(
          "text-[1.75rem] leading-none font-semibold tracking-[-0.03em] tabular-nums",
          tone === "attention" ? "text-gold-ink" : "text-foreground"
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

/**
 * A label and its value, for the definition lists on detail pages.
 */
export function AdminField({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-small break-words text-foreground">{children}</dd>
    </div>
  )
}
