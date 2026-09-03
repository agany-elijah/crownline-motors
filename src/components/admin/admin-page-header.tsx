import * as React from "react"

import { cn } from "@/lib/utils"

interface AdminPageHeaderProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  /** Right-aligned on desktop, stacked underneath on mobile. */
  actions?: React.ReactNode
}

/**
 * The masthead for a dashboard page.
 *
 * A separate component from the public `layout/page-header.tsx` rather than
 * a variant of it, because the two solve different problems. The public one
 * carries breadcrumbs and its own Container, sits on a marketing page, and
 * is tuned for a visitor orienting themselves. This one sits inside a shell
 * that already supplies width and padding, needs no breadcrumbs — the
 * sidebar shows where you are — and is tuned for an operator who works here
 * daily and wants the primary action within reach.
 *
 * Bending one component to serve both would mean a growing set of props
 * that each only apply to half its callers, which is how a shared component
 * becomes harder to use than two clear ones.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-6",
        "sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="font-heading text-h2 font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-body text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
