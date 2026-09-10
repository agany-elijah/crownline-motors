"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A horizontally scrolling strip of cards — vehicles or spare parts.
 *
 * Product-agnostic by construction: the cards arrive as `children`, already
 * rendered on the server, and the heading arrives as a prop. Nothing here
 * knows what is inside a card, which is why both catalogues use it rather
 * than each growing a scroller of its own.
 *
 * ── Why a scroller rather than a grid ─────────────────────────────────
 * A grid of related vehicles has to decide, at build time, how many
 * vehicles are worth showing — and whatever it picks is wrong for a
 * business whose inventory swings between two Toyotas and twenty. A strip
 * shows as many as exist, sizes itself to whatever room the page has, and
 * asks the customer for the one gesture they already make on a phone.
 * Swipe on touch, drag or arrows on a desktop.
 *
 * ── Native scrolling, not a carousel library ──────────────────────────
 * This is `overflow-x: auto` with CSS scroll snapping. The browser owns
 * the momentum, the rubber-banding, the trackpad gesture and the
 * right-to-left case; a JavaScript carousel reimplements all four and gets
 * at least one of them wrong on a mid-range Android, which is most of this
 * audience. The only thing script adds here is the two arrow buttons and
 * knowing when to disable them — and if that script never loads, the strip
 * still scrolls perfectly by touch and trackpad.
 *
 * The cards are passed in as `children` and the heading as a prop, both
 * rendered on the server. That is deliberate: this component is a client
 * island because it needs a scroll listener, and pushing the cards through
 * it would drag `next/image`, the card, the badge and four icons into the
 * client bundle to render markup that never changes.
 *
 * ── Accessibility ─────────────────────────────────────────────────────
 * Every card is a link, so a keyboard user tabs through the strip and the
 * browser scrolls each card into view on focus — the content is reachable
 * without the arrows, which is why the arrows are genuinely optional and
 * hidden entirely on touch widths. The strip keeps its list semantics and
 * takes an accessible name, so it is announced as a named list of a known
 * length rather than as loose links. `aria-live` is deliberately absent:
 * nothing here announces, it just scrolls.
 */
interface CardCarouselProps {
  /** The section heading, rendered on the server and laid out beside the arrows. */
  heading: React.ReactNode
  /** Accessible name for the scrolling region. */
  label: string
  /** The `<li>` cards. */
  children: React.ReactNode
}

export function CardCarousel({ heading, label, children }: CardCarouselProps) {
  const scrollerRef = React.useRef<HTMLUListElement>(null)

  /**
   * All three start false so the first server-rendered HTML carries no
   * arrows at all. Whether the strip overflows depends on the viewport,
   * which the server does not know — rendering arrows optimistically and
   * removing them on hydration is a visible flicker on exactly the slow
   * connections this site is built for.
   */
  const [overflows, setOverflows] = React.useState(false)
  const [atStart, setAtStart] = React.useState(true)
  const [atEnd, setAtEnd] = React.useState(false)

  const sync = React.useCallback(() => {
    const el = scrollerRef.current
    if (!el) return

    const furthest = el.scrollWidth - el.clientWidth

    // A pixel of tolerance either end. Sub-pixel layout means `scrollLeft`
    // routinely settles at 0.5 or at `furthest - 0.4`, and a strict
    // comparison leaves the arrow at a reached end stubbornly enabled.
    setOverflows(furthest > 1)
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft >= furthest - 1)
  }, [])

  React.useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    sync()

    el.addEventListener("scroll", sync, { passive: true })

    /**
     * A resize observer rather than a window listener: the strip's width
     * changes when the *container* changes, which includes a breakpoint
     * swapping the card width, and not only when the window resizes.
     */
    const observer = new ResizeObserver(sync)
    observer.observe(el)

    return () => {
      el.removeEventListener("scroll", sync)
      observer.disconnect()
    }
  }, [sync])

  /** Scrolls one card in `direction`, or one screenful if that can't be measured. */
  function page(direction: -1 | 1) {
    const el = scrollerRef.current
    if (!el) return

    const first = el.firstElementChild
    const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0
    const step = first ? first.getBoundingClientRect().width + gap : el.clientWidth

    /**
     * Checked here rather than left to CSS: `scroll-behavior: auto`
     * from the reduced-motion rule in globals.css does not reach a
     * programmatic scroll that asks for `smooth` explicitly.
     */
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    el.scrollBy({ left: direction * step, behavior: reduced ? "auto" : "smooth" })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">{heading}</div>

        {overflows ? (
          // Touch widths swipe, so the arrows would be two controls
          // duplicating a gesture the customer has already made.
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <ArrowButton
              direction="previous"
              disabled={atStart}
              onClick={() => page(-1)}
            />
            <ArrowButton direction="next" disabled={atEnd} onClick={() => page(1)} />
          </div>
        ) : null}
      </div>

      {/*
        Below `sm` the strip bleeds to the screen edge — the negative
        margin cancels the container's gutter and the padding puts it back
        inside the scroller, so the first card lines up with the heading
        while the last one runs off the edge instead of stopping short of
        it. `scroll-px` keeps snapping honest against that padding.

        The scrollbar is hidden because the cards do the work a scrollbar
        would: they are sized so the next one always peeks past the edge,
        which says "there is more" more clearly than a 6px track.
      */}
      <ul
        ref={scrollerRef}
        /*
         * Named, but left as a list. `role="group"` would give the region
         * an accessible name at the cost of the list semantics, so a
         * screen reader would stop announcing "list, 8 items" — which on a
         * strip that scrolls out of sight is exactly the information a
         * non-sighted visitor has no other way to get. A `list` takes a
         * name from the author perfectly well.
         */
        aria-label={label}
        className={cn(
          "no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain",
          "-mx-4 scroll-px-4 px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:px-0"
        )}
      >
        {children}
      </ul>
    </div>
  )
}

/**
 * One paging control.
 *
 * Disabled rather than hidden at the ends, so the pair does not reflow the
 * heading row as the customer scrolls — a control that vanishes under the
 * pointer that is about to press it is worse than one that greys out.
 */
function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next"
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Scroll to ${direction} vehicles`}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground",
        "transition-[background-color,border-color,color,opacity] duration-fast ease-crownline",
        "hover:border-gold-ink/40 hover:bg-accent hover:text-gold-ink",
        "disabled:pointer-events-none disabled:opacity-35"
      )}
    >
      <Icon aria-hidden="true" className="size-4.5" />
    </button>
  )
}
