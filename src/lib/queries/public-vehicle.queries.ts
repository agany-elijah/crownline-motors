import "server-only"

import { cache } from "react"

import type { Prisma } from "@/generated/prisma/client"
import type { VehicleCondition } from "@/generated/prisma/enums"
import { VehicleStatus } from "@/generated/prisma/enums"
import { VEHICLE_YEAR_MIN, vehicleYearMax } from "@/lib/constants/vehicle-options"
import { prisma } from "@/lib/prisma"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { escapeLikePattern } from "@/lib/utils/like-pattern"
import { vehiclePhotoPublicUrl } from "@/lib/storage/vehicle-media"
import type { VehicleSearchCriteria } from "@/lib/validations/vehicle-search.schema"
import {
  DEFAULT_VEHICLE_VISIBILITY,
  VEHICLE_INFO_FIELDS,
  resolveVisibility,
  shown,
  type VehicleInfoField,
  type Visibility,
} from "@/lib/visibility/product-visibility"

/**
 * Reads for the public vehicle marketplace.
 *
 * ── Why this is a separate module from vehicle.queries.ts ─────────────
 * `vehicle.queries.ts` serves the admin dashboard, and its list query
 * deliberately applies *no* status filter by default — an operator looking
 * for a vehicle they archived last month has to be able to find it. That is
 * correct there and catastrophic here: the same query behind /cars would put
 * unfinished drafts, vehicles already sold, and withdrawn listings in front
 * of customers, complete with prices nobody intended to publish.
 *
 * Keeping the two in separate modules is not tidiness. It means the public
 * side never inherits a default from a query written for the dashboard, and
 * that a future filter added for an operator cannot silently widen what a
 * customer sees. Every read below goes through `publicVehicleWhere`, which
 * pins the status and cannot be talked out of it.
 *
 * ── What the DTOs deliberately omit ───────────────────────────────────
 * No `status`, no internal timestamps, no id where a slug will do. A
 * customer-facing payload should not carry fields whose only use is
 * administrative — partly because they are nobody's business, and partly
 * because a component that cannot read a status cannot accidentally render
 * one.
 *
 * ── Facts an operator has hidden ──────────────────────────────────────
 * Settings → Catalogue display hides a fact for every listing, and a
 * listing's own `hiddenFields` hides it for that one (see
 * `@/lib/visibility/product-visibility`). Both are applied *here*, while the
 * DTO is built: a hidden value is null in the payload, so no component, page
 * or metadata builder downstream can publish it by forgetting a check. The
 * search and the filter options honour the same rule, because narrowing a
 * result set by a fact reveals it just as surely as printing it.
 *
 * Decimals are converted to numbers here for the same reason they are in the
 * admin module: Prisma's Decimal is not serialisable across the
 * server/client boundary. Decimal(12,2) tops out well below 2^53.
 */

/** Vehicles per page in the public catalogue. */
export const PUBLIC_VEHICLES_PER_PAGE = 12

/**
 * The only status a customer may ever see.
 *
 * DRAFT is unfinished, RESERVED is spoken for, SOLD is gone, and ARCHIVED
 * was withdrawn on purpose. PUBLISHED is the single status that means "this
 * listing is live", which is exactly what `updateVehicleStatusAction`
 * treats as a separately-permissioned decision.
 */
export const PUBLIC_VEHICLE_STATUS = VehicleStatus.PUBLISHED

/**
 * Filters a public read may add on top of the visibility rule.
 *
 * `status` is excluded at the type level, so a caller cannot pass one even
 * by accident — the Stage 12 search filters (make, model, year, price,
 * mileage, fuel, transmission, drive, location) all fit through here without
 * ever being able to widen visibility.
 */
export type PublicVehicleFilters = Omit<Prisma.VehicleWhereInput, "status">

/**
 * The where-clause every public read must use.
 *
 * The status is applied *after* the caller's filters are spread, so it wins
 * even if an untyped caller — a future API route deserialising a query
 * string, say — manages to smuggle one in. The type-level `Omit` above is
 * the first guard; this ordering is the one that still holds at runtime.
 */
export function publicVehicleWhere(
  filters: PublicVehicleFilters = {}
): Prisma.VehicleWhereInput {
  return { ...filters, status: PUBLIC_VEHICLE_STATUS }
}

/**
 * A vehicle as the marketplace card shows it (brief §4).
 *
 * Every nullable fact is null when it is hidden — see the module note.
 */
export interface PublicVehicleCard {
  slug: string
  referenceNumber: string
  make: string
  model: string
  year: number | null
  /** Null reads as "Price on request". */
  price: number | null
  mileageKm: number | null
  fuelType: string | null
  transmission: string | null
  engineSize: string | null
  countryOfOrigin: string | null
  /** Where the vehicle is now. */
  currentLocation: string | null
  /** Whether the "Available" tag may be shown. */
  showAvailability: boolean
  /** The main image, or null while a listing is published without one. */
  photoUrl: string | null
  photoAltText: string | null
}

export interface PublicVehicleListResult {
  vehicles: PublicVehicleCard[]
  total: number
  page: number
  pageCount: number
}

/**
 * Only the main photograph is selected for a card.
 *
 * Forty rows per vehicle across a page of listings is a payload nobody
 * reads; the card shows one image and the gallery is the detail page's job.
 */
const CARD_PHOTO = {
  where: { deletedAt: null, isPrimary: true },
  select: { storagePath: true, altText: true },
  take: 1,
} as const

/**
 * Everything a card needs, and nothing else.
 *
 * Shared by the catalogue and the related-vehicles strip so the two cannot
 * drift into selecting different columns for the same component — and so
 * that adding a field to `PublicVehicleCard` is one edit rather than a hunt
 * for every read that has to start supplying it.
 */
const CARD_SELECT = {
  slug: true,
  referenceNumber: true,
  make: true,
  model: true,
  year: true,
  price: true,
  mileageKm: true,
  fuelType: true,
  transmission: true,
  engineSize: true,
  countryOfOrigin: true,
  currentLocation: true,
  hiddenFields: true,
  photos: CARD_PHOTO,
} as const

/**
 * How the catalogue and every related strip order themselves.
 *
 * Featured first, then most recently published — which for a listing means
 * `updatedAt`, since publishing is itself an update. Ordering is stable
 * because `id` breaks ties; without it, two vehicles saved in the same
 * second could swap places between page loads and appear twice or not at
 * all across a paginated crawl.
 */
const CARD_ORDER_BY = [
  { isFeatured: "desc" },
  { updatedAt: "desc" },
  { id: "asc" },
] satisfies Prisma.VehicleOrderByWithRelationInput[]

/**
 * How many words of a free-text query are actually used.
 *
 * Each word becomes its own `ILIKE` pair, so the cost of a query is linear
 * in the number of words. Six is past anything a real search needs
 * ("toyota land cruiser prado 2019" is four) and stops a hand-edited URL
 * turning one page load into eighty sequential scans.
 */
const SEARCH_TERM_LIMIT = 6

/** A four-digit word, which is the only thing that can be a model year. */
const YEAR_LIKE = /^\d{4}$/

/**
 * Splits a free-text query into the words that will be matched.
 *
 * Exported for the unit tests: the tokenising rules (word limit, year
 * detection, wildcard escaping) are the part of the search most likely to
 * be changed later by someone who cannot see the query it produces.
 */
export function vehicleSearchTerms(
  query: string | undefined
): { pattern: string; year: number | null }[] {
  if (!query) return []

  return query
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, SEARCH_TERM_LIMIT)
    .map((word) => {
      const year = YEAR_LIKE.test(word) ? Number(word) : null

      return {
        pattern: escapeLikePattern(word),
        // Bounded by the same range a listing can actually hold, so "1234"
        // is treated as text rather than as a year no vehicle has.
        year:
          year !== null && year >= VEHICLE_YEAR_MIN && year <= vehicleYearMax()
            ? year
            : null,
      }
    })
}

/**
 * Turns the parsed search criteria into a `where` fragment (Stage 12).
 *
 * ── The dropdowns: case-insensitive equality, not `contains` ──────────
 * The filter bar is a set of dropdowns whose options are the makes, models
 * and years that actually exist in the published inventory, so the value is
 * a whole make or a whole model — never a fragment. `contains` would make
 * "Prado" also match a hypothetical "Land Cruiser Prado SX", which reads as
 * a feature until it silently matches something the customer did not pick.
 *
 * Insensitive because the URL is hand-editable and shared: `?make=toyota`
 * typed into a phone must find the same cars as the dropdown's "Toyota".
 *
 * ── The search box: every word must match something ───────────────────
 * `q` is one field standing in for three, so each word is matched against
 * make, model *or* year (an OR), and the words are then ANDed together.
 * That is what makes "harrier 2021" mean "a Harrier, from 2021" rather than
 * "anything Harrier-ish or anything from 2021" — the second reading returns
 * the whole 2021 floor and reads as a search that ignored half the query.
 *
 * Here `contains` is right where `equals` was right above: a customer
 * typing into a box is working from memory and half a name ("cruis") is a
 * legitimate query, whereas a dropdown hands back a whole value.
 *
 * Case is handled by `mode: "insensitive"` rather than by lower-casing the
 * input, so "HARRIER", "Harrier" and "harrier" are one search.
 *
 * ── A note for when the inventory grows ───────────────────────────────
 * `mode: "insensitive"` compiles to `ILIKE`, which neither the
 * `[make, model]` B-tree nor a plain index can serve — and with `contains`
 * the pattern is leading-wildcard, so no B-tree ever could. Both are
 * sequential scans. On a single dealership's inventory — hundreds of rows,
 * not millions — that is microseconds, and the page reads only one bounded
 * page of results at a time. If this ever holds tens of thousands of
 * vehicles, the fix is a `pg_trgm` GIN index on `make` and `model` (which
 * *does* serve a leading-wildcard `ILIKE`), not a change to this logic.
 *
 * Filters are ANDed with each other and with the search box: typing
 * "harrier" and then choosing 2021 returns the vehicles matching both,
 * which is the "Toyota → Harrier → 2021" journey from the brief.
 */
export function vehicleSearchWhere(
  criteria: VehicleSearchCriteria,
  /** Settings → Catalogue display. A year hidden site-wide is never searched. */
  siteWide: Visibility<VehicleInfoField> = DEFAULT_VEHICLE_VISIBILITY
): PublicVehicleFilters {
  const where: PublicVehicleFilters = {}

  const terms = vehicleSearchTerms(criteria.q)

  if (terms.length > 0) {
    where.AND = terms.map(({ pattern, year }) => ({
      OR: [
        { make: { contains: pattern, mode: "insensitive" } },
        { model: { contains: pattern, mode: "insensitive" } },
        // A listing whose year is hidden must not be findable by it — the
        // match would tell the customer the year.
        ...(year === null || !siteWide.year ? [] : [{ year, ...YEAR_SHOWN }]),
      ],
    }))
  }

  if (criteria.make) {
    where.make = { equals: criteria.make, mode: "insensitive" }
  }

  if (criteria.model) {
    where.model = { equals: criteria.model, mode: "insensitive" }
  }

  // Ignored outright while the year is hidden site-wide: the filter is not
  // offered, and a hand-edited URL must not become a way to probe for it.
  if (criteria.year && siteWide.year) {
    where.year = criteria.year
    where.NOT = YEAR_SHOWN.NOT
  }

  return where
}

/** Listings that have not hidden their own year. */
const YEAR_SHOWN = { NOT: { hiddenFields: { has: "year" } } } satisfies PublicVehicleFilters

/** Settings → Catalogue display → Vehicles. Cached with the rest of the settings. */
async function siteWideVisibility(): Promise<Visibility<VehicleInfoField>> {
  return (await getPublicSiteSettings()).catalogDisplay.vehicle
}

/** A page of live listings, in `CARD_ORDER_BY` order. */
export async function listPublishedVehicles(options?: {
  page?: number
  filters?: PublicVehicleFilters
  /**
   * Customer-supplied narrowing. Kept separate from `filters` so a caller
   * cannot accidentally hand a raw query string straight through as a Prisma
   * fragment — everything here has been through `vehicleSearchSchema` first.
   */
  criteria?: VehicleSearchCriteria
}): Promise<PublicVehicleListResult> {
  const page = Math.max(1, options?.page ?? 1)
  const siteWide = await siteWideVisibility()

  /**
   * Composed through `AND` rather than by spreading both objects into one.
   *
   * A spread makes the two fragments share a key space, and the search
   * fragment now owns `AND` — so a caller-supplied filter using the same
   * key would be silently dropped by whichever object was spread second.
   * Nesting them keeps each fragment intact whatever either one contains,
   * and `publicVehicleWhere` still pins the status on the outside where no
   * caller can reach it.
   */
  const where = publicVehicleWhere({
    AND: [
      options?.filters ?? {},
      options?.criteria ? vehicleSearchWhere(options.criteria, siteWide) : {},
    ],
  })

  const [total, rows] = await prisma.$transaction([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      orderBy: CARD_ORDER_BY,
      skip: (page - 1) * PUBLIC_VEHICLES_PER_PAGE,
      take: PUBLIC_VEHICLES_PER_PAGE,
      select: CARD_SELECT,
    }),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PUBLIC_VEHICLES_PER_PAGE))

  /**
   * A page past the end of the result set returns the last real page.
   *
   * `?page=99` on a three-page catalogue otherwise returns nothing, and the
   * catalogue renders "No vehicles match those filters" over an empty grid
   * — telling a customer their search failed when it matched three pages of
   * vehicles. It is reachable from a stale bookmark, from a crawler
   * following an old link, and from anyone who edits the address.
   *
   * ── Why clamped here rather than redirected by the page ───────────────
   * A `redirect()` in the catalogue page cannot work: `loading.tsx` opens a
   * Suspense boundary over that segment, so the response is already
   * committed by the time this query resolves, and the redirect surfaces as
   * a caught error inside a 200 rather than as a 3xx. Clamping depends on
   * no streaming behaviour at all, and cannot be broken by a boundary
   * someone adds later.
   *
   * The extra read costs one query, and only on the out-of-range request
   * that would otherwise have rendered nothing at all. Duplicate addresses
   * are not an SEO problem here: every catalogue view already declares
   * `/cars` as its canonical.
   */
  if (page > pageCount) {
    const lastPage = await prisma.vehicle.findMany({
      where,
      orderBy: CARD_ORDER_BY,
      skip: (pageCount - 1) * PUBLIC_VEHICLES_PER_PAGE,
      take: PUBLIC_VEHICLES_PER_PAGE,
      select: CARD_SELECT,
    })

    return {
      vehicles: lastPage.map((row) => toCard(row, siteWide)),
      total,
      page: pageCount,
      pageCount,
    }
  }

  return {
    vehicles: rows.map((row) => toCard(row, siteWide)),
    total,
    page,
    pageCount,
  }
}

/**
 * How many vehicles the "You may also like" strip shows.
 *
 * Eight. The strip scrolls horizontally rather than wrapping into a grid,
 * so it is not sized to a row any more — it is sized to how far someone
 * will reasonably swipe before going back to the catalogue, which is where
 * a longer list belongs. Eight also keeps the payload honest: each card
 * costs a row and a photograph, and nobody reaches the fortieth suggestion
 * at the bottom of a page they arrived at for one specific car.
 */
export const RELATED_VEHICLES_LIMIT = 8

/**
 * Other live listings a customer looking at this one may also want.
 *
 * "Similar" is the make, and only the make. It is the crudest possible
 * definition and deliberately so: this business imports from auction, so
 * the inventory is a handful of vehicles per make at any moment, and a
 * narrower rule (same make *and* a price band, say) would return nothing
 * most of the time. A strip that is usually empty is worse than a strip
 * that is occasionally loose. Model, price proximity and body type become
 * worth adding when the inventory is large enough to support them.
 *
 * ── Two guarantees this must not lose ─────────────────────────────────
 * The visibility clause comes from `publicVehicleWhere`, exactly as every
 * other public read does — a related strip is as capable of leaking a
 * draft or a sold vehicle as a catalogue page is, and it would be leaking
 * it onto a page the customer is already reading.
 *
 * `excludeSlug` keeps the vehicle out of its own suggestions. Both
 * arguments come from the already-loaded vehicle row rather than from a
 * URL, so neither is customer-controlled — but they are still passed
 * through Prisma's parameterised query builder rather than interpolated,
 * so a make containing a quote is a value, never syntax.
 */
export async function listRelatedVehicles({
  make,
  excludeSlug,
  limit = RELATED_VEHICLES_LIMIT,
}: {
  make: string
  excludeSlug: string
  limit?: number
}): Promise<PublicVehicleCard[]> {
  const [rows, siteWide] = await Promise.all([
    prisma.vehicle.findMany({
      where: publicVehicleWhere({ make, slug: { not: excludeSlug } }),
      orderBy: CARD_ORDER_BY,
      take: Math.max(0, limit),
      select: CARD_SELECT,
    }),
    siteWideVisibility(),
  ])

  return rows.map((row) => toCard(row, siteWide))
}

/** A live listing by its public slug, or null. */
export const getPublishedVehicleBySlug = cache(
  async (slug: string): Promise<PublicVehicleDetail | null> => {
    /**
     * `findFirst` with the visibility clause, not `findUnique` on the slug.
     *
     * The slug is unique, so `findUnique` would be the natural choice — and
     * would return a draft or a sold vehicle to anyone who had the URL,
     * leaving the page to remember to check. Making the status part of the
     * lookup means there is nothing to remember: an unpublished slug is
     * indistinguishable from one that does not exist.
     */
    const [vehicle, siteWide] = await Promise.all([prisma.vehicle.findFirst({
      where: publicVehicleWhere({ slug }),
      select: {
        slug: true,
        referenceNumber: true,
        make: true,
        model: true,
        year: true,
        price: true,
        mileageKm: true,
        fuelType: true,
        transmission: true,
        engineSize: true,
        driveType: true,
        exteriorColor: true,
        interiorColor: true,
        countryOfOrigin: true,
        currentLocation: true,
        condition: true,
        features: true,
        hiddenFields: true,
        /**
         * `shippingEstimate`, `clearingEstimate` and `otherChargesEst` are
         * deliberately NOT selected. The vehicle page no longer publishes
         * a delivered-price estimate — those figures move with freight
         * rates, the port and the destination, and the dealership is not
         * in a position to stand behind them before a specific vehicle has
         * been quoted. The columns remain, and an operator still fills
         * them in for internal use; leaving them out here is what makes it
         * impossible for a customer-facing component to start rendering
         * them again by accident.
         */
        description: true,
        photos: {
          where: { deletedAt: null },
          // Same ordering as the dashboard gallery: main image first, then
          // the supporting images in the order the operator arranged them.
          orderBy: [
            { isPrimary: "desc" as const },
            { displayOrder: "asc" as const },
            { createdAt: "asc" as const },
          ],
          select: {
            id: true,
            storagePath: true,
            altText: true,
            isPrimary: true,
            displayOrder: true,
            createdAt: true,
          },
        },
      },
    }), siteWideVisibility()])

    if (!vehicle) return null

    const visible = resolveVisibility(VEHICLE_INFO_FIELDS, siteWide, vehicle.hiddenFields)

    return {
      slug: vehicle.slug,
      referenceNumber: vehicle.referenceNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: shown(visible.year, vehicle.year),
      price: shown(visible.price, vehicle.price.toNumber()),
      mileageKm: shown(visible.mileage, vehicle.mileageKm),
      fuelType: shown(visible.fuelType, vehicle.fuelType),
      transmission: shown(visible.transmission, vehicle.transmission),
      engineSize: shown(visible.engine, vehicle.engineSize),
      driveType: shown(visible.driveType, vehicle.driveType),
      exteriorColor: shown(visible.exteriorColor, vehicle.exteriorColor),
      interiorColor: shown(visible.interiorColor, vehicle.interiorColor),
      countryOfOrigin: shown(visible.countryOfOrigin, vehicle.countryOfOrigin),
      currentLocation: shown(visible.location, vehicle.currentLocation),
      condition: shown(visible.condition, vehicle.condition),
      showAvailability: visible.availability,
      features: visible.features ? vehicle.features : [],
      description: shown(visible.description, vehicle.description),
      photos: vehicle.photos.map((photo) => ({
        ...photo,
        url: vehiclePhotoPublicUrl(photo.storagePath),
      })),
    }
  }
)

/** One listing. Every nullable fact is null when it is hidden — see the module note. */
export interface PublicVehicleDetail {
  slug: string
  referenceNumber: string
  make: string
  model: string
  year: number | null
  /** Null reads as "Price on request". */
  price: number | null
  mileageKm: number | null
  fuelType: string | null
  transmission: string | null
  engineSize: string | null
  driveType: string | null
  exteriorColor: string | null
  interiorColor: string | null
  countryOfOrigin: string | null
  currentLocation: string | null
  condition: VehicleCondition | null
  showAvailability: boolean
  /** The equipment list, in the order the operator entered it. Empty when hidden. */
  features: string[]
  description: string | null
  photos: {
    id: string
    url: string
    storagePath: string
    altText: string | null
    isPrimary: boolean
    displayOrder: number
    createdAt: Date
  }[]
}

interface CardRow {
  slug: string
  referenceNumber: string
  make: string
  model: string
  year: number
  price: Prisma.Decimal
  mileageKm: number
  fuelType: string
  transmission: string
  engineSize: string
  countryOfOrigin: string
  currentLocation: string
  hiddenFields: string[]
  photos: { storagePath: string; altText: string | null }[]
}

function toCard(row: CardRow, siteWide: Visibility<VehicleInfoField>): PublicVehicleCard {
  const photo = row.photos[0] ?? null
  const visible = resolveVisibility(VEHICLE_INFO_FIELDS, siteWide, row.hiddenFields)

  return {
    slug: row.slug,
    referenceNumber: row.referenceNumber,
    make: row.make,
    model: row.model,
    year: shown(visible.year, row.year),
    price: shown(visible.price, row.price.toNumber()),
    mileageKm: shown(visible.mileage, row.mileageKm),
    fuelType: shown(visible.fuelType, row.fuelType),
    transmission: shown(visible.transmission, row.transmission),
    engineSize: shown(visible.engine, row.engineSize),
    countryOfOrigin: shown(visible.countryOfOrigin, row.countryOfOrigin),
    currentLocation: shown(visible.location, row.currentLocation),
    showAvailability: visible.availability,
    photoUrl: photo ? vehiclePhotoPublicUrl(photo.storagePath) : null,
    photoAltText: photo?.altText ?? null,
  }
}

/**
 * The options the catalogue's filter bar offers (Stage 12).
 *
 * ── Why the options come from the inventory, not from a list ──────────
 * A dropdown of every make Toyota has ever built would let a customer
 * construct a search that cannot possibly match anything, and the honest
 * answer — "no results" — would read as a broken site rather than as an
 * empty shelf. Offering only what is actually published means every
 * selection leads somewhere, which is also what makes the three filters
 * usable in combination: choosing Toyota narrows the model list to the
 * Toyotas on the floor, and choosing Harrier narrows the years to the ones
 * a Harrier is listed for.
 *
 * The visibility rule is the same one every other public read uses. A make
 * that exists only on a draft or a sold vehicle must not appear here — it
 * would advertise stock that cannot be seen, and it would leak the shape of
 * unpublished inventory.
 */
export interface VehicleFacet {
  make: string
  model: string
  /** Null for listings whose year is hidden: they narrow by make and model only. */
  year: number | null
}

/**
 * Every published make/model/year combination, ordered for display.
 *
 * ── Why one flat query rather than three grouped ones ─────────────────
 * The filter bar needs the *relationships* between the three fields, not
 * three independent lists: which models belong to a make, which years belong
 * to a model. Three `groupBy` queries would return the lists but not the
 * links, so choosing "Toyota" could still offer "Sorento". One distinct
 * triple carries the whole tree, and the client narrows it without another
 * round trip — which matters on the mobile connections this audience uses.
 *
 * The payload is bounded by distinct combinations, not by inventory size: a
 * dealership holding two hundred vehicles has perhaps sixty distinct
 * triples, a few kilobytes. If that ever stops being true, the answer is to
 * fetch models and years on demand per selection, not to denormalise this.
 */
export const listVehicleFacets = cache(async (): Promise<VehicleFacet[]> => {
  const siteWide = await siteWideVisibility()

  const [dated, undated] = await Promise.all([
    siteWide.year
      ? prisma.vehicle.findMany({
          where: publicVehicleWhere(YEAR_SHOWN),
          // `distinct` collapses the duplicates that three vehicles of the
          // same make, model and year would otherwise produce.
          distinct: ["make", "model", "year"],
          select: { make: true, model: true, year: true },
        })
      : Promise.resolve([]),
    /**
     * Listings whose year may not be shown still belong under their make and
     * model — just never under a year, or choosing that year would reveal it.
     */
    prisma.vehicle.findMany({
      where: publicVehicleWhere(siteWide.year ? { hiddenFields: { has: "year" } } : {}),
      distinct: ["make", "model"],
      select: { make: true, model: true },
    }),
  ])

  const facets: VehicleFacet[] = [
    ...dated,
    ...undated.map((row) => ({ make: row.make, model: row.model, year: null })),
  ]

  // Make and model alphabetically, then the newest year first within a model:
  // someone shopping by year is almost always working downwards from the most
  // recent.
  return facets.sort(
    (a, b) =>
      a.make.localeCompare(b.make) ||
      a.model.localeCompare(b.model) ||
      (b.year ?? -Infinity) - (a.year ?? -Infinity)
  )
})
