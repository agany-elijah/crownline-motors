import Link from "next/link"

import { cn } from "@/lib/utils"
import {
  partCatalogueHref,
  type SparePartSearchCriteria,
} from "@/lib/validations/spare-part-search.schema"
import type { PublicSparePartCategory } from "@/lib/queries/public-spare-part.queries"

/**
 * The category rail — the parts section's own navigation.
 *
 * ── A row of words, not a row of buttons ──────────────────────────────
 * It used to be thirteen bordered pills, one of them filled solid black. At
 * a glance that read as thirteen calls to action stacked above the products,
 * and the filled chip competed with the gold add buttons in the grid below
 * for "the thing to press".
 *
 * What it is now is a navigation bar: plain labels at a consistent rhythm,
 * the current one marked by weight and a two-pixel rule beneath it. That is
 * how every large catalogue in this market — and every dealership site in
 * the brief's own reference set — writes a category row, and it is quieter,
 * denser and faster to read than a rail of boxes. Thirteen labels fit in the
 * space nine pills took.
 *
 * The rule under the active label is deliberately gold: this is one of the
 * few places gold earns its 10%, because it marks *where you are* rather
 * than decorating something. It is two pixels of it, not a filled shape.
 *
 * ── Where it sits ─────────────────────────────────────────────────────
 * Directly beneath the search band, inside the same sticky container (see
 * `SparePartsCatalogueBar`). Categories are how someone with a broken car
 * actually starts — "I need something in Brakes" — so this is primary
 * navigation, not a filter panel, and it stays reachable the whole way down
 * a twenty-four card grid.
 *
 * ── Links, not buttons, and no client JavaScript ──────────────────────
 * Each label is an `<a>` to the same catalogue with `?category=` applied, so
 * the selection is in the URL: it can be bookmarked, sent over WhatsApp, and
 * the back button moves between categories the way a customer expects. The
 * server renders the matching grid, which also means the rail works before —
 * or entirely without — the JavaScript bundle, on the 2G connections this
 * site is built for.
 *
 * ── "All parts" is a real entry, and it is the default ────────────────
 * The page opens with no category applied, and the All entry is what says so
 * rather than leaving the rail with nothing marked. It carries no `category`
 * parameter at all, so returning to it produces the canonical `/spare-parts`
 * address rather than `?category=`.
 *
 * ── No counts ─────────────────────────────────────────────────────────
 * They were there, and they made a clean rail read as a report. The count
 * still does real work — `listPublicSparePartCategories` uses it to drop
 * categories with nothing published, so no label can lead to an empty grid —
 * it simply is not something a customer needs printed beside every word.
 *
 * ── The search term survives a category change ────────────────────────
 * Every entry carries the current `q` through. Someone who searches "brake"
 * and then taps Suspension is narrowing, not starting again — dropping the
 * term there would silently widen the result set at the moment they thought
 * they had tightened it. The page resets to one, because staying on page
 * three of a result set that now has one page shows an empty grid that reads
 * as "your filter matched nothing".
 *
 * ── Why it scrolls rather than wraps ──────────────────────────────────
 * Thirteen categories wrap to two lines on a phone, which pushes the first
 * row of parts off the screen. A single scrolling row keeps the whole page
 * above the fold and is the gesture a phone user already makes. On a desktop,
 * where they all fit, the scroller simply never scrolls.
 */
interface SparePartCategoryRailProps {
  categories: PublicSparePartCategory[]
  criteria: SparePartSearchCriteria
  className?: string
}

export function SparePartCategoryRail({
  categories,
  criteria,
  className,
}: SparePartCategoryRailProps) {
  // With nothing published there is nothing to browse by, and a rail holding
  // only "All" is a control that cannot do anything.
  if (categories.length === 0) return null

  return (
    <nav aria-label="Part categories" className={cn("relative", className)}>
      {/*
        Full-bleed on purpose: the row scrolls, so its content has to be able
        to run to the edge of the screen rather than stopping at a container
        gutter with a label half-hidden behind it.

        `no-scrollbar` hides the bar without disabling the scrolling — the
        labels themselves are the affordance, and on a phone there is no bar
        to show anyway.
      */}
      <ul className="no-scrollbar -mx-4 flex snap-x items-stretch gap-5 overflow-x-auto px-4 sm:-mx-6 sm:gap-6 sm:px-6 lg:mx-0 lg:justify-center lg:px-0">
        <li className="snap-start">
          <CategoryLink
            href={partCatalogueHref({ q: criteria.q, category: undefined })}
            label="All parts"
            active={!criteria.category}
          />
        </li>

        {categories.map((category) => (
          <li key={category.slug} className="snap-start">
            <CategoryLink
              href={partCatalogueHref({ q: criteria.q, category: category.slug })}
              label={category.name}
              active={criteria.category === category.slug}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function CategoryLink({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      // The selection is conveyed to a screen reader by aria-current, not only
      // by the colour and the rule — this is a set of links where one is the
      // page you are on, which is exactly what `page` means.
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex items-center whitespace-nowrap",
        // The rule is drawn on the border rather than as a pseudo-element so
        // it participates in layout: every label reserves the two pixels,
        // and the row does not shift by that much when the selection moves.
        "border-b-2 py-2.5 text-small",
        "transition-colors duration-fast ease-crownline",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-gold font-semibold text-foreground"
          : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground"
      )}
    >
      {label}
    </Link>
  )
}
