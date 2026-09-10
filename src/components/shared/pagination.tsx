import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { paginationRange } from "@/lib/utils/pagination"

/**
 * A numbered pager built from real links.
 *
 * ── Why links and not buttons ─────────────────────────────────────────
 * Every page of a list is an address. Rendering the pager as anchors means
 * it works with JavaScript unavailable, a page can be opened in a new tab,
 * and a search engine can crawl past page one to the vehicles on page
 * three — which is the difference between the deep listings being indexed
 * and being invisible.
 *
 * ── Why the numbers hide on the narrowest screens ─────────────────────
 * Six numbered targets plus Previous and Next do not fit across a 360px
 * phone without shrinking below a comfortable tap size. Below `sm` the
 * numbers give way to "Page 2 of 7" and the two step controls, which is
 * the whole of what is usable there anyway. The information is never lost,
 * only its form changes.
 *
 * The caller supplies `hrefFor` rather than a base path, so the same
 * component serves the public catalogue (whose links must carry the
 * customer's filters) and any admin list (whose links must carry its own
 * query string) without either one leaking its URL rules into here.
 */
interface PaginationProps {
  page: number
  pageCount: number
  hrefFor: (page: number) => string
  /** Names what is being paged, for the landmark: "Catalogue pages". */
  label: string
  className?: string
}

export function Pagination({
  page,
  pageCount,
  hrefFor,
  label,
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null

  const current = Math.min(Math.max(1, page), pageCount)
  const range = paginationRange(current, pageCount)

  return (
    <nav
      aria-label={label}
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border pt-6",
        className
      )}
    >
      <div className="flex flex-1 justify-start">
        {current > 1 ? (
          <Button
            render={<Link href={hrefFor(current - 1)} rel="prev" />}
            variant="outline"
            size="sm"
          >
            Previous
          </Button>
        ) : null}
      </div>

      {/* The compact form, below `sm` only. */}
      <p className="tabular text-small text-muted-foreground sm:hidden">
        Page {current} of {pageCount}
      </p>

      <ol className="hidden items-center gap-1 sm:flex">
        {range.map((value, index) =>
          value === null ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="px-1 text-small text-muted-foreground"
            >
              &hellip;
            </li>
          ) : (
            <li key={value}>
              <Link
                href={hrefFor(value)}
                // The only cue a screen reader gets that this is the page
                // being read; the visual treatment is unavailable to it.
                aria-current={value === current ? "page" : undefined}
                aria-label={`Page ${value}`}
                className={cn(
                  "tabular flex size-9 items-center justify-center rounded-md text-small",
                  "transition-colors duration-fast",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  value === current
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {value}
              </Link>
            </li>
          )
        )}
      </ol>

      <div className="flex flex-1 justify-end">
        {current < pageCount ? (
          <Button
            render={<Link href={hrefFor(current + 1)} rel="next" />}
            variant="outline"
            size="sm"
          >
            Next
          </Button>
        ) : null}
      </div>
    </nav>
  )
}
