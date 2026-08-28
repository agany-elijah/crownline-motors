import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Indeterminate spinner.
 *
 * Drawn as a bordered circle with one transparent edge rather than an SVG
 * so it costs no markup weight and inherits `currentColor`. The animation
 * is CSS-only, so the global reduced-motion rule already stops it
 * spinning for users who ask for that.
 */
function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Centred block-level loading state for a whole panel or route.
 *
 * `aria-busy` plus a polite live region means a screen reader announces
 * that something is loading instead of landing in silence — a spinner
 * alone is invisible to assistive tech.
 */
function LoadingState({
  label = "Loading…",
  className,
  ...props
}: React.ComponentProps<"div"> & { label?: string }) {
  return (
    <div
      data-slot="loading-state"
      aria-busy="true"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16", className)}
      {...props}
    >
      <Spinner className="size-5 text-gold-ink" />
      <p className="text-small text-muted-foreground">{label}</p>
    </div>
  )
}

/**
 * Placeholder matching the shape of a vehicle card, for use as a Suspense
 * fallback in the catalogue grid.
 *
 * Skeletons are shaped like the content they stand in for — a 16:9 media
 * block, then a title, then a spec row, then a price — so the page does
 * not visibly reflow when real data lands. A generic grey box would
 * defeat most of the point.
 *
 * `aria-hidden` because the surrounding container owns the "loading"
 * announcement; without it a screen reader reads a meaningless run of
 * empty boxes.
 */
function CardSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-skeleton"
      aria-hidden="true"
      className={cn("flex flex-col gap-4 rounded-xl ring-1 ring-foreground/10", className)}
      {...props}
    >
      <Skeleton className="aspect-video w-full rounded-t-xl rounded-b-none" />
      <div className="flex flex-col gap-3 px-4 pb-5">
        <Skeleton className="h-5 w-3/5" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
        <Skeleton className="mt-1 h-6 w-1/3" />
      </div>
    </div>
  )
}

export { Spinner, LoadingState, CardSkeleton }
