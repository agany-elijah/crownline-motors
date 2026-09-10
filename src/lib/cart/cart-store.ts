import {
  CART_STORAGE_KEY,
  addToCart,
  parseStoredCart,
  removeFromCart,
  serializeCart,
  setCartQuantity,
  type CartItem,
  type CartItemInput,
} from "@/lib/cart/cart-storage"

/**
 * The basket as an external store, in the sense React means by that.
 *
 * ── Why this is not `useState` inside the provider ────────────────────
 * The basket's real home is `localStorage`, which is outside React. The
 * obvious shape — state initialised empty, an effect that reads storage and
 * calls `setState`, a second effect that writes it back — has three problems,
 * and only the first is cosmetic:
 *
 *   1. It is a cascading render on every mount: React commits an empty
 *      basket, then immediately re-renders with the real one.
 *   2. The write-back effect fires on mount with the *initial* empty value,
 *      so without a guard it erases the basket it has not read yet.
 *   3. Two components reading the same storage key hold two copies of it.
 *
 * `useSyncExternalStore` is the API built for exactly this: a snapshot that
 * lives outside React, a subscription for when it changes, and a separate
 * server snapshot. React uses `getServerCartSnapshot` for the server render
 * *and* for hydration, then switches to the real one — so there is no
 * hydration mismatch and no flash of an empty basket that was never empty.
 *
 * ── Module state, deliberately ────────────────────────────────────────
 * The snapshot is a module-level variable. That makes it a singleton per
 * browser tab, which is what a basket is: two components asking for it get
 * the same array identity, and a write from one re-renders both. It never
 * runs on the server (`getServerCartSnapshot` is what a server render gets),
 * so there is no cross-request leakage to worry about.
 */

/**
 * The server's answer, and the answer during hydration.
 *
 * Frozen and shared rather than a fresh `[]` each call: `getSnapshot` must
 * return a value that is `Object.is`-stable between calls or React re-renders
 * forever looking for it to settle.
 */
const EMPTY: readonly CartItem[] = Object.freeze([])

let snapshot: CartItem[] = EMPTY as CartItem[]
let loaded = false

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/**
 * Reads storage the first time a snapshot is asked for in the browser.
 *
 * Lazy rather than eager at module load, because this module is imported into
 * a bundle that also runs on the server, where `window` does not exist. After
 * the first call the value is cached and `getCartSnapshot` is a plain read.
 */
function ensureLoaded(): void {
  if (loaded) return

  loaded = true

  try {
    const stored = parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))

    // Only replaces the shared EMPTY when there is something to replace it
    // with, so an empty basket keeps a stable identity across reads.
    if (stored.length > 0) snapshot = stored
  } catch {
    // Private mode, a blocked-cookies setting, or a browser that throws on
    // access. An empty basket is the correct fallback and the site keeps
    // working — the customer can still browse, enquire and use WhatsApp.
    // `loaded` is already true, so this is not retried on every render.
  }
}

/** Writes the current snapshot back, and tells React. */
function commit(next: CartItem[]): void {
  snapshot = next

  try {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(next))
  } catch {
    // Quota exceeded, or storage unavailable. The basket still works for this
    // page view; it simply will not survive a reload. Not worth interrupting
    // the customer over.
  }

  emit()
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function getCartSnapshot(): CartItem[] {
  ensureLoaded()

  return snapshot
}

export function getServerCartSnapshot(): CartItem[] {
  return EMPTY as CartItem[]
}

/**
 * Whether storage has been read.
 *
 * Read through the same subscription, so a component can hold off rendering a
 * count until the real one is known rather than flickering from 0 to 3. It is
 * false during the server render and during hydration, and true from the
 * first client snapshot onwards.
 */
export function isCartLoaded(): boolean {
  return loaded
}

export function getServerCartLoaded(): boolean {
  return false
}

/**
 * Adds a part, or tops up the line already there.
 *
 * Returns whether anything changed, so the caller can tell the customer when
 * it did not — `addToCart` refuses silently at the line ceiling, and a button
 * that does nothing and says nothing is the worst version of that.
 */
export function addCartItem(item: CartItemInput, quantity = 1): boolean {
  ensureLoaded()

  const next = addToCart(snapshot, item, quantity)

  if (next === snapshot) return false

  commit(next)

  return true
}

export function setCartItemQuantity(slug: string, quantity: number): void {
  ensureLoaded()
  commit(setCartQuantity(snapshot, slug, quantity))
}

export function removeCartItem(slug: string): void {
  ensureLoaded()
  commit(removeFromCart(snapshot, slug))
}

export function clearCart(): void {
  ensureLoaded()
  commit([])
}
