import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface ErrorStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  title?: React.ReactNode
  description?: React.ReactNode
  /** Retry control, or a route out. */
  action?: React.ReactNode
  /** Support reference (order number, tracking number, Sentry event id)
   *  shown in small mono-ish text so a customer can quote it to staff. */
  reference?: string
  size?: "default" | "compact"
}

/**
 * Shown when something actually failed — a query threw, a server action
 * rejected, a route errored.
 *
 * Deliberately never renders the raw error. Exception messages routinely
 * carry connection strings, SQL fragments and internal paths; the brief
 * (§17) requires that none of that reaches a customer. Log the real error
 * server-side, show a person something they can act on.
 */
function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this just now. Please try again in a moment.",
  action,
  reference,
  size = "default",
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 text-center",
        size === "default" ? "gap-4 px-6 py-16" : "gap-3 px-4 py-10",
        className
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive"
      >
        <TriangleAlertIcon className="size-5" />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="font-heading text-h3 text-foreground">{title}</p>
        <p className="mx-auto max-w-md text-small text-muted-foreground">{description}</p>
      </div>

      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}

      {reference && (
        <p className="tabular text-meta text-muted-foreground/80 uppercase">Ref {reference}</p>
      )}
    </div>
  )
}

export { ErrorState }
export type { ErrorStateProps }
