import {
  RECENTLY_VIEWED_VEHICLES_STORAGE_KEY,
  parseStoredRecentlyViewedVehicles,
  recordVehicleView,
  serializeRecentlyViewedVehicles,
  type RecentlyViewedVehicle,
  type RecentlyViewedVehicleInput,
} from "@/lib/recently-viewed/recently-viewed-vehicle-storage"

/**
 * The vehicle viewing history as an external store, in the sense React means
 * by that.
 *
 * A deliberate mirror of `recently-viewed-store.ts` (parts) and, through it,
 * of `lib/cart/cart-store.ts`. The reasoning in those files applies
 * unchanged: the real home of this data is `localStorage`, which is outside
 * React, and the obvious `useState` + effect shape cascades a render on every
 * mount, writes an empty value back before it has read anything, and gives
 * two components two copies of one list.
 *
 * `useSyncExternalStore` is the API built for exactly this — a snapshot that
 * lives outside React, a subscription for when it changes, and a separate
 * server snapshot so there is no hydration mismatch and no flash of an empty
 * strip that was never empty.
 *
 * Three stores rather than one generic one, for the reason the parts store
 * already sets out: they hold different shapes under different keys, and the
 * ten lines they have in common are subscription boilerplate. A shared
 * abstraction over them would be indirection over a `Set` of callbacks.
 */

/**
 * The server's answer, and the answer during hydration.
 *
 * Frozen and shared rather than a fresh `[]` each call: `getSnapshot` must
 * return a value that is `Object.is`-stable between calls, or React
 * re-renders forever waiting for it to settle.
 */
const EMPTY: readonly RecentlyViewedVehicle[] = Object.freeze([])

let snapshot: RecentlyViewedVehicle[] = EMPTY as RecentlyViewedVehicle[]
let loaded = false

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/**
 * Reads storage the first time a snapshot is asked for in the browser.
 *
 * Lazy rather than eager at module load, because this module is imported into
 * a bundle that also runs on the server, where `window` does not exist.
 */
function ensureLoaded(): void {
  if (loaded) return

  loaded = true

  try {
    const stored = parseStoredRecentlyViewedVehicles(
      window.localStorage.getItem(RECENTLY_VIEWED_VEHICLES_STORAGE_KEY)
    )

    // Only replaces the shared EMPTY when there is something to replace it
    // with, so an empty history keeps a stable identity across reads.
    if (stored.length > 0) snapshot = stored
  } catch {
    // Private mode, blocked site data, or a browser that throws on access.
    // An empty history is the correct fallback and nothing else on the page
    // is affected — this is the least important state the site holds.
  }
}

function commit(next: RecentlyViewedVehicle[]): void {
  snapshot = next

  try {
    window.localStorage.setItem(
      RECENTLY_VIEWED_VEHICLES_STORAGE_KEY,
      serializeRecentlyViewedVehicles(next)
    )
  } catch {
    // Quota exceeded, or storage unavailable. The strip still works for this
    // page view; it simply will not survive a reload. Not worth interrupting
    // a customer over, and not worth a console line on every navigation.
  }

  emit()
}

export function subscribeRecentlyViewedVehicles(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function getRecentlyViewedVehiclesSnapshot(): RecentlyViewedVehicle[] {
  ensureLoaded()

  return snapshot
}

export function getServerRecentlyViewedVehiclesSnapshot(): RecentlyViewedVehicle[] {
  return EMPTY as RecentlyViewedVehicle[]
}

/**
 * Whether storage has been read. False during the server render and during
 * hydration, so a strip can stay silent rather than flashing in empty.
 */
export function isRecentlyViewedVehiclesLoaded(): boolean {
  return loaded
}

export function getServerRecentlyViewedVehiclesLoaded(): boolean {
  return false
}

/**
 * Records that a vehicle was viewed.
 *
 * No-ops when nothing would change — re-opening the vehicle already at the
 * front of the list. That is what keeps a page reload from writing to storage
 * and re-rendering the strip for no observable difference.
 */
export function recordRecentlyViewedVehicle(vehicle: RecentlyViewedVehicleInput): void {
  ensureLoaded()

  const next = recordVehicleView(snapshot, vehicle, Date.now())

  if (next === snapshot) return

  commit(next)
}

/*
 * There is deliberately no `forget` or `clear` here.
 *
 * The parts store has both because the parts "see all" page offers a remove
 * and a clear. Vehicles have no such page — the strip shows the whole
 * history — so exporting them would be two functions with no caller, which
 * the next person has to read before discovering they do nothing.
 * `removeRecentlyViewedVehicle` in the storage module is where the logic
 * lives when a surface needs it.
 */
