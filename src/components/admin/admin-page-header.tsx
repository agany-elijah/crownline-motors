import * as React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"

interface AdminPageHeaderProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  /** Right-aligned on desktop, stacked underneath on mobile. */
  actions?: React.ReactNode
  /** A quiet row under the title — reference numbers, status, dates. */
  meta?: React.ReactNode
  /** The list this record belongs to, e.g. `{ href: …/orders, label: "All orders" }`. */
  back?: { href: string; label: string }
}

/**
 * The masthead for a dashboard page.
 *
 * A separate component from the public `layout/page-header.tsx` rather than
 * a variant of it, because the two solve different problems. The public one
 * carries breadcrumbs and its own Container, sits on a marketing page, and
 * is tuned for a visitor orienting themselves. This one sits inside a shell
 * that already supplies width, padding and a breadcrumb trail, and is tuned
 * for an operator who works here daily and wants the primary action within
 * reach.
 *
 * Title, then a single line of context, then the facts that identify the
 * record (`meta`) — set apart by type rather than by boxes, so a detail page
 * opens on the record itself and not on chrome.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  meta,
  back,
  className,
  ...props
}: AdminPageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      {back ? <AdminBackLink href={back.href}>{back.label}</AdminBackLink> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-h2 text-balance text-foreground">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-body text-muted-foreground">{description}</p>
          ) : null}
          {meta ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-muted-foreground">
              {meta}
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  )
}

/** The way back from a record to its list. */
export function AdminBackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "group/back inline-flex w-fit items-center gap-1.5 rounded-sm text-small font-medium text-muted-foreground",
        "transition-colors duration-fast hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      )}
    >
      <ArrowLeft
        aria-hidden="true"
        className="size-3.5 transition-transform duration-fast ease-crownline group-hover/back:-translate-x-0.5"
      />
      {children}
    </Link>
  )
}

/**
 * A small separator for `meta` rows. Hidden from assistive technology — each
 * item is already its own piece of text.
 */
export function AdminMetaDivider() {
  return <span aria-hidden="true" className="h-3.5 w-px bg-border" />
}
