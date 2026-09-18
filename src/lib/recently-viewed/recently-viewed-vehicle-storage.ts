/**
 * The vehicles a customer has looked at, as data.
 *
 * A deliberate mirror of `recently-viewed-storage.ts`, which does the same
 * job for spare parts — down to the shape of the exports. The duplication is
 * the point, and it is the same argument the schema makes for
 * `SparePartPhoto` beside `VehiclePhoto`: what the two share is the *idea* of
 * a viewing history, not a type. A car is identified by a make, a model and a
 * year; a part by a name. A generic entry that carried both would be a record
 * of mostly-null fields, and the ordering and parsing code they genuinely
 * share is thirty lines that have never needed to change together.
 *
 * Everything here is pure: no React, no browser globals, no imports with a
 * runtime side effect. The store in `recently-viewed-vehicle-store.ts` owns
 * the `localStorage` access and the subscription; this module owns what the
 * list *is*.
 *
 * ── Why the whole card is stored, not just the slug ───────────────────
 * A list of slugs would need a server round trip to render anything, on the
 * one strip on the page that nobody asked to see. Storing the card itself
 * means the strip renders instantly, costs no query, and still works for
 * someone whose connection dropped after the page loaded.
 *
 * A stored entry is a *snapshot*: a price that has since changed is stale
 * until the customer opens the vehicle again. Acceptable because this list
 * commits nobody to anything — opening the listing shows the live record, and
 * an order only ever exists once a quotation has been accepted.
 */

/** One remembered vehicle. A deliberate subset of the catalogue card. */
export interface RecentlyViewedVehicle {
  /** The vehicle's public slug — the identity, and what de-duplicates the list. */
  slug: string
  make: string
  model: string
  year: number | null
  /** Display copy of the listed price, or null for "Price on request". */
  price: number | null
  mileageKm: number | null
  imageUrl: string | null
  /** Epoch milliseconds. What the list is ordered by. */
  viewedAt: number
}

/**
 * The storage key, versioned, and separate from the parts one.
 *
 * Two keys rather than one list with a `kind` discriminator: a customer
 * clearing their car history has not asked to forget the brake pads they
 * shortlisted, and the two strips are bounded independently.
 */
export const RECENTLY_VIEWED_VEHICLES_STORAGE_KEY = "crownline.recentlyViewedVehicles.v1"

/** How many vehicles are remembered. Matches the parts list for consistency. */
export const MAX_RECENTLY_VIEWED_VEHICLES = 12

/**
 * How many the strip shows — all of them.
 *
 * Deliberately different from the parts strip, which shows six and links to a
 * "see all" page for the rest. There is no such page for vehicles, so a limit
 * below the stored maximum would put half a customer's history somewhere they
 * could never reach. The row scrolls horizontally, so twelve tiles costs no
 * vertical space; if a see-all page is ever added, this is the number to drop
 * back to six.
 */
export const RECENTLY_VIEWED_VEHICLES_STRIP_LIMIT = MAX_RECENTLY_VIEWED_VEHICLES

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** One stored object, if it is a usable entry. */
function toEntry(value: unknown): RecentlyViewedVehicle | null {
  if (typeof value !== "object" || value === null) return null

  const candidate = value as Record<string, unknown>

  if (!isNonEmptyString(candidate.slug)) return null
  if (!isNonEmptyString(candidate.make)) return null
  if (!isNonEmptyString(candidate.model)) return null

  /**
   * A missing or nonsensical timestamp sorts to the end rather than
   * disqualifying the entry: the vehicle is still something the customer
   * looked at, and the only thing lost is its place in the order.
   */
  const viewedAt = finiteNumberOrNull(candidate.viewedAt) ?? 0

  return {
    slug: candidate.slug,
    make: candidate.make,
    model: candidate.model,
    year: finiteNumberOrNull(candidate.year),
    price: finiteNumberOrNull(candidate.price),
    mileageKm: finiteNumberOrNull(candidate.mileageKm),
    imageUrl: isNonEmptyString(candidate.imageUrl) ? candidate.imageUrl : null,
    viewedAt,
  }
}

/**
 * Reads a history out of whatever string was in storage.
 *
 * Defensive for the same reason the parts parser and the basket parser are:
 * `localStorage` is the customer's, not ours. It survives deploys, it can be
 * edited by hand, it can be left behind by an older version of this site, and
 * it can be corrupted by a browser that ran out of quota mid-write. None of
 * those is an attack — there is nothing here worth attacking, since the list
 * buys nothing and proves nothing — but every one of them can crash a render
 * if trusted.
 */
export function parseStoredRecentlyViewedVehicles(raw: string | null): RecentlyViewedVehicle[] {
  if (!raw) return []

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  const entries: RecentlyViewedVehicle[] = []
  const seen = new Set<string>()

  for (const candidate of parsed) {
    const entry = toEntry(candidate)

    if (!entry) continue
    // A repeated slug would render the same vehicle twice in a strip of six.
    if (seen.has(entry.slug)) continue

    seen.add(entry.slug)
    entries.push(entry)
  }

  return entries.sort((a, b) => b.viewedAt - a.viewedAt).slice(0, MAX_RECENTLY_VIEWED_VEHICLES)
}

export function serializeRecentlyViewedVehicles(entries: RecentlyViewedVehicle[]): string {
  return JSON.stringify(entries)
}

/** The part of an entry that describes it — everything but when it was seen. */
export type RecentlyViewedVehicleInput = Omit<RecentlyViewedVehicle, "viewedAt">

/**
 * Records a view, moving the vehicle to the front.
 *
 * Re-viewing one already in the list moves it rather than adding a second
 * copy, and refreshes the stored fields from the page the customer is
 * currently looking at — by definition the freshest copy available.
 *
 * Returns the *same* array when nothing would change. That identity check is
 * what lets the store skip a write and a re-render when a customer reloads
 * the vehicle they are already on.
 */
export function recordVehicleView(
  entries: RecentlyViewedVehicle[],
  vehicle: RecentlyViewedVehicleInput,
  viewedAt: number
): RecentlyViewedVehicle[] {
  const existing = entries[0]

  /**
   * `viewedAt` is deliberately excluded from the comparison: bumping a
   * timestamp that nothing displays, on a list already in the right order, is
   * a write for no observable difference.
   */
  if (
    existing &&
    existing.slug === vehicle.slug &&
    existing.make === vehicle.make &&
    existing.model === vehicle.model &&
    existing.year === vehicle.year &&
    existing.price === vehicle.price &&
    existing.mileageKm === vehicle.mileageKm &&
    existing.imageUrl === vehicle.imageUrl
  ) {
    return entries
  }

  return [
    { ...vehicle, viewedAt },
    ...entries.filter((entry) => entry.slug !== vehicle.slug),
  ].slice(0, MAX_RECENTLY_VIEWED_VEHICLES)
}

export function removeRecentlyViewedVehicle(
  entries: RecentlyViewedVehicle[],
  slug: string
): RecentlyViewedVehicle[] {
  return entries.filter((entry) => entry.slug !== slug)
}

/** "2021 Toyota Harrier", or "Toyota Harrier" on a listing with no year. */
export function recentlyViewedVehicleTitle(vehicle: RecentlyViewedVehicle): string {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")
}
