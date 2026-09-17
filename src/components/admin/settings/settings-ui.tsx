import type * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The building blocks every Settings section is laid out with.
 *
 * Server-safe (no hooks), so a page can compose read-only panels without
 * shipping them to the browser; the interactive pieces live in
 * settings-form-controls.tsx.
 *
 * ── Flat sections, not cards ──────────────────────────────────────────
 * A page of settings is one document divided by hairlines: a short heading,
 * one line of explanation, then the controls. No card chrome, no padded
 * header bar — every pixel of vertical space is either a control or the
 * sentence that explains it, which is what keeps a long section readable on
 * a phone. Sections carry an `id` so Settings search can land on them.
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
        "min-w-0 scroll-mt-24 border-t border-border pt-6 first:border-t-0 first:pt-0",
        className
      )}
    >
      {/* Wraps: a short control stays beside the title, a wide one drops below
          the description rather than squeezing it into a narrow column. */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
          <h2 id={id ? `${id}-title` : undefined} className="text-body font-semibold text-foreground">
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
  return <div className={cn("grid min-w-0 gap-4 sm:grid-cols-2", className)}>{children}</div>
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
      <div className="flex h-11 items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/50 px-3 text-small text-foreground">
        {icon}
        <span className="truncate">{value}</span>
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}

/**
 * The native `<select>` styled to sit beside `Input`.
 *
 * Native rather than the Base UI Select for form fields in Settings: it posts
 * with the form without extra wiring, and on a phone it opens the platform's
 * own picker, which is the better control for a country list.
 */
export const NATIVE_SELECT_CLASS = cn(
  "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base text-foreground md:text-sm",
  "transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30"
)
