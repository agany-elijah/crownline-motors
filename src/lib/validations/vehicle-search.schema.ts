import { z } from "zod"

import { VehicleBodyType } from "@/generated/prisma/enums"
import { VEHICLE_YEAR_MIN, bodyTypeToParam, vehicleYearMax } from "@/lib/constants/vehicle-options"

/**
 * The public catalogue's search parameters (Stage 12).
 *
 * ── Why parsing is forgiving rather than strict ───────────────────────
 * Everything here arrives in a query string, which is user-editable,
 * bookmarked, pasted into WhatsApp, and rewritten by link previewers. A
 * malformed value is an ordinary event, not an exceptional one, so each
 * field falls back to "not filtered" rather than throwing: `?year=banana`
 * shows the unfiltered catalogue, never an error page.
 *
 * That is *not* the same as trusting the input. Every value that survives is
 * length-bounded and type-checked before it reaches Prisma, and the query
 * layer parameterises it — so a make containing a quote is a value that
 * matches nothing, never syntax.
 *
 * ── The two ways a customer narrows the catalogue ─────────────────────
 * `q` is the free-text box above the filter bar: one field, matched against
 * make, model and year at once, so "harrier 2021" and "toyota" both work
 * without the customer having to say which field they mean.
 *
 * `make` / `model` / `year` are the dropdowns beneath it, each drawn from
 * the published inventory. They narrow rather than replace — a text search
 * and a dropdown selection are ANDed, so a customer can type "harrier" and
 * then still restrict the year.
 *
 * ── Why only these ────────────────────────────────────────────────────
 * The client scoped Wave A's search to make, model and year. The brief's
 * wider list (price, mileage, fuel, transmission, drive, location) is not
 * gone: the query layer's `PublicVehicleFilters` already accepts any of
 * them, so each is a field added here plus a control added to the filter
 * bar, not a redesign. Deliberately not built ahead of being asked for.
 */

/**
 * Upper bound on a free-text filter value.
 *
 * The UI populates these from a `<select>` of values that exist in the
 * inventory, so a legitimate value is a make or a model name — under 60
 * characters by a wide margin. The cap is aimed at a hand-edited URL
 * carrying kilobytes of text into a database query.
 */
const TEXT_FILTER_MAX_LENGTH = 60

/**
 * A make or model as it arrives from the URL.
 *
 * Empty and whitespace-only collapse to `undefined`, which is what an
 * unselected dropdown submits — a filter bar rendered as a GET form posts
 * `?make=&model=` when nothing is chosen, and those must mean "no filter"
 * rather than "match the empty string".
 */
const textFilter = z
  .string()
  .trim()
  .max(TEXT_FILTER_MAX_LENGTH)
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional()
  .catch(undefined)

/**
 * Upper bound on the free-text search box.
 *
 * Longer than a dropdown value because this one is typed rather than
 * chosen, and a customer may reasonably enter "toyota land cruiser prado
 * 2019" — but still short enough that a pasted paragraph never reaches the
 * database. Over the limit the term is dropped entirely (`.catch`), which
 * shows the unfiltered catalogue rather than an error page.
 */
const SEARCH_TERM_MAX_LENGTH = 80

/**
 * The free-text query.
 *
 * Whitespace is trimmed *and* collapsed, so "toyota   harrier" and "toyota
 * harrier" are one URL rather than two addresses for one result set — the
 * same canonicalisation rule the query builder below applies for the
 * dropdowns.
 */
const searchTerm = z
  .string()
  .trim()
  .max(SEARCH_TERM_MAX_LENGTH)
  .transform((value) => value.replace(/\s+/g, " "))
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional()
  .catch(undefined)

/**
 * The model year.
 *
 * Bounded by the same limits the admin form enforces, so the filter cannot
 * ask for a year no listing could ever hold. The ceiling is evaluated per
 * parse rather than at import — a server process alive across New Year's Eve
 * must not go on refusing the new model year, which is exactly when an
 * importer starts listing it.
 */
const yearFilter = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const raw = typeof value === "number" ? value : value.trim()

    if (raw === "") return undefined

    const parsed = Number(raw)

    if (!Number.isInteger(parsed)) {
      ctx.addIssue({ code: "custom", message: "Year must be a whole number." })
      return z.NEVER
    }

    if (parsed < VEHICLE_YEAR_MIN || parsed > vehicleYearMax()) {
      ctx.addIssue({ code: "custom", message: "Year is out of range." })
      return z.NEVER
    }

    return parsed
  })
  .optional()
  .catch(undefined)

/**
 * The page number.
 *
 * Separate from the filters below because it is not one: it does not narrow
 * the result set, and every filter change resets it. Kept in this module so
 * the whole query string is parsed in one place.
 */
const pageFilter = z
  .union([z.string(), z.number()])
  .transform((value) => {
    const parsed = Number(typeof value === "number" ? value : value.trim())

    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
  })
  .catch(1)
  .default(1)

/**
 * The body type, from `?type=suv`.
 *
 * Accepted in any case and mapped onto the enum, so a hand-typed `?type=SUV`
 * and the tile's `?type=suv` are one search. Anything that is not a body type
 * degrades to "not filtered", like every other field here.
 */
const bodyTypeFilter = z
  .string()
  .trim()
  .max(TEXT_FILTER_MAX_LENGTH)
  .transform((value) => (value.length === 0 ? undefined : value.toUpperCase()))
  .pipe(z.enum(VehicleBodyType).optional())
  .optional()
  .catch(undefined)

export const vehicleSearchSchema = z.object({
  q: searchTerm,
  make: textFilter,
  model: textFilter,
  year: yearFilter,
  bodyType: bodyTypeFilter,
  page: pageFilter,
})

export type VehicleSearchParams = z.infer<typeof vehicleSearchSchema>

/** Just the narrowing part — what the query layer turns into a where clause. */
export type VehicleSearchCriteria = Omit<VehicleSearchParams, "page">

/**
 * Parses a Next.js `searchParams` object.
 *
 * A value arrives as `string | string[] | undefined`: a URL may legally
 * repeat a key, and `?make=Toyota&make=Nissan` is not a filter anyone can
 * satisfy. The first occurrence wins, which matches what a browser submits
 * from a form and what the filter bar builds.
 */
export function parseVehicleSearchParams(
  params: Record<string, string | string[] | undefined>
): VehicleSearchParams {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value

  return vehicleSearchSchema.parse({
    q: first(params.q),
    make: first(params.make),
    model: first(params.model),
    year: first(params.year),
    bodyType: first(params.type),
    page: first(params.page) ?? 1,
  })
}

/** True when at least one narrowing filter is active. */
export function hasActiveSearch(criteria: VehicleSearchCriteria): boolean {
  return Boolean(
    criteria.q || criteria.make || criteria.model || criteria.year || criteria.bodyType
  )
}

/**
 * Rebuilds a catalogue query string from criteria plus an optional page.
 *
 * One builder for the filter bar, the pagination links and the "clear"
 * control, so a filtered page-two link cannot lose its filters while a
 * page-one link keeps them. Keys are emitted in a fixed order and empty
 * values are omitted, so the same search always produces the same URL —
 * which matters for caching and for not showing a customer two addresses for
 * one result set.
 */
export function buildCatalogueQuery(
  criteria: VehicleSearchCriteria,
  page = 1
): string {
  const params = new URLSearchParams()

  // `q` first: it is the control the customer typed into, so it is the one
  // they will recognise when the address bar is truncated on a phone.
  if (criteria.q) params.set("q", criteria.q)
  if (criteria.make) params.set("make", criteria.make)
  if (criteria.model) params.set("model", criteria.model)
  if (criteria.year) params.set("year", String(criteria.year))
  if (criteria.bodyType) params.set("type", bodyTypeToParam(criteria.bodyType))
  // Page one is the default and is left out, so "/cars" and "/cars?page=1"
  // do not become two URLs for the same page.
  if (page > 1) params.set("page", String(page))

  return params.toString()
}

/** `/cars` with the criteria applied. */
export function catalogueHref(criteria: VehicleSearchCriteria, page = 1): string {
  const query = buildCatalogueQuery(criteria, page)

  return query ? `/cars?${query}` : "/cars"
}
