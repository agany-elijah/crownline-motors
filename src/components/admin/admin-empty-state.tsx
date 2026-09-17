import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * What a list shows when it has nothing to list.
 *
 * Required wherever a list can be empty, because a table with a header row and
 * no body is the most common way an admin screen leaves someone unsure whether
 * it is broken. Say which kind of empty it is — nothing yet, or nothing
 * matching — and offer the one action that fits.
 */
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-5 rounded-xl border border-dashed border-border bg-card/60 px-6 py-14 text-center sm:py-16",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="relative flex size-12 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-[var(--shadow-subtle)]"
      >
        <Icon className="size-5" strokeWidth={1.75} />
        <span className="absolute -bottom-px left-1/2 h-px w-5 -translate-x-1/2 bg-gold" />
      </span>

      <div className="flex max-w-sm flex-col gap-1.5">
        <h2 className="text-h3 text-foreground">{title}</h2>
        {description ? <p className="text-small text-muted-foreground">{description}</p> : null}
      </div>

      {action ? <div className="flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  )
}
