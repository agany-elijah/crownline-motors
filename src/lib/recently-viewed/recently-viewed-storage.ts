/**
 * The parts a customer has looked at, as data.
 *
 * Everything here is pure: no React, no browser globals, no imports with a
 * runtime side effect. The store in `recently-viewed-store.ts` owns the
 * `localStorage` access and the subscription; this module owns what the list
 * *is* — which is the part worth unit-testing, because it is where the
 * ordering, the de-duplication and the parsing of whatever happens to be in
 * storage actually live.
 *
 * ── Why the whole card is stored, not just the slug ───────────────────
 * A list of slugs would need a server round trip to render anything, on the
 * one strip on the page that nobody asked to see. Storing the card itself
 * means the strip renders instantly, costs no query, and still works for
 * someone whose connection dropped after the page loaded — which on the
 * connections this business runs on is a normal afternoon.
 *
 * The cost is that a stored entry is a *snapshot*: a price or an availability
 * state that has since changed will be stale until the customer opens the
 * part again. That is acceptable precisely because this list commits nobody
 * to anything — it is a memory aid, not a quotation. Opening the part shows
 * the live listing, and the basket is priced by the server regardless (see
 * `cart-storage.ts`). An entry is refreshed every time the part is viewed,
 * so the staleness window is one visit wide.
 *
 * ── Why it is not the basket ──────────────────────────────────────────
 * The basket is an intention; this is a trail. Merging them would mean either
 * a basket that fills itself with everything glanced at, or a history that
 * disappears when a part is removed from the basket. They are separate keys
 * and separate stores for that reason.
 */

/** One remembered part. A deliberate subset of the catalogue card. */
export interface RecentlyViewedPart {
  /** The part's public slug — the identity, and what de-duplicates the list. */
  slug: string
  name: string
  /** Display copy of the listed price, or null for a part priced on enquiry. */
  price: number | null
  imageUrl: string | null
  /** Epoch milliseconds. What the list is ordered by. */
  viewedAt: number
}

/**
 * The storage key, versioned.
 *
 * A `.v1` suffix so that if the shape of an entry ever changes, the new build
 * reads a fresh key rather than trying to interpret last month's objects.
 * Dropping a viewing history is a completely acceptable migration.
 */
export const RECENTLY_VIEWED_STORAGE_KEY = "crownline.recentlyViewed.v1"

/**
 * How many parts are remembered.
 *
 * Twelve, matching the "More in this category" strip directly above it, so
 * the two rows below a part page are the same length and the page does not
 * end on a lopsided pair. It is also about as far back as a "recently viewed"
 * list stays useful — past a dozen it is browsing history, which is a
 * different and much less welcome thing to show someone.
 */
export const MAX_RECENTLY_VIEWED = 12

/**
 * How many the strip itself shows before the "see all" link.
 *
 * Deliberately fewer than are stored: the strip highlights the most recent
 * handful, and the link is what reaches the rest. A strip that always showed
 * everything would make the link pointless.
 */
export const RECENTLY_VIEWED_STRIP_LIMIT = 6

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

/** One stored object, if it is a usable entry. */
function toEntry(value: unknown): RecentlyViewedPart | null {
  if (typeof value !== "object" || value === null) return null

  const candidate = value as Record<string, unknown>

  if (!isNonEmptyString(candidate.slug)) return null
  if (!isNonEmptyString(candidate.name)) return null

  const price =
    typeof candidate.price === "number" && Number.isFinite(candidate.price)
      ? candidate.price
      : null

  const imageUrl = isNonEmptyString(candidate.imageUrl) ? candidate.imageUrl : null

  /**
   * A missing or nonsensical timestamp sorts to the end rather than
   * disqualifying the entry: the part is still something the customer looked
   * at, and the only thing lost is its exact position in the list.
   */
  const viewedAt =
    typeof candidate.viewedAt === "number" && Number.isFinite(candidate.viewedAt)
      ? candidate.viewedAt
      : 0

  return { slug: candidate.slug, name: candidate.name, price, imageUrl, viewedAt }
}

/**
 * Reads a history out of whatever string was in storage.
 *
 * Defensive for the same reasons the basket parser is: `localStorage` is the
 * customer's, not ours. It survives deploys, it can be edited by hand, it can
 * be left behind by an older version of this site, and it can be corrupted by
 * a browser that ran out of quota mid-write. None of those is an attack —
 * there is nothing here worth attacking, since the list buys nothing and
 * proves nothing — but every one of them can crash a render if trusted.
 *
 * A bad entry is dropped and the rest are kept. The result is sorted
 * newest-first and truncated, so a hand-edited file cannot produce a strip of
 * two hundred cards.
 */
export function parseStoredRecentlyViewed(raw: string | null): RecentlyViewedPart[] {
  if (!raw) return []

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  const entries: RecentlyViewedPart[] = []
  const seen = new Set<string>()

  for (const candidate of parsed) {
    const entry = toEntry(candidate)

    if (!entry) continue
    // A repeated slug would render the same part twice in a strip of six.
    if (seen.has(entry.slug)) continue

    seen.add(entry.slug)
    entries.push(entry)
  }

  return entries
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, MAX_RECENTLY_VIEWED)
}

export function serializeRecentlyViewed(entries: RecentlyViewedPart[]): string {
  return JSON.stringify(entries)
}

/** The part of an entry that describes it — everything but when it was seen. */
export type RecentlyViewedInput = Omit<RecentlyViewedPart, "viewedAt">

/**
 * Records a view, moving the part to the front.
 *
 * Re-viewing a part already in the list moves it rather than adding a second
 * copy, and refreshes its stored name, price and photograph from the page the
 * customer is currently looking at — which is by definition the freshest copy
 * available.
 *
 * Returns a new array, and returns the *same* array when nothing would
 * change. That identity check is what lets the store skip a write and a
 * re-render when a customer reloads the part they are already on.
 */
export function recordView(
  entries: RecentlyViewedPart[],
  part: RecentlyViewedInput,
  viewedAt: number
): RecentlyViewedPart[] {
  const existing = entries[0]

  /**
   * Already at the front, with nothing about it changed. Reloading a part
   * page should not rewrite storage or re-render the strip.
   *
   * `viewedAt` is deliberately excluded from the comparison: bumping a
   * timestamp that nothing displays, on a list that is already in the right
   * order, is a write for no observable difference.
   */
  if (
    existing &&
    existing.slug === part.slug &&
    existing.name === part.name &&
    existing.price === part.price &&
    existing.imageUrl === part.imageUrl
  ) {
    return entries
  }

  return [
    { ...part, viewedAt },
    ...entries.filter((entry) => entry.slug !== part.slug),
  ].slice(0, MAX_RECENTLY_VIEWED)
}

export function removeRecentlyViewed(
  entries: RecentlyViewedPart[],
  slug: string
): RecentlyViewedPart[] {
  return entries.filter((entry) => entry.slug !== slug)
}
