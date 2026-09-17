import * as React from "react"

import { cn } from "@/lib/utils"

export type StatusTone = "neutral" | "positive" | "warning" | "critical" | "muted"

interface StatusBadgeProps extends React.ComponentProps<"span"> {
  tone?: StatusTone
}

/**
 * A small state label — vehicle status, payment status, shipment stage.
 *
 * Tone is separate from the brand accent on purpose. Gold means "Crownline"
 * throughout this application; if it also meant "published", an operator
 * scanning a list would have to work out which sense applied each time. The
 * palette here is semantic and used nowhere else.
 *
 * Every tone pairs a background with a border and a dot, so the badges
 * remain distinguishable from one another in a monochrome print or to a
 * viewer who cannot separate the hues — the label itself always carries the
 * actual meaning.
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  positive: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  // Full-strength ink, not a faded copy of it. Diluting the text colour
  // with an alpha was what made "Archived" and "Sold" unreadable at 3.8:1
  // — a badge is de-emphasised by having no fill, never by being greyed
  // towards its background.
  muted: "border-border bg-transparent text-muted-foreground",
}

/** The dot's colour. Neutral and muted take a grey, never the brand gold. */
const DOT_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/70",
  positive: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
  muted: "bg-muted-foreground/45",
}

export function StatusBadge({
  tone = "neutral",
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      data-slot="status-badge"
      data-tone-status={tone}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border pr-2.5 pl-2",
        "text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])} />
      {children}
    </span>
  )
}
