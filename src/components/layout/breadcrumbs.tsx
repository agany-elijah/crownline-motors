import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { siteConfig } from "@/config/site"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface BreadcrumbTrailItem {
  label: string
  /** Omit on the final item — the current page is not a link. */
  href?: string
}

interface BreadcrumbsProps extends React.ComponentProps<"nav"> {
  /** Trail *excluding* Home, which is prepended automatically so no caller
   *  has to remember it and every trail starts the same way. */
  items: BreadcrumbTrailItem[]
}

/**
 * Data-driven breadcrumb trail.
 *
 * Takes an array rather than composed children so that every trail on the
 * site shares one structure — including the JSON-LD below, which would
 * otherwise have to be hand-maintained alongside the visible markup and
 * would inevitably drift out of sync with it.
 *
 * Emits BreadcrumbList structured data (brief §18): it is what produces
 * the breadcrumb trail shown under a Google result instead of a bare URL,
 * which matters for the deep vehicle and spare-part pages the site is
 * meant to rank with.
 */
function Breadcrumbs({ items, className, ...props }: BreadcrumbsProps) {
  const trail: BreadcrumbTrailItem[] = [{ label: "Home", href: "/" }, ...items]

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      // Absolute URLs — search engines will not resolve relative ones here.
      ...(item.href ? { item: `${siteConfig.url}${item.href}` } : {}),
    })),
  }

  return (
    <>
      <Breadcrumb className={cn("text-small", className)} {...props}>
        <BreadcrumbList>
          {trail.map((item, index) => {
            const isLast = index === trail.length - 1

            return (
              <React.Fragment key={`${item.label}-${index}`}>
                <BreadcrumbItem>
                  {isLast || !item.href ? (
                    <BreadcrumbPage className="text-foreground">{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      render={<Link href={item.href} />}
                      className="hover:text-gold-ink"
                    >
                      {item.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Safe to inject: every value is site-authored (route labels), never
          user input, and JSON.stringify escapes the payload. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  )
}

export { Breadcrumbs }
export type { BreadcrumbsProps, BreadcrumbTrailItem }
