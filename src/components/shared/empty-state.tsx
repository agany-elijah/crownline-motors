import * as React from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Lucide icon (or any node) shown above the title. Kept optional —
   *  a bare, well-spaced message often reads calmer than a decorated one. */
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary way out of the empty state — "Browse all vehicles",
   *  "Clear filters", "Request a vehicle". An empty state without an
   *  action is a dead end, so pass one wherever a next step exists. */
  action?: React.ReactNode
  size?: "default" | "compact"
}

/**
 * Shown when a query legitimately returned nothing — no vehicles match the
 * filters, no quotes yet, no tracking events recorded.
 *
 * Distinct from ErrorState on purpose: nothing has gone wrong here, so the
 * tone stays neutral and the styling stays quiet. Using an alarm-coloured
 * treatment for "no results" trains people to ignore real errors.
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  size = "default",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 text-center",
        size === "default" ? "gap-4 px-6 py-16" : "gap-3 px-4 py-10",
        className
      )}
      {...props}
    >
      {icon && (
        <div
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5"
        >
          {icon}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="font-heading text-h3 text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-md text-small text-muted-foreground">{description}</p>
        )}
      </div>

      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
