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
 * Every tone pairs a background with a border and a text weight, so the
 * badges remain distinguishable from one another in a monochrome print or
 * to a viewer who cannot separate the hues — the label itself always
 * carries the actual meaning.
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-border bg-secondary text-muted-foreground",
  positive: "border-success/35 bg-success/10 text-success",
  warning: "border-warning/35 bg-warning/10 text-warning",
  critical: "border-destructive/35 bg-destructive/10 text-destructive",
  // Full-strength ink, not a faded copy of it. Diluting the text colour
  // with an alpha was what made "Archived" and "Sold" unreadable at 3.8:1
  // — a badge is de-emphasised by having no fill, never by being greyed
  // towards its background.
  muted: "border-border bg-transparent text-muted-foreground",
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
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5",
        "text-xs font-semibold whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
