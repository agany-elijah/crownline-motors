"use client"

import { useId, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, SlidersHorizontal, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
 * Make, model and year — the "Toyota → Harrier → 2021" journey from the
 * brief, and for Wave A the whole of it. Each works alone, and all three
 * combine. The options are drawn from the published inventory
 * (`listVehicleFacets`), and the lists narrow as choices are made: picking
 * Toyota reduces the models to Toyotas, picking Harrier reduces the years to
 * the ones a Harrier is listed for. A customer therefore cannot assemble a
 * search that was never going to match anything.
 *
 * ── Why a real GET form, not an onChange-only widget ──────────────────
 * The bar is a `<form action="/cars" method="get">` around three native
 * `<select>`s. That has three consequences worth having, none of them
 * decorative:
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
 * router instead, so the page updates without a full reload and the Search
 * button becomes a fallback rather than a step. The button stays visible: it
 * is what a keyboard user reaches for, and hiding it would leave the form
 * looking unfinished.
 *
 * ── What this component does not decide ───────────────────────────────
 * Nothing is filtered here. The selections become a query string, and the
 * server re-parses it through `vehicleSearchSchema` on every request. This
 * component cannot widen what a customer sees even if it is wrong.
 */

interface VehicleFiltersProps {
  /** Distinct published make/model/year combinations. */
  facets: VehicleFacet[]
  /** The criteria the current page was rendered with. */
  criteria: VehicleSearchCriteria
}

const ANY = ""

export function VehicleFilters({ facets, criteria }: VehicleFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const makeId = useId()
  const modelId = useId()
  const yearId = useId()

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
  const { makes, models, years, selectedMake, selectedModel } = useMemo(() => {
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

  const isFiltered = Boolean(criteria.make || criteria.model || criteria.year)

  /**
   * Applies a change to one control.
   *
   * Two rules the server would otherwise have to guess at:
   *
   *   - Changing the make clears the model and the year, and changing the
   *     model clears the year. Without this, switching from Toyota to Nissan
   *     while "Harrier" is selected produces a search for a Nissan Harrier —
   *     zero results, and the customer's own two clicks to undo.
   *   - Any change returns to page one. Staying on page three of a result
   *     set that now has one page shows an empty grid, which reads as "your
   *     filter matched nothing" when it matched plenty.
   */
  function apply(change: Partial<VehicleSearchCriteria>) {
    const next: VehicleSearchCriteria = { ...criteria, ...change }

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
      router.push(catalogueHref(next), { scroll: false })
    })
  }

  return (
    <search>
      <form
        // Both attributes matter: they are what the browser uses when the
        // router is unavailable. `action` must be the catalogue itself, and
        // the method must be GET so the selections land in the URL.
        action="/cars"
        method="get"
        className={cn(
          "flex flex-col gap-4 rounded-xl border border-border bg-card p-4",
          "sm:p-5"
        )}
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal
            aria-hidden="true"
            className="size-4 text-gold-ink"
          />
          <h2 className="font-heading text-small font-semibold tracking-tight">
            Find your vehicle
          </h2>
          {isPending ? (
            <Loader2
              aria-hidden="true"
              className="size-3.5 animate-spin text-muted-foreground"
            />
          ) : null}
        </div>

        {/*
          Three equal columns from `sm` up, stacked below it. Full-width
          controls on a phone give the biggest tap target the row allows,
          which is the difference between a filter people use and one they
          scroll past.
        */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        </div>

        {/*
          No result count here.

          It belongs to the page, which renders it once above the grid with
          its own `aria-live` — see the catalogue. Stating it in the bar as
          well put the same sentence on screen twice, and a second live
          region would have announced it twice to a screen reader.
        */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            {isFiltered ? (
              <button
                type="button"
                onClick={() => apply({ make: undefined, model: undefined, year: undefined })}
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
            ) : null}

            {/*
              The no-JavaScript path. With the router available every change
              has already navigated by the time this could be pressed, so it
              submits the same state again and is harmless.
            */}
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </div>
        </div>
      </form>
    </search>
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
