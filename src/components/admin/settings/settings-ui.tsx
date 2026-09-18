import type * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The building blocks every Settings section is laid out with.
 *
 * Server-safe (no hooks), so a page can compose read-only panels without
 * shipping them to the browser; the interactive pieces live in
 * settings-form-controls.tsx.
 *
 * ── One sheet per section ─────────────────────────────────────────────
 * Each section is a bordered sheet: a short heading, one line of explanation,
 * then the controls — the same panel every other dashboard page is built
 * from, so Settings reads as part of the product rather than a document
 * pasted into it. The header is part of the sheet, not a tinted bar, and the
 * padding steps down on a phone so a long section stays readable there.
 * Sections carry an `id` so Settings search can land on them.
 */

export function SettingsPanel({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** Right-aligned beside the title — a small secondary control. */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      data-settings-section=""
      className={cn(
        "min-w-0 scroll-mt-24 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-subtle)] sm:p-6",
        className
      )}
    >
      {/* Wraps: a short control stays beside the title, a wide one drops below
          the description rather than squeezing it into a narrow column. */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1">
          <h2 id={id ? `${id}-title` : undefined} className="text-h3 text-foreground">
            {title}
          </h2>
          {description ? <p className="max-w-2xl text-small text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  )
}

export function SettingsField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode
  htmlFor: string
  hint?: React.ReactNode
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div data-settings-field="" className={cn("flex min-w-0 scroll-mt-28 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-small font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Two columns from `sm`, one below. */
export function SettingsFieldGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 min-w-0 gap-4 sm:grid-cols-2", className)}>{children}</div>
}

/** A read-only value with an explanation, for things Settings shows but does not change. */
export function SettingsReadOnlyValue({
  label,
  value,
  note,
  icon,
}: {
  label: string
  value: React.ReactNode
  note?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-small font-medium text-foreground">{label}</span>
      <div className="flex h-(--control-height) items-center gap-2 rounded-lg border border-dashed border-border bg-sunken/70 px-3 text-small text-foreground">
        {icon}
        <span className="truncate">{value}</span>
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}

/**
 * The native `<select>` styled to sit beside `Input`, for every dashboard form
 * and filter that uses one.
 *
 * Native rather than the Base UI Select for form fields in Settings: it posts
 * with the form without extra wiring, and on a phone it opens the platform's
 * own picker, which is the better control for a country list.
 */
export const NATIVE_SELECT_CLASS = cn(
  "h-(--control-height) w-full min-w-0 cursor-pointer rounded-lg border border-input bg-card pr-9 pl-3 text-base text-foreground md:text-sm",
  // The platform arrow is replaced with the dashboard's own chevron, so a
  // select sits beside an Input as the same kind of control.
  "appearance-none bg-(image:--select-chevron) bg-size-[1rem] bg-position-[right_0.75rem_center] bg-no-repeat",
  "hover:border-foreground/25",
  "transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-sunken"
)
