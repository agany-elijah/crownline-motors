"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { Container } from "@/components/layout/container"
import { SparePartCategoryRail } from "@/components/spare-parts/spare-part-category-rail"
import { SparePartSearch } from "@/components/spare-parts/spare-part-search"
import { cn } from "@/lib/utils"
import type { PublicSparePartCategory } from "@/lib/queries/public-spare-part.queries"
import type { SparePartSearchCriteria } from "@/lib/validations/spare-part-search.schema"

/**
 * The catalogue's own toolbar: search and categories, in one sticky band.
 *
 * ── Why the two are one thing ─────────────────────────────────────────
 * They are the two ways into the same result set — "I know the number" and "I
 * know roughly what area it is in" — and they used to be in two different
 * places: the rail pinned under the header, the search box in a bordered block
 * halfway down the page. So the search scrolled away while the categories
 * stayed, and a customer at the bottom of a twenty-four card page could change
 * category but not the term.
 *
 * ── Two layouts, one of everything ────────────────────────────────────
 *
 *   from `sm`        the pill runs across the top, categories beneath it
 *
 *   below `sm`       ┌──────────────────────────────────┐
 *                    │ All parts  Brakes  Engine …  (🔍)│
 *                    └──────────────────────────────────┘
 *                    the categories take the row, with the magnifier
 *                    pinned at its end; pressing it slides the pill over
 *                    the row
 *
 * A phone has one row of space here, and giving a permanent full-width field
 * the whole of it pushed the categories — the thing someone with a broken car
 * actually browses by — off the first screen. Collapsed to a glyph, the search
 * costs 36px and stays reachable the entire way down the grid, because the
 * band it lives in is sticky.
 *
 * ── The search field is rendered exactly once ─────────────────────────
 * Not once for mobile and once for desktop. Two copies would mean two inputs
 * named `q` in the DOM sharing one accessible name, which is a real
 * navigation defect for a screen-reader user and doubles the markup on the
 * connection least able to afford it. The single instance is positioned
 * differently at the two sizes: static in the flow from `sm`, absolutely
 * placed over the category row when it is open on a phone.
 *
 * The same applies to the rail, which is why the toggle sits *inside* the
 * category row rather than the row being duplicated to make space for it.
 *
 * ── Why this is a Client Component when it used to be a Server one ────
 * The collapse is state. It is a thin one — a boolean, a toggle and an Escape
 * handler — and the rail beneath it still ships no JavaScript of its own,
 * because it is plain links rendered as children.
 */
interface SparePartsCatalogueBarProps {
  categories: PublicSparePartCategory[]
  criteria: SparePartSearchCriteria
  /**
   * Whether to render the search at all.
   *
   * False when the catalogue is genuinely empty *and* nothing was searched
   * for: a search box above an empty grid looks broken rather than new. The
   * caller decides, because it is the only one that knows the difference
   * between "no parts listed" and "no parts matched".
   */
  showSearch: boolean
  className?: string
}

export function SparePartsCatalogueBar({
  categories,
  criteria,
  showSearch,
  className,
}: SparePartsCatalogueBarProps) {
  /**
   * Only meaningful below `sm`. From there up the field is always in the flow
   * and this is ignored.
   *
   * ── Why it does *not* open itself when a search is applied ────────────
   * It did, on the reasoning that arriving at `/spare-parts?q=brake` with the
   * box collapsed hides the thing that produced the results on screen. But on
   * a phone the open field takes the row the categories live on — so
   * auto-opening left a customer who had searched unable to reach a single
   * category until they worked out to close a box they had never opened.
   * Narrowing by category is the more common of the two gestures, so it wins
   * the row by default.
   *
   * The applied term is not hidden, it is just not given a whole row: the
   * toggle wears a gold dot while a search is in effect, and pressing it
   * opens the field with that term in it.
   */
  const [mobileOpen, setMobileOpen] = React.useState(false)

  /** Whether a search is currently narrowing the grid. Marks the toggle. */
  const hasQuery = (criteria.q ?? "").length > 0

  React.useEffect(() => {
    if (!mobileOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false)
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [mobileOpen])

  // Nothing to search and nothing to browse by. Rendering an empty sticky band
  // would leave a stripe pinned under the header doing no work.
  if (!showSearch && categories.length === 0) return null

  return (
    <div
      className={cn(
        // `top-16 / md:top-20` is exactly the site header's own height, so the
        // two bands meet with no seam and neither is ever hidden behind the
        // other. `z-30` sits below the header's `z-40` and above the page.
        "sticky top-16 z-30 border-b border-border md:top-20",
        // Translucent over the grid scrolling under it, matching the header's
        // treatment so the two read as one surface. The fallback colour is
        // opaque, so a browser without `backdrop-filter` gets a legible bar
        // rather than product photographs behind category labels.
        "bg-background/90 backdrop-blur-xl backdrop-saturate-150",
        className
      )}
    >
      <Container>
        <div className="flex flex-col gap-1 py-2.5 sm:gap-1.5 sm:py-3">
          {showSearch ? (
            <div
              // The target of the toggle's `aria-controls`, so the
              // relationship it announces actually resolves to an element.
              id="spare-part-search-field"
              className={cn(
                // From `sm`: always in the flow, centred, capped. A field
                // running the container's whole 80rem reads as a form; capped
                // at `2xl` it reads as a search bar.
                "sm:flex sm:justify-center",
                mobileOpen
                  ? // On a phone it *takes* the row rather than floating over
                    // it. An earlier version was absolutely positioned on top
                    // of the category rail, which looked identical and made
                    // every category link untappable while the search was
                    // open — including on arrival at `?q=…`, where the box
                    // opens itself. A control that silently swallows presses
                    // meant for the links underneath is worse than one that
                    // moves them.
                    //
                    // Both states are a single row, so nothing below shifts.
                    "flex items-center gap-2"
                  : "hidden sm:flex"
              )}
            >
              <SparePartSearch
                criteria={criteria}
                className="max-w-2xl"
                // Only on the deliberate mobile open — never on a desktop
                // page load, where it would steal focus on every navigation.
                autoFocus={mobileOpen}
              />

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close search"
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-full sm:hidden",
                  "text-muted-foreground transition-colors duration-fast",
                  "hover:bg-secondary hover:text-foreground",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                )}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          ) : null}

          {/* Stood down below `sm` while the search has the row. Hidden
              rather than unmounted, so the rail is still one instance in the
              tree and the desktop layout is untouched. */}
          <div
            className={cn(
              "flex items-center gap-2",
              mobileOpen && "max-sm:hidden"
            )}
          >
            <SparePartCategoryRail
              categories={categories}
              criteria={criteria}
              className="min-w-0 flex-1"
            />

            {showSearch ? (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                // `expanded`/`controls` so a screen-reader user is told this
                // reveals something and where it lands, rather than being
                // handed an unexplained magnifier.
                aria-expanded={mobileOpen}
                aria-controls="spare-part-search-field"
                /**
                 * The state is in the name, not only in the dot. A
                 * screen-reader user gets no benefit from a gold ring, and
                 * "a search is currently applied" is exactly the thing they
                 * would otherwise have to infer from the result count.
                 */
                aria-label={
                  hasQuery
                    ? `Edit search: ${criteria.q}`
                    : "Search spare parts"
                }
                className={cn(
                  "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full sm:hidden",
                  "border bg-background text-foreground",
                  "transition-[background-color,border-color] duration-fast ease-crownline",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  hasQuery
                    ? "border-gold-ink/50"
                    : "border-input hover:border-gold-ink/40 hover:bg-secondary"
                )}
              >
                <Search aria-hidden="true" className="size-4" />

                {/* A gold pip, not a badge with a number — there is only ever
                    one search term, so a count would be a "1" that never
                    changes. */}
                {hasQuery ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-gold-bright ring-2 ring-background"
                  />
                ) : null}
              </button>
            ) : null}
          </div>
        </div>
      </Container>
    </div>
  )
}
