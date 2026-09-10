"use client"

import * as React from "react"
import { CheckCircle2 } from "lucide-react"

import {
  MAX_CART_LINES,
  cartItemCount,
  cartSubtotal,
  type CartItem,
  type CartItemInput,
} from "@/lib/cart/cart-storage"
import {
  addCartItem,
  clearCart,
  getCartSnapshot,
  getServerCartLoaded,
  getServerCartSnapshot,
  isCartLoaded,
  removeCartItem,
  setCartItemQuantity,
  subscribeCart,
} from "@/lib/cart/cart-store"

/**
 * The spare-parts basket, and the confirmation it shows.
 *
 * ── Why the basket lives in the browser ───────────────────────────────
 * Adding a part commits the customer to nothing: no row is written, no stock
 * is held, no price is locked. It is a shortlist. Wave A has no customer
 * accounts, so there is no one to attach a server-side basket *to* — and
 * inventing an anonymous-session table to hold it would be a second commerce
 * store beside the one the schema already defines, which is the thing the
 * architecture is explicitly built to avoid.
 *
 * `localStorage` is therefore the right home: it survives a reload and a
 * closed tab, it costs no round trip on a connection where round trips are
 * the expensive part, and it disappears with the browser it belongs to. When
 * customer accounts arrive (Wave B), this provider is where a basket gets
 * synced to the account — the components above it ask for `useCart()` and
 * would not change.
 *
 * ── What this component actually owns ─────────────────────────────────
 * Not the items. Those live in `lib/cart/cart-store.ts` and are read through
 * `useSyncExternalStore`, which is the API for state that lives outside React
 * — see the note there for why an effect that reads storage and calls
 * `setState` is the wrong shape for this.
 *
 * What this owns is the confirmation. "Added to cart" is announced here
 * rather than by each button, so one live region exists on the page instead
 * of one per card: twenty-four polite live regions is how a screen reader
 * ends up announcing nothing at all.
 */

interface CartContextValue {
  items: CartItem[]
  /** Total units — what the basket badge shows. */
  count: number
  /** Listed-price total, plus how many lines have no listed price. */
  subtotal: { total: number; quotedLines: number }
  /** False during the server render and hydration, true once storage has
   *  been read. A badge should stay silent until then rather than flickering
   *  from 0 to 3. */
  ready: boolean
  add: (item: CartItemInput, quantity?: number) => void
  setQuantity: (slug: string, quantity: number) => void
  remove: (slug: string) => void
  clear: () => void
}

const CartContext = React.createContext<CartContextValue | null>(null)

/** How long a confirmation stays on screen. Long enough to read a part name
 *  at a glance, short enough not to sit over the next card being tapped. */
const TOAST_DURATION_MS = 3200

interface ToastState {
  /** Bumped on every message so a repeated add re-announces and re-animates. */
  id: number
  message: string
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = React.useSyncExternalStore(
    subscribeCart,
    getCartSnapshot,
    getServerCartSnapshot
  )

  const ready = React.useSyncExternalStore(
    subscribeCart,
    isCartLoaded,
    getServerCartLoaded
  )

  const [toast, setToast] = React.useState<ToastState | null>(null)

  /** Shows one confirmation, replacing any that is still on screen. */
  const announce = React.useCallback((message: string) => {
    setToast((current) => ({ id: (current?.id ?? 0) + 1, message }))
  }, [])

  React.useEffect(() => {
    if (!toast) return

    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS)

    // Cleared on every change of `toast.id`, so a second add restarts the
    // clock rather than inheriting the first one's remaining time.
    return () => window.clearTimeout(timer)
  }, [toast])

  const add = React.useCallback(
    (item: CartItemInput, quantity = 1) => {
      const added = addCartItem(item, quantity)

      announce(
        added
          ? `${item.name} added to cart`
          : `Your list already holds ${MAX_CART_LINES} different parts. Remove one to add another.`
      )
    },
    [announce]
  )

  const value = React.useMemo<CartContextValue>(
    () => ({
      items,
      count: cartItemCount(items),
      subtotal: cartSubtotal(items),
      ready,
      add,
      setQuantity: setCartItemQuantity,
      remove: removeCartItem,
      clear: clearCart,
    }),
    [items, ready, add]
  )

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartToast toast={toast} />
    </CartContext.Provider>
  )
}

/**
 * Reads the basket.
 *
 * Throws rather than returning a null-object fallback. A component that calls
 * this outside the provider is a mounting mistake, and a silent fallback
 * would present a basket that accepts parts and forgets them — a bug that
 * looks like it works.
 */
export function useCart(): CartContextValue {
  const context = React.useContext(CartContext)

  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>.")
  }

  return context
}

/**
 * The confirmation.
 *
 * ── Placement ─────────────────────────────────────────────────────────
 * Bottom centre on a phone, bottom right from `sm`. It deliberately clears
 * the WhatsApp floating button, which sits bottom-right on every public page,
 * rather than covering the one control the business most wants pressed.
 *
 * ── Announcing it ─────────────────────────────────────────────────────
 * `role="status"` with `aria-live="polite"`, and the region is always in the
 * DOM — only its contents change. A live region that is mounted at the same
 * moment its message appears is frequently not announced at all, because the
 * screen reader had nothing to observe a change *to*.
 *
 * `pointer-events-none` so it can never intercept a tap meant for the card
 * underneath it while it is fading out.
 */
function CartToast({ toast }: { toast: ToastState | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:right-6 sm:bottom-6 sm:left-auto sm:justify-end sm:px-0"
    >
      {toast ? (
        <div
          // Keyed by id so a repeated add remounts the element and replays the
          // entrance, rather than silently swapping the text in place.
          key={toast.id}
          className="flex max-w-sm items-center gap-2.5 rounded-lg border border-border bg-foreground px-4 py-3 text-small font-medium text-background shadow-lg duration-base animate-in fade-in-0 slide-in-from-bottom-2"
        >
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-gold" />
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  )
}
