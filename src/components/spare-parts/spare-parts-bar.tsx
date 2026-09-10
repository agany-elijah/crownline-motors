import * as React from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { Container } from "@/components/layout/container"
import { cn } from "@/lib/utils"

/**
 * The one utility row at the top of every spare-parts page.
 *
 * ── What it replaced, and why ─────────────────────────────────────────
 * A centred "Home › Spare Parts" trail sitting above a centred headline and a
 * line of positioning copy. Three centred bands before the first product, on
 * a page whose entire job is to get a customer to the grid — on a 390px phone
 * that was most of the first screen spent on things nobody came for.
 *
 * What is left is the one control that still does work here: the way back,
 * with the page's name beside it.
 *
 *     ┌────────────────────────────────────────────────────┐
 *     │ ← Home │ Spare Parts                               │
 *     └────────────────────────────────────────────────────┘
 *
 * ── The basket used to be on this row, and has moved ──────────────────
 * It now lives in the site header, top right, beside the menu — where every
 * shop a customer has ever used puts it, and where it stays visible on every
 * page rather than only inside this section. `CartSummary` renders nothing
 * until the basket holds something, so a visitor who is not shopping for
 * parts never sees a cart icon on a page about cars.
 *
 * Keeping a second one here would have been two basket controls on the same
 * screen showing the same number, which is one more than any of them needs.
 *
 * ── The trail is gone from the screen, not from the page ──────────────
 * Search engines still receive the BreadcrumbList: the catalogue and the part
 * page emit it as JSON-LD via `Breadcrumbs`, rendered with the visible nav
 * suppressed. Losing the SEO along with the visual clutter would have been a
 * silent cost.
 */
interface SparePartsBarProps {
  /** Where "back" goes. `/` on the catalogue, `/spare-parts` on a part. */
  backHref: string
  /** The full phrase, e.g. "Home" or "Back to spare parts". */
  backLabel: string
  /**
   * Rendered as the page's `h1` when given — the catalogue's case, where the
   * page has no other title. Omitted on a part page, whose `h1` is the part's
   * own name further down.
   */
  title?: string
  className?: string
}

export function SparePartsBar({
  backHref,
  backLabel,
  title,
  className,
}: SparePartsBarProps) {
  return (
    <div className={cn("border-b border-border bg-background", className)}>
      <Container>
        <div className="flex h-14 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/*
              A link rather than `history.back()`: it is a real destination
              that works on a page opened from a search result or a WhatsApp
              message, where there is no history to go back through.
            */}
            <Link
              href={backHref}
              className={cn(
                "group/back inline-flex shrink-0 items-center gap-1.5",
                "text-small font-medium text-muted-foreground",
                "transition-colors duration-fast ease-crownline hover:text-foreground",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              )}
            >
              <ArrowLeftIcon
                aria-hidden="true"
                className="size-4 transition-transform duration-fast ease-crownline group-hover/back:-translate-x-0.5"
              />
              {backLabel}
            </Link>

            {title ? (
              <>
                {/* Decorative, so it is hidden from assistive technology —
                    the heading below already separates the two. */}
                <span
                  aria-hidden="true"
                  className="h-4 w-px shrink-0 bg-border"
                />
                <h1 className="truncate text-title">{title}</h1>
              </>
            ) : null}
          </div>
        </div>
      </Container>
    </div>
  )
}
