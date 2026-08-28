import * as React from "react"

import { cn } from "@/lib/utils"
import { Container } from "@/components/layout/container"
import { Breadcrumbs, type BreadcrumbTrailItem } from "@/components/layout/breadcrumbs"

interface PageHeaderProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Small uppercase label above the title — the section the page belongs
   *  to ("Inventory", "Support"). Optional; skip it rather than inventing
   *  one, since a meaningless eyebrow is worse than none. */
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Breadcrumb trail excluding Home. Omit on top-level pages, where a
   *  two-item "Home / Cars" trail adds noise without adding orientation. */
  breadcrumbs?: BreadcrumbTrailItem[]
  /** Right-aligned actions on desktop, stacked underneath on mobile. */
  actions?: React.ReactNode
}

/**
 * The standard masthead for every inner page.
 *
 * Exists so that Cars, How It Works, Track My Order, Contact and the rest
 * share one entry rhythm — same breadcrumb placement, same title step,
 * same spacing — instead of each page inventing its own. That consistency
 * is most of what separates a designed site from a set of pages.
 *
 * Sits on the light surface with a hairline rule beneath rather than a
 * heavy dark band: the brief reserves large dark blocks for the homepage
 * hero and footer, and repeating one at the top of every page would spend
 * the site's 25% dark budget on chrome.
 */
function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn("border-b border-border bg-background", className)}
      {...props}
    >
      <Container className="flex flex-col gap-6 py-10 md:py-14">
        {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
          <div className="flex flex-col gap-3">
            {eyebrow && <span className="eyebrow text-gold-ink">{eyebrow}</span>}
            <h1 className="text-h1 max-w-3xl">{title}</h1>
            {description && (
              <p className="max-w-2xl text-body-lg text-muted-foreground">{description}</p>
            )}
          </div>

          {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
        </div>
      </Container>
    </div>
  )
}

export { PageHeader }
export type { PageHeaderProps }
