"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { useRouter } from "next/navigation"
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RotatingPlaceholder } from "@/components/shared/rotating-placeholder"
import { VEHICLE_SEARCH_SUGGESTIONS } from "@/lib/constants/search-suggestions"
import { cn } from "@/lib/utils"
import type { VehicleFacet } from "@/lib/queries/public-vehicle.queries"
import {
  catalogueHref,
  type VehicleSearchCriteria,
} from "@/lib/validations/vehicle-search.schema"

/**
 * Search and filtering for the public catalogue (Stage 12).
 *
 * ── The shape of the search ───────────────────────────────────────────
 * Two controls, in the order a customer reaches for them:
 *
 *   1. A free-text box. One field matched against make, model and year at
 *      once, so "harrier", "Toyota Harrier" and "harrier 2021" all work
 *      without the customer first deciding which field they mean. Matching
 *      is case-insensitive and partial — see `vehicleSearchWhere`.
 *   2. The make / model / year dropdowns beneath it — the "Toyota →
 *      Harrier → 2021" journey from the brief. Their options are drawn from
 *      the published inventory (`listVehicleFacets`) and narrow as choices
 *      are made, so a customer cannot assemble a search that was never
 *      going to match anything.
 *
 * The two combine rather than compete: the text and the dropdowns are
 * ANDed by the query layer.
 *
 * ── Why a real GET form, not an onChange-only widget ──────────────────
 * The bar is a `<form action="/cars" method="get">` around a text input and
 * three native `<select>`s. That has three consequences worth having, none
 * of them decorative:
 *
 *   1. It works with JavaScript unavailable or still loading — which on a
 *      2G connection in Juba is a real state, not a hypothetical one. The
 *      browser submits the form and the server renders the filtered page.
 *   2. The result is a URL. A filtered catalogue can be bookmarked, shared
 *      over WhatsApp, and re-entered by the back button, because the state
 *      lives in the address rather than in this component.
 *   3. On a phone a native `<select>` opens the platform's own picker —
 *      bigger targets and a familiar gesture, which a custom listbox has to
 *      work hard to match.
 *
 * With JavaScript, changing any select navigates immediately through the
 * router instead, so the page updates without a full reload.
 *
 * ── What this component does not decide ───────────────────────────────
 * Nothing is filtered here. The selections become a query string, and the
 * server re-parses it through `vehicleSearchSchema` on every request. This
 * component cannot widen what a customer sees even if it is wrong.
 */

interface VehicleSearchProps {
  /** Distinct published make/model/year combinations. */
  facets: VehicleFacet[]
  /** The criteria the current page was rendered with. */
  criteria: VehicleSearchCriteria
}

const ANY = ""

/** Where the filter panel stops being collapsible — Tailwind's `sm`. */
const DESKTOP_QUERY = "(min-width: 40rem)"

export function VehicleSearch({ facets, criteria }: VehicleSearchProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()

  const searchId = React.useId()
  const makeId = React.useId()
  const modelId = React.useId()
  const yearId = React.useId()

  /**
   * The search box is uncontrolled, and read through this ref.
   *
   * ── Why not React state ───────────────────────────────────────────────
   * A controlled input is hydrated with the value the *server* rendered,
   * and React overwrites whatever is in the field to match. Anything typed
   * between the HTML arriving and the bundle hydrating is therefore
   * silently erased — which on a 2G connection in Juba is not a race, it is
   * a wait long enough to type a make into a box that is already on screen
   * and looks ready. An uncontrolled input keeps what the visitor typed,
   * because React never claims ownership of its value.
   *
   * The URL is still the source of truth. `key` on the field below is what
   * enforces that: when the applied search changes — a new search, the back
   * button, the clear control — the input is replaced with a fresh one
   * carrying the new value, rather than kept and corrected.
   */
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  /** Whatever is in the box right now, normalised the way the URL wants it. */
  const currentQuery = () => searchInputRef.current?.value.trim() || undefined

  /**
   * The option lists, each narrowed by the choices above it — plus the
   * canonical spelling of whatever is currently selected.
   *
   * Derived rather than stored: the criteria come from the URL, so there is
   * no second copy of the selection to fall out of step with the page that
   * was actually rendered.
   *
   * ── Why the selection is canonicalised, not used as-is ────────────────
   * The server matches case-insensitively, so `/cars?make=toyota` correctly
   * returns Toyotas. But a `<select value="toyota">` whose only option is
   * "Toyota" matches nothing, and React falls back to the first option — so
   * the grid would show Toyotas above a dropdown reading "Any make", and the
   * customer's next click would silently widen a search they thought was
   * narrow. Resolving the URL value back to the inventory's own spelling
   * keeps the control and the results telling the same story.
   *
   * A value that matches no option at all (a stale link to a make that has
   * since sold out) resolves to "Any", which is honest: the grid below is
   * empty and the bar shows nothing selected to explain it.
   */
  const { makes, models, years, selectedMake, selectedModel } = React.useMemo(() => {
    const sameValue = (a: string, b: string) =>
      a.toLowerCase() === b.toLowerCase()

    const canonical = (values: string[], selected: string | undefined) =>
      (selected && values.find((value) => sameValue(value, selected))) || ANY

    const makeList = [...new Set(facets.map((facet) => facet.make))]
    const make = canonical(makeList, criteria.make)

    const inMake = make ? facets.filter((facet) => facet.make === make) : facets

    const modelList = [...new Set(inMake.map((facet) => facet.model))]
    const model = canonical(modelList, criteria.model)

    const inModel = model ? inMake.filter((facet) => facet.model === model) : inMake

    const yearList = [...new Set(inModel.map((facet) => facet.year))].sort(
      (a, b) => b - a
    )

    return {
      makes: makeList,
      models: modelList,
      years: yearList,
      selectedMake: make,
      selectedModel: model,
    }
  }, [facets, criteria.make, criteria.model])

  /** How many dropdowns are narrowing the results — the badge on Filters. */
  const activeFilterCount =
    (criteria.make ? 1 : 0) + (criteria.model ? 1 : 0) + (criteria.year ? 1 : 0)

  /**
   * Applies a change to one control.
   *
   * Three rules the server would otherwise have to guess at:
   *
   *   - The text currently in the search box travels with every change,
   *     unless the change is itself setting it. Without that, typing
   *     "harrier" and *then* picking a year would throw the typed word
   *     away at the moment the customer thought they were narrowing it.
   *   - Changing the make clears the model and the year, and changing the
   *     model clears the year. Without this, switching from Toyota to Nissan
   *     while "Harrier" is selected produces a search for a Nissan Harrier —
   *     zero results, and the customer's own two clicks to undo.
   *   - Any change returns to page one. Staying on page three of a result
   *     set that now has one page shows an empty grid, which reads as "your
   *     filter matched nothing" when it matched plenty.
   */
  function apply(
    change: Partial<VehicleSearchCriteria>,
    options?: { scroll?: boolean }
  ) {
    const next: VehicleSearchCriteria = {
      ...criteria,
      ...("q" in change ? {} : { q: currentQuery() }),
      ...change,
    }

    /**
     * `"make" in change`, not `change.make !== undefined`.
     *
     * Choosing "Any make" sets the value to undefined, which is exactly what
     * the value test reads as "the make was not touched" — so clearing a
     * make left the model and year in place, and the customer was left with
     * "Any make / Harrier / 2021": a search nothing can satisfy, produced by
     * the one click that was supposed to widen it. Asking whether the key
     * was *supplied* is the question actually being asked.
     */
    if ("make" in change) {
      next.model = undefined
      next.year = undefined
    } else if ("model" in change) {
      next.year = undefined
    }

    startTransition(() => {
      /**
       * The bar is at the top of the page, so a filter change made from it
       * leaves the customer looking at the results already — scrolling
       * would only throw away their position.
       *
       * A search made from the docked control further down the page is the
       * opposite case: the result set underneath them has just been
       * replaced, and staying put would drop them into the middle of
       * vehicles they have not seen the start of.
       */
      router.push(catalogueHref(next), { scroll: options?.scroll ?? false })
    })
  }

  return (
    <>
      <search data-slot="vehicle-search">
        <form
          // Both attributes matter: they are what the browser uses when the
          // router is unavailable. `action` must be the catalogue itself, and
          // the method must be GET so the selections land in the URL.
          action="/cars"
          method="get"
          onSubmit={(event) => {
            // With the router available, submitting is a client navigation
            // rather than a document load — the difference between a
            // repaint and a white screen on a slow connection. Without it
            // this handler never runs and the browser submits normally.
            event.preventDefault()
            apply({ q: currentQuery() })
          }}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5"
        >
          <SearchField
            // Remounted whenever the applied search changes, which is how an
            // uncontrolled field stays honest about the page it is sitting
            // on — see the note on `searchInputRef`.
            key={criteria.q ?? ""}
            id={searchId}
            inputRef={searchInputRef}
            initialValue={criteria.q ?? ""}
            onClear={() => {
              if (searchInputRef.current) searchInputRef.current.value = ""

              // Only navigates if a search was actually applied. Clearing a
              // half-typed word the customer never submitted should not
              // reload the page underneath them.
              if (criteria.q) apply({ q: undefined })
            }}
            isPending={isPending}
          />

          <FilterPanel
            activeCount={activeFilterCount}
            onClear={() =>
              // Only the dropdowns. The text box has its own clear control,
              // and a button inside the Filters panel that also emptied the
              // search field above it would be doing something the customer
              // did not ask for and cannot see happen on a phone, where the
              // panel is open and the field is scrolled off.
              apply({ make: undefined, model: undefined, year: undefined })
            }
          >
            <FilterSelect
              id={makeId}
              name="make"
              label="Make"
              anyLabel="Any make"
              value={selectedMake}
              options={makes.map((make) => ({ value: make, label: make }))}
              onChange={(value) => apply({ make: value || undefined })}
            />

            <FilterSelect
              id={modelId}
              name="model"
              label="Model"
              anyLabel="Any model"
              value={selectedModel}
              options={models.map((model) => ({ value: model, label: model }))}
              onChange={(value) => apply({ model: value || undefined })}
            />

            <FilterSelect
              id={yearId}
              name="year"
              label="Year"
              anyLabel="Any year"
              value={
                criteria.year && years.includes(criteria.year)
                  ? String(criteria.year)
                  : ANY
              }
              options={years.map((year) => ({
                value: String(year),
                label: String(year),
              }))}
              onChange={(value) => apply({ year: value ? Number(value) : undefined })}
            />
          </FilterPanel>
        </form>
      </search>

      <StickySearch
        criteria={criteria}
        onSearch={(value) => apply({ q: value || undefined }, { scroll: true })}
      />
    </>
  )
}

/**
 * The free-text row: label, field, clear affordance, submit.
 *
 * ── Why it submits rather than searching as you type ──────────────────
 * A keystroke-triggered search means a server render per character on a
 * connection that is the slowest part of this audience's experience, and
 * the results underneath the finger change while it is still moving.
 * Submitting on Enter or on the button is one request per intent, and it is
 * what the on-screen keyboard's own "Go" key already does.
 */
function SearchField({
  id,
  inputRef,
  initialValue,
  onClear,
  isPending,
}: {
  id: string
  inputRef: React.RefObject<HTMLInputElement | null>
  initialValue: string
  onClear: () => void
  isPending: boolean
}) {
  /**
   * Only drives whether the clear control is shown, so the field itself can
   * stay uncontrolled. Seeded from the applied search, which is what the
   * server rendered — no hydration mismatch, and no ownership of the value.
   */
  const [hasText, setHasText] = React.useState(initialValue.length > 0)

  /** Freezes the rotating examples while the customer is actually typing. */
  const [isFocused, setIsFocused] = React.useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        Search
      </Label>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />

          <input
            id={id}
            ref={inputRef}
            name="q"
            // `search` rather than `text`: it tells a mobile keyboard to
            // offer a "Search" key instead of "Return", and it is what a
            // screen reader announces the field as.
            type="search"
            inputMode="search"
            autoComplete="off"
            enterKeyHint="search"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            /**
             * A single space, deliberately. The visible placeholder is the
             * animated overlay below — a native one cannot be cross-faded —
             * and `:placeholder-shown` is what hides that overlay the instant
             * somebody types, in CSS, with no re-render per keystroke. It only
             * matches when a placeholder attribute is actually present, so an
             * empty string would leave the hint sitting on top of the
             * customer's own text.
             */
            placeholder=" "
            defaultValue={initialValue}
            onChange={(event) => setHasText(event.target.value.length > 0)}
            className={cn(
              // `peer` is what the overlay's `peer-placeholder-shown` reads.
              "peer h-11 w-full rounded-lg border border-input bg-background pl-10",
              // Room on the right for the clear button when there is one.
              hasText ? "pr-10" : "pr-3.5",
              // 16px on mobile: iOS Safari zooms the whole page in on focus
              // for anything smaller, and never zooms back out.
              "text-base text-foreground placeholder:text-muted-foreground md:text-sm",
              "transition-colors outline-none",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              // The platform's own clear affordance is suppressed in favour
              // of the button below, which is a real 40px target and knows
              // whether clearing needs to navigate.
              "[&::-webkit-search-cancel-button]:appearance-none"
            )}
          />

          {/*
            The examples, layered over the field. Must follow the input in the
            DOM: `peer-*` variants only reach later siblings.

            Inset to clear the magnifier on the left and the clear control on
            the right, so a long suggestion truncates rather than running
            under either.
          */}
          <RotatingPlaceholder
            suggestions={VEHICLE_SEARCH_SUGGESTIONS}
            prefix="Try"
            paused={isFocused}
            className="left-10 right-10 text-base md:text-sm"
          />

          {hasText ? (
            <button
              type="button"
              onClick={() => {
                setHasText(false)
                onClear()
              }}
              aria-label="Clear search"
              className={cn(
                "absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center",
                "rounded-md text-muted-foreground",
                "transition-colors duration-fast hover:bg-secondary hover:text-foreground",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              )}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>

        {/*
          Icon-only on a phone, where the row has to hold a full-width field
          as well; labelled from `sm` up, where there is room and a word is
          clearer than a glyph. `aria-label` covers both cases, so the
          accessible name never depends on the viewport.
        */}
        <Button
          type="submit"
          size="lg"
          // Named explicitly because the visible word is hidden on a phone,
          // and "Search vehicles" rather than "Search" so the button's
          // accessible name cannot be confused with the field's own label —
          // by a screen-reader user or by a test.
          aria-label="Search vehicles"
          className="shrink-0 px-4 sm:px-6"
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Search aria-hidden="true" />
          )}
          <span className="hidden sm:inline">Search</span>
        </Button>
      </div>
    </div>
  )
}

/**
 * The dropdowns, collapsible on a phone.
 *
 * ── Why a native `<details>` ──────────────────────────────────────────
 * Three stacked selects and their labels are roughly 230px of a 844px
 * phone screen, sitting directly between the search box and the first
 * vehicle. Collapsing them by default is the single biggest thing that can
 * be done for the mobile catalogue.
 *
 * `<details>` does that with no JavaScript at all: the disclosure works,
 * it is keyboard operable, and assistive technology already knows what it
 * is. The element is rendered *open* by the server, so a visitor whose
 * JavaScript never arrives gets the filters expanded and usable rather
 * than hidden behind a control that cannot respond — the failure mode of
 * every state-driven version of this.
 *
 * The effect below is therefore an enhancement in the true sense: it
 * closes the panel on a phone once it knows the page is live, and forces
 * it back open if the viewport ever crosses into the range where the
 * summary is hidden.
 *
 * ── No result count in here ───────────────────────────────────────────
 * The catalogue renders it once above the grid, with its own `aria-live`.
 * Stating it in the bar as well put the same sentence on screen twice, and
 * a second live region would have announced it twice to a screen reader.
 */
function FilterPanel({
  activeCount,
  onClear,
  children,
}: {
  activeCount: number
  onClear: () => void
  children: React.ReactNode
}) {
  const detailsRef = React.useRef<HTMLDetailsElement>(null)

  /**
   * Read once, on mount, rather than tracked.
   *
   * The collapse decision belongs to the *arrival* at the page: a customer
   * who lands on a filtered link should see which filters are applied,
   * and one who lands on the bare catalogue should see the vehicles. Re-
   * running it whenever the filters change would close the panel under the
   * hand of someone who had just cleared a filter from inside it.
   */
  const startsFiltered = React.useRef(activeCount > 0)

  React.useEffect(() => {
    const element = detailsRef.current
    if (!element || typeof window.matchMedia !== "function") return

    const desktop = window.matchMedia(DESKTOP_QUERY)

    if (!desktop.matches && !startsFiltered.current) {
      element.open = false
    }

    // Above `sm` the summary is hidden, so a panel left closed on a phone
    // and then widened — a rotation, a tablet, a resized window — would be
    // unreachable. Re-opening on the way up is what makes that impossible.
    function handleChange(event: MediaQueryListEvent) {
      if (event.matches && detailsRef.current) detailsRef.current.open = true
    }

    desktop.addEventListener("change", handleChange)
    return () => desktop.removeEventListener("change", handleChange)
  }, [])

  return (
    <details ref={detailsRef} open className="group/filters">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-lg py-1",
          "text-small font-semibold text-foreground select-none",
          "transition-colors duration-fast hover:text-gold-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          // Safari still paints its own triangle without this.
          "[&::-webkit-details-marker]:hidden",
          // Above `sm` the panel is always open, so the control that opens
          // it would be a button that does nothing.
          "sm:hidden"
        )}
      >
        <SlidersHorizontal aria-hidden="true" className="size-4 text-gold-ink" />
        <span className="font-heading tracking-tight">Filters</span>

        {activeCount > 0 ? (
          <span className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground">
            {activeCount}
          </span>
        ) : null}

        <span
          aria-hidden="true"
          className="ml-auto text-xs font-normal text-muted-foreground"
        >
          <span className="group-open/filters:hidden">Show</span>
          <span className="hidden group-open/filters:inline">Hide</span>
        </span>
      </summary>

      <div className="flex flex-col gap-4 pt-4 sm:pt-0">
        {/*
          Three equal columns from `sm` up, stacked below it. Full-width
          controls on a phone give the biggest tap target the row allows,
          which is the difference between a filter people use and one they
          scroll past.
        */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>

        {/*
          Shown only while something is actually selected, so the panel is
          not carrying a control that does nothing.
        */}
        {activeCount > 0 ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClear}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5",
                "text-small text-muted-foreground",
                "transition-colors duration-fast hover:text-gold-ink",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              )}
            >
              <X aria-hidden="true" className="size-3.5" />
              Clear filters
            </button>
          </div>
        ) : null}
      </div>
    </details>
  )
}

/**
 * One labelled native `<select>`.
 *
 * The empty option is a real option rather than a placeholder attribute, so
 * "Any make" can be chosen again to widen a search — a `disabled` placeholder
 * would let a customer narrow but never step back.
 */
function FilterSelect({
  id,
  name,
  label,
  anyLabel,
  value,
  options,
  onChange,
}: {
  id: string
  name: string
  label: string
  anyLabel: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <select
        id={id}
        name={name}
        /**
         * Controlled by the URL, not by local state.
         *
         * `value` + `onChange` rather than `defaultValue`, because the
         * criteria can change underneath this component — the browser's back
         * button, or the Clear control — and a defaulted select would keep
         * showing the previous choice while the grid showed the new results.
         */
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-11 w-full rounded-lg border border-input bg-background px-3",
          // 16px on mobile: iOS Safari zooms the whole page in on focus for
          // anything smaller, and the page never zooms back out.
          "text-base text-foreground md:text-sm",
          "transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        )}
      >
        <option value={ANY}>{anyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * The search symbol that stays with the customer down the page.
 *
 * ── What it is for ────────────────────────────────────────────────────
 * The catalogue is one long grid. Once the bar at the top has scrolled
 * away, changing the search means scrolling back up, and on a phone that is
 * far enough to feel like leaving. This keeps one small control within
 * reach: pressing it opens the search field where the customer already is.
 *
 * ── Why it is a pure enhancement ──────────────────────────────────────
 * It only exists once the bar above has genuinely scrolled out of view,
 * which is a state only the browser can report — so nothing here is
 * rendered on the server and nothing about it is required for the search
 * to work. The panel it opens is a real GET form carrying the current
 * dropdown selections as hidden fields, so a submission from it narrows
 * the same search rather than replacing it.
 *
 * ── Why not a modal ───────────────────────────────────────────────────
 * A dialog would trap focus and cover the results the customer is reading.
 * This is a disclosure: it announces its state through `aria-expanded`,
 * closes on Escape or an outside press, and returns focus to the button it
 * came from. Nothing underneath it is made inert, because nothing
 * underneath it needs to be.
 */
function StickySearch({
  criteria,
  onSearch,
}: {
  criteria: VehicleSearchCriteria
  onSearch: (value: string) => void
}) {
  const [isDocked, setIsDocked] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const [value, setValue] = React.useState(criteria.q ?? "")
  const [appliedQuery, setAppliedQuery] = React.useState(criteria.q ?? "")

  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)

  /**
   * This control does not unmount when it undocks — it renders nothing —
   * so its field would otherwise keep whatever was typed into it three
   * searches ago. Re-seeding it from the URL whenever the applied search
   * changes keeps it showing the search that is actually in effect, which
   * is the same rule the bar at the top of the page follows.
   */
  if (appliedQuery !== (criteria.q ?? "")) {
    setAppliedQuery(criteria.q ?? "")
    setValue(criteria.q ?? "")
  }

  /**
   * Docks once the search bar at the top of the page has scrolled behind
   * the header.
   *
   * The observed element is the form itself, found by its `<search>`
   * landmark rather than passed down through a ref: this component is
   * rendered as a sibling of the bar, and threading a ref between them
   * would tie two independent pieces together for one measurement.
   *
   * `rootMargin` pulls the top of the observation box down past the fixed
   * header (80px at its tallest), so "out of view" means "hidden behind the
   * header" rather than "level with the top of the window", which would
   * dock while the bar was still perfectly usable.
   */
  React.useEffect(() => {
    const bar = document.querySelector('[data-slot="vehicle-search"]')

    if (!bar || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const docked = !entry.isIntersecting

        setIsDocked(docked)

        // Scrolling back to the bar closes the panel: two search fields on
        // screen at once is two places to type, and one of them is going to
        // be ignored. Done here, in the observer's own callback, rather
        // than in an effect watching `isDocked` — that would be React
        // reacting to React, which is the cascading render the codebase's
        // lint rules exist to prevent.
        if (!docked) setIsOpen(false)
      },
      { rootMargin: "-88px 0px 0px 0px", threshold: 0 }
    )

    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      setIsOpen(false)
      // Focus goes back where it came from rather than to the document, so
      // a keyboard user is not returned to the top of the page.
      buttonRef.current?.focus()
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  if (!isDocked) return null

  return (
    <div
      ref={rootRef}
      data-entrance=""
      className={cn(
        // Under the fixed header (z-40) and clear of the WhatsApp float,
        // which sits bottom-right at the same layer.
        "fixed inset-x-0 z-30 top-16 md:top-20",
        // The wrapper spans the page so its contents can align to the same
        // gutter as everything else, but only the control itself takes
        // pointer events — the results behind it stay scrollable and
        // clickable.
        "pointer-events-none px-4 pt-3 sm:px-6 lg:px-8 xl:px-12"
      )}
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-6xl justify-end">
        {isOpen ? (
          <form
            action="/cars"
            method="get"
            onSubmit={(event) => {
              event.preventDefault()
              onSearch(value.trim())
              setIsOpen(false)
            }}
            data-entrance=""
            className={cn(
              "flex w-full max-w-md items-center gap-2 rounded-xl border border-border p-2",
              "bg-card/95 shadow-[var(--shadow-raised)] backdrop-blur-xl"
            )}
          >
            {/* The dropdown selections travel with the submission, so
                searching from here narrows the current view instead of
                quietly resetting it to the whole floor. */}
            {criteria.make ? <input type="hidden" name="make" value={criteria.make} /> : null}
            {criteria.model ? <input type="hidden" name="model" value={criteria.model} /> : null}
            {criteria.year ? <input type="hidden" name="year" value={String(criteria.year)} /> : null}

            <Search aria-hidden="true" className="ml-1.5 size-4 shrink-0 text-muted-foreground" />

            <input
              ref={inputRef}
              name="q"
              type="search"
              inputMode="search"
              autoComplete="off"
              enterKeyHint="search"
              aria-label="Search the catalogue"
              placeholder="Make, model or year"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className={cn(
                "h-9 min-w-0 flex-1 bg-transparent text-base text-foreground md:text-sm",
                "placeholder:text-muted-foreground outline-none",
                "[&::-webkit-search-cancel-button]:appearance-none"
              )}
            />

            <Button type="submit" size="sm" className="shrink-0">
              Search
            </Button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                buttonRef.current?.focus()
              }}
              aria-label="Close search"
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground",
                "transition-colors duration-fast hover:bg-secondary hover:text-foreground",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              )}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </form>
        ) : (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => {
              /**
               * Flushed synchronously so the field exists — and can be
               * focused — while the browser still considers itself inside
               * the tap that opened it. iOS Safari only raises the on-screen
               * keyboard for a `focus()` made during a user gesture; the
               * same call from an effect a tick later reveals the caret but
               * not the keyboard, which is precisely the platform this
               * control matters most on.
               */
              flushSync(() => setIsOpen(true))
              inputRef.current?.focus()
            }}
            aria-label="Open search"
            className={cn(
              "flex size-11 items-center justify-center rounded-full",
              "border border-border bg-card/95 text-foreground backdrop-blur-xl",
              "shadow-[var(--shadow-raised)]",
              "transition-[transform,color,background-color] duration-fast ease-crownline",
              "hover:-translate-y-0.5 hover:bg-card hover:text-gold-ink",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              // A search that is currently applied is worth marking, so the
              // symbol does not read as "no search here" while the grid
              // below is filtered.
              criteria.q ? "text-gold-ink" : undefined
            )}
          >
            <Search aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>
    </div>
  )
}
