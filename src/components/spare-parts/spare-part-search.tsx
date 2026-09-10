"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search, X } from "lucide-react"

import { Label } from "@/components/ui/label"
import { RotatingPlaceholder } from "@/components/shared/rotating-placeholder"
import { SPARE_PART_SEARCH_SUGGESTIONS } from "@/lib/constants/search-suggestions"
import { cn } from "@/lib/utils"
import {
  partCatalogueHref,
  type SparePartSearchCriteria,
} from "@/lib/validations/spare-part-search.schema"

/**
 * Search for the parts catalogue.
 *
 * ── The shape ─────────────────────────────────────────────────────────
 *
 *     ╭──────────────────────────────────────────────╮ ╭───╮
 *     │ 🔍  Part name or number                   ✕  │ │ → │
 *     ╰──────────────────────────────────────────────╯ ╰───╯
 *
 * One pill, fully rounded at both ends, with the submit as a filled circle
 * riding at the end of it. That is the arrangement a customer in this market
 * already has in their hands on every marketplace they use, and it is why it
 * is worth copying: a search field should be recognised, not learned.
 *
 * It replaced a rectangular field beside a rectangular labelled button, which
 * read as one more form control on a page and, sitting inside a bordered
 * block above the grid, as a card. This is a bar — it sits in the sticky band
 * with the categories, so it stays reachable the whole way down the
 * catalogue rather than scrolling away with the top of the page.
 *
 * ── One box, three columns ────────────────────────────────────────────
 * The term is matched against the part name, the manufacturer's number and
 * our own reference at once, so someone holding a worn part can type whatever
 * is legible on it without first deciding which kind of number it is. The
 * category rail beside it narrows the same result set; the two are ANDed by
 * the query layer.
 *
 * Deliberately simpler than the vehicle catalogue's bar, which also carries
 * make/model/year dropdowns. Parts are found by name or by number; a set of
 * dropdowns over a catalogue of consumables would be three more controls to
 * read past on a phone for a narrowing nobody asked for. Fitment filtering
 * ("show me parts for my Harrier") is a real requirement and a different
 * control — it belongs beside a vehicle, not in this box.
 *
 * ── Why a real GET form, not an onChange-only widget ──────────────────
 * It is a `<form action="/spare-parts" method="get">` around one input. That
 * has three consequences worth having:
 *
 *   1. It works with JavaScript unavailable or still loading — which on a 2G
 *      connection in Juba is a real state, not a hypothetical one. The
 *      browser submits the form and the server renders the filtered page.
 *   2. The result is a URL, so a search can be bookmarked and shared.
 *   3. The back button behaves.
 *
 * The current category travels in a hidden field, so searching inside
 * Suspension stays inside Suspension — the mirror of the rail carrying `q`
 * through a category change.
 *
 * ── Why the input is uncontrolled ─────────────────────────────────────
 * A controlled input is hydrated with the value the *server* rendered, and
 * React overwrites whatever is in the field to match. Anything typed between
 * the HTML arriving and the bundle hydrating is silently erased — on a slow
 * connection that is not a race, it is a wait long enough to type a part
 * number into a box that is already on screen and looks ready.
 *
 * The URL is still the source of truth: `key` on the field is what enforces
 * it, replacing the input with a fresh one carrying the new value whenever
 * the applied search changes.
 */
interface SparePartSearchProps {
  criteria: SparePartSearchCriteria
  /** Lets the caller cap the measure. The catalogue does, so the field does
   *  not run the container's full 80rem and read as a form. */
  className?: string
  /**
   * Focuses the field on mount.
   *
   * Set by the bar when the customer has just opened the collapsed mobile
   * search: they pressed a magnifier expecting to type, and making them press
   * a second time would be the control failing at the one job it has.
   *
   * Not `autoFocus` on the element itself — that would also fire on the
   * desktop bar, stealing focus and scrolling the page on every catalogue
   * load.
   */
  autoFocus?: boolean
}

export function SparePartSearch({
  criteria,
  className,
  autoFocus = false,
}: SparePartSearchProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()

  const searchId = React.useId()
  const inputRef = React.useRef<HTMLInputElement>(null)

  /** Freezes the rotating examples while the customer is actually typing. */
  const [isFocused, setIsFocused] = React.useState(false)

  React.useEffect(() => {
    if (!autoFocus) return

    // `preventScroll` because the bar is sticky: without it the browser
    // scrolls the field to the middle of the viewport, dragging the grid the
    // customer was looking at out from under them.
    inputRef.current?.focus({ preventScroll: true })
  }, [autoFocus])

  /** Only drives whether the clear control is shown, so the field itself can
   *  stay uncontrolled. Seeded from the applied search, which is what the
   *  server rendered — no hydration mismatch, and no ownership of the value. */
  const [hasText, setHasText] = React.useState((criteria.q ?? "").length > 0)

  function apply(q: string | undefined) {
    startTransition(() => {
      // `scroll: false` — the bar sits directly above the grid, so the
      // customer is already looking at the results and scrolling would only
      // throw away their position.
      router.push(partCatalogueHref({ ...criteria, q }), { scroll: false })
    })
  }

  return (
    <search data-slot="spare-part-search" className={cn("w-full", className)}>
      <form
        // Both attributes matter: they are what the browser uses when the
        // router is unavailable. `action` must be the catalogue itself, and
        // the method must be GET so the term lands in the URL.
        action="/spare-parts"
        method="get"
        onSubmit={(event) => {
          // With the router available, submitting is a client navigation
          // rather than a document load — the difference between a repaint
          // and a white screen on a slow connection.
          event.preventDefault()
          apply(inputRef.current?.value.trim() || undefined)
        }}
        className="flex items-center gap-2"
      >
        {/* Carried so a search inside a category stays inside it. Hidden
            rather than absent, because the no-JavaScript path submits this
            form directly and the server reads only what the form sends. */}
        {criteria.category ? (
          <input type="hidden" name="category" value={criteria.category} />
        ) : null}

        <Label htmlFor={searchId} className="sr-only">
          Search spare parts
        </Label>

        {/*
          The pill.

          The border and the focus ring live on this wrapper rather than on
          the input, so the glyph, the field and the clear control read as one
          object — an input with its own border inside a bordered wrapper is
          the double-outline that makes a search bar look assembled rather
          than designed.

          `focus-within` is what carries the focus state across from the
          input, so a keyboard user still sees exactly where they are.
        */}
        <div
          className={cn(
            "relative flex h-11 flex-1 items-center rounded-full border border-input bg-background",
            "transition-[border-color,box-shadow] duration-fast ease-crownline",
            "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40"
          )}
        >
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 size-4 text-muted-foreground"
          />

          <input
            id={searchId}
            ref={inputRef}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            // Remounted whenever the applied search changes, which is how an
            // uncontrolled field stays honest about the page it is sitting
            // on.
            key={criteria.q ?? ""}
            name="q"
            // `search` rather than `text`: it tells a mobile keyboard to
            // offer a "Search" key instead of "Return".
            type="search"
            inputMode="search"
            autoComplete="off"
            enterKeyHint="search"
            /**
             * A single space, and it has to be exactly that.
             *
             * The visible placeholder is the animated overlay below, because
             * a native one cannot be cross-faded. `:placeholder-shown` is what
             * hides that overlay the instant somebody types — in CSS, with no
             * state and no re-render per keystroke — and it only matches when
             * a placeholder attribute is actually present. An empty string
             * would never match and the overlay would sit on top of the
             * customer's own text.
             */
            placeholder=" "
            defaultValue={criteria.q ?? ""}
            onChange={(event) => setHasText(event.target.value.length > 0)}
            className={cn(
              // `peer` is what the overlay's `peer-placeholder-shown` reads.
              "peer h-full w-full min-w-0 rounded-full bg-transparent pl-11",
              hasText ? "pr-10" : "pr-4",
              // 16px on mobile: iOS Safari zooms the whole page in on focus
              // for anything smaller, and never zooms back out.
              "text-base text-foreground placeholder:text-muted-foreground md:text-sm",
              "outline-none",
              // The platform's own clear affordance is suppressed in favour
              // of the button below, which is a real 32px target and knows
              // whether clearing needs to navigate.
              "[&::-webkit-search-cancel-button]:appearance-none"
            )}
          />

          {/*
            The examples, layered over the field. Must follow the input in the
            DOM: `peer-*` variants only reach later siblings, so an overlay
            written above the input would never be hidden by it.

            Inset to clear the magnifier on the left and the clear control on
            the right, so a long suggestion truncates rather than running
            under either.
          */}
          <RotatingPlaceholder
            suggestions={SPARE_PART_SEARCH_SUGGESTIONS}
            prefix="Search"
            paused={isFocused}
            className="left-11 right-11 text-base md:text-sm"
          />

          {hasText ? (
            <button
              type="button"
              onClick={() => {
                setHasText(false)
                if (inputRef.current) inputRef.current.value = ""

                // Only navigates if a search was actually applied. Clearing a
                // half-typed word the customer never submitted should not
                // reload the page underneath them.
                if (criteria.q) apply(undefined)

                // Focus returns to the field: clearing a search is almost
                // always the first half of typing a different one.
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className={cn(
                "absolute right-1.5 flex size-8 items-center justify-center rounded-full",
                "text-muted-foreground",
                "transition-colors duration-fast hover:bg-secondary hover:text-foreground",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              )}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>

        {/*
          The submit, as a filled circle at the end of the bar.

          Deliberately not the shared `Button`: that component is a rounded
          rectangle by design, and the one thing this control has to be is
          round. It carries the same gold fill and the same focus treatment,
          so it still reads as part of the system.

          Icon-only at every width. The field beside it is already labelled
          "Part name or number", and the glyph on a circle at the end of a
          search bar is about as unambiguous as an interface gets — the word
          would only cost the field its measure on a phone. `aria-label`
          covers the accessible name, and it says "parts" so it cannot be
          confused with the field's own label by a screen-reader user or by a
          test.
        */}
        <button
          type="submit"
          aria-label="Search parts"
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full",
            "bg-gold-bright text-gold-bright-foreground shadow-[var(--shadow-gold)]",
            "transition-[box-shadow,transform] duration-fast ease-crownline",
            "hover:shadow-[var(--shadow-gold-strong)]",
            "active:scale-95",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          )}
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Search aria-hidden="true" className="size-4" />
          )}
        </button>
      </form>
    </search>
  )
}
