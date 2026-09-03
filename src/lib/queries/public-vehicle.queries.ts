import "server-only"

import { cache } from "react"

import type { Prisma } from "@/generated/prisma/client"
import type { VehicleCondition } from "@/generated/prisma/enums"
import { VehicleStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { vehiclePhotoPublicUrl } from "@/lib/storage/vehicle-media"
import type { VehicleSearchCriteria } from "@/lib/validations/vehicle-search.schema"

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

/** A vehicle as the marketplace card shows it (brief §4). */
export interface PublicVehicleCard {
  slug: string
  referenceNumber: string
  make: string
  model: string
  year: number
  price: number
  mileageKm: number
  fuelType: string
  transmission: string
  engineSize: string
  countryOfOrigin: string
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
 * Turns the parsed search criteria into a `where` fragment (Stage 12).
 *
 * ── Why case-insensitive equality, not `contains` ─────────────────────
 * The filter bar is a set of dropdowns whose options are the makes, models
 * and years that actually exist in the published inventory, so the value is
 * a whole make or a whole model — never a fragment. `contains` would make
 * "Prado" also match a hypothetical "Land Cruiser Prado SX", which reads as
 * a feature until it silently matches something the customer did not pick.
 *
 * Insensitive because the URL is hand-editable and shared: `?make=toyota`
 * typed into a phone must find the same cars as the dropdown's "Toyota".
 *
 * ── A note for when the inventory grows ───────────────────────────────
 * `mode: "insensitive"` compiles to `ILIKE` with no wildcards, which neither
 * the `[make, model]` B-tree nor the trigram GIN indexes can serve, so this
 * is a sequential scan. On a single dealership's inventory — hundreds of
 * rows, not millions — that is microseconds and not worth an index. If this
 * ever holds tens of thousands of vehicles, the fix is a functional index on
 * `lower("make")` / `lower("model")`, not a change to this logic.
 *
 * Filters are ANDed: choosing a make, a model and a year returns the
 * vehicles matching all three, which is the "Toyota → Harrier → 2021"
 * journey from the brief.
 */
export function vehicleSearchWhere(
  criteria: VehicleSearchCriteria
): PublicVehicleFilters {
  const where: PublicVehicleFilters = {}

  if (criteria.make) {
    where.make = { equals: criteria.make, mode: "insensitive" }
  }

  if (criteria.model) {
    where.model = { equals: criteria.model, mode: "insensitive" }
  }

  if (criteria.year) {
    where.year = criteria.year
  }

  return where
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
  const where = publicVehicleWhere({
    ...options?.filters,
    ...(options?.criteria ? vehicleSearchWhere(options.criteria) : {}),
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

  return {
    vehicles: rows.map(toCard),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PUBLIC_VEHICLES_PER_PAGE)),
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
  const rows = await prisma.vehicle.findMany({
    where: publicVehicleWhere({ make, slug: { not: excludeSlug } }),
    orderBy: CARD_ORDER_BY,
    take: Math.max(0, limit),
    select: CARD_SELECT,
  })

  return rows.map(toCard)
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
    const vehicle = await prisma.vehicle.findFirst({
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
    })

    if (!vehicle) return null

    return {
      ...vehicle,
      price: vehicle.price.toNumber(),
      photos: vehicle.photos.map((photo) => ({
        ...photo,
        url: vehiclePhotoPublicUrl(photo.storagePath),
      })),
    }
  }
)

export interface PublicVehicleDetail {
  slug: string
  referenceNumber: string
  make: string
  model: string
  year: number
  price: number
  mileageKm: number
  fuelType: string
  transmission: string
  engineSize: string
  driveType: string
  exteriorColor: string
  interiorColor: string
  countryOfOrigin: string
  currentLocation: string
  condition: VehicleCondition
  /** The equipment list, in the order the operator entered it. */
  features: string[]
  description: string
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
  photos: { storagePath: string; altText: string | null }[]
}

function toCard(row: CardRow): PublicVehicleCard {
  const photo = row.photos[0] ?? null

  return {
    slug: row.slug,
    referenceNumber: row.referenceNumber,
    make: row.make,
    model: row.model,
    year: row.year,
    price: row.price.toNumber(),
    mileageKm: row.mileageKm,
    fuelType: row.fuelType,
    transmission: row.transmission,
    engineSize: row.engineSize,
    countryOfOrigin: row.countryOfOrigin,
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
  year: number
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
  const rows = await prisma.vehicle.findMany({
    where: publicVehicleWhere(),
    // `distinct` collapses the duplicates that three vehicles of the same
    // make, model and year would otherwise produce.
    distinct: ["make", "model", "year"],
    select: { make: true, model: true, year: true },
    orderBy: [
      { make: "asc" },
      { model: "asc" },
      // Newest year first within a model: someone shopping by year is
      // almost always working downwards from the most recent.
      { year: "desc" },
    ],
  })

  return rows
})
