/**
 * The spare-parts basket, as data.
 *
 * Everything here is pure: no React, no browser globals, no imports with a
 * runtime side effect. The provider in `components/cart/cart-provider.tsx`
 * owns the state and the storage; this module owns what a basket *is* and
 * what each operation on one does — which is the part worth unit-testing,
 * because it is where quantity clamping, de-duplication and the parsing of
 * whatever happens to be in `localStorage` actually live.
 *
 * ── What this basket is, and is not ───────────────────────────────────
 * It is a staging area held in the customer's own browser. It is not an
 * `Order`: no row is written, no stock is reserved, no price is locked in.
 * That is the correct shape for this stage of the roadmap — an order is
 * created when a quotation is accepted (see the schema documentation), and
 * inventing a second path that mints orders from a browser would be exactly
 * the duplicated commerce system the architecture exists to avoid.
 *
 * It follows that a price stored here is a *display* copy of what the
 * catalogue showed. Nothing is ever charged from it. When the basket is
 * turned into a quotation, the server re-reads every part by slug and prices
 * it itself; a tampered `localStorage` therefore buys a customer nothing but
 * a wrong number on their own screen.
 */

/** One line of the basket. */
export interface CartItem {
  /** The part's public slug — the identity the server can resolve. */
  slug: string
  name: string
  referenceNumber: string
  /** Display copy of the listed price, or null for a quoted part. */
  price: number | null
  imageUrl: string | null
  quantity: number
}

/**
 * The storage key, versioned.
 *
 * A `.v1` suffix so that if the shape of a line ever changes, the new build
 * reads a fresh key rather than trying to interpret last month's objects.
 * Dropping a basket is an acceptable migration; rendering a half-parsed one
 * is not.
 */
export const CART_STORAGE_KEY = "crownline.cart.v1"

/**
 * The most of one part a customer may put on one line of the basket.
 *
 * ── Where twenty comes from ───────────────────────────────────────────
 * It is the largest quantity of a single part this business sells to a
 * retail customer without the order becoming a different conversation. The
 * realistic ceilings underneath it: four wheels, five or six filters on a
 * service, eight spark plugs, a dozen bulbs. Twenty covers all of those with
 * room to spare and still refuses the shapes that are never a retail order —
 * a slipped keypress, or a workshop trying to buy stock through a form built
 * for one customer and one car.
 *
 * Above that is a trade enquiry with its own pricing and its own shipping,
 * and it belongs in Get a Quote where an operator can answer it — which is
 * exactly where the basket already leads. So this is not a wall: it is the
 * point at which the request stops fitting the control.
 *
 * It is deliberately **not** a stock check. The catalogue publishes an
 * availability state, not a count (see `SparePartAvailability`), and what we
 * can actually supply is confirmed on the quotation. A basket that silently
 * capped a line at what happened to be on the shelf this minute would be
 * making a promise nothing downstream keeps.
 */
export const MAX_ITEM_QUANTITY = 20

/**
 * The most distinct parts a basket may hold.
 *
 * A bound on what gets serialised into `localStorage` and, later, into a
 * quotation an operator has to read. Fifty lines is far past any real parts
 * order and well inside the 5MB storage quota.
 */
export const MAX_CART_LINES = 50

/** Clamps a requested quantity into the range a line may hold. */
export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1

  return Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.trunc(quantity)))
}

/**
 * Reads a basket out of whatever string was in storage.
 *
 * ── Why this is defensive about its own data ──────────────────────────
 * `localStorage` is the customer's, not ours. It survives deploys, it can be
 * edited by hand, it can be left behind by an older version of this site, and
 * it can be corrupted by a browser that ran out of quota mid-write. None of
 * those is an attack — a customer editing their own basket gains nothing,
 * since the server prices every quotation itself — but every one of them can
 * crash a render if the value is trusted.
 *
 * So each field is checked individually and a bad line is dropped rather than
 * the whole basket being discarded: someone who added five parts and whose
 * third line is malformed keeps four. Unknown properties are dropped by
 * construction, because the returned object is built field by field rather
 * than spread.
 */
export function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) return []

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    // Not JSON at all. An empty basket is the only sensible reading.
    return []
  }

  if (!Array.isArray(parsed)) return []

  const items: CartItem[] = []
  const seen = new Set<string>()

  for (const candidate of parsed) {
    const item = toCartItem(candidate)

    if (!item) continue
    // A repeated slug would render two lines for one part, each with its own
    // stepper, and the second would silently win on the next write.
    if (seen.has(item.slug)) continue

    seen.add(item.slug)
    items.push(item)

    if (items.length >= MAX_CART_LINES) break
  }

  return items
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

/** One stored object, if it is a usable line. */
function toCartItem(value: unknown): CartItem | null {
  if (typeof value !== "object" || value === null) return null

  const candidate = value as Record<string, unknown>

  if (!isNonEmptyString(candidate.slug)) return null
  if (!isNonEmptyString(candidate.name)) return null
  if (!isNonEmptyString(candidate.referenceNumber)) return null

  const price =
    typeof candidate.price === "number" && Number.isFinite(candidate.price)
      ? candidate.price
      : null

  const imageUrl = isNonEmptyString(candidate.imageUrl) ? candidate.imageUrl : null

  const quantity =
    typeof candidate.quantity === "number" ? clampQuantity(candidate.quantity) : 1

  return {
    slug: candidate.slug,
    name: candidate.name,
    referenceNumber: candidate.referenceNumber,
    price,
    imageUrl,
    quantity,
  }
}

/** What gets written back to storage. */
export function serializeCart(items: CartItem[]): string {
  return JSON.stringify(items)
}

/** The part of a line that identifies and describes it — everything but how
 *  many. Callers pass this plus a quantity, so no caller can add a line whose
 *  quantity has not been through `clampQuantity`. */
export type CartItemInput = Omit<CartItem, "quantity">

/**
 * Adds a part, or increases the line that is already there.
 *
 * ── Why an existing line is topped up rather than replaced ────────────
 * Someone who adds two of a part, browses on, and adds one more meant three.
 * Replacing would silently discard the two they had already chosen, and the
 * basket would disagree with what the confirmation message just told them.
 *
 * The line's descriptive fields *are* refreshed from the incoming copy: the
 * catalogue may have been re-rendered since, and the newer name, price and
 * photograph are the ones the customer has actually just been looking at.
 *
 * Returns a new array — the state this feeds is React's, and mutating it in
 * place would not re-render.
 */
export function addToCart(
  items: CartItem[],
  item: CartItemInput,
  quantity = 1
): CartItem[] {
  const requested = clampQuantity(quantity)
  const index = items.findIndex((line) => line.slug === item.slug)

  if (index === -1) {
    // A basket at its ceiling refuses quietly rather than dropping someone
    // else's line to make room. The provider tells the customer.
    if (items.length >= MAX_CART_LINES) return items

    return [...items, { ...item, quantity: requested }]
  }

  const next = [...items]
  next[index] = {
    ...item,
    quantity: clampQuantity(next[index].quantity + requested),
  }

  return next
}

/** Sets a line to an exact quantity. Zero and below remove the line, which is
 *  what a stepper pressed down to nothing should do. */
export function setCartQuantity(
  items: CartItem[],
  slug: string,
  quantity: number
): CartItem[] {
  if (!Number.isFinite(quantity) || Math.trunc(quantity) < 1) {
    return removeFromCart(items, slug)
  }

  return items.map((line) =>
    line.slug === slug ? { ...line, quantity: clampQuantity(quantity) } : line
  )
}

export function removeFromCart(items: CartItem[], slug: string): CartItem[] {
  return items.filter((line) => line.slug !== slug)
}

/** Total units in the basket — what the badge shows. */
export function cartItemCount(items: CartItem[]): number {
  return items.reduce((total, line) => total + line.quantity, 0)
}

/**
 * What the basket comes to.
 *
 * `quotedLines` counts the lines with no listed price. They are excluded from
 * the total rather than treated as zero, and the count is returned so the
 * basket can say so — a subtotal that quietly omitted them would understate
 * what the customer is asking for, which is the one direction a price
 * displayed to a customer must never be wrong in.
 */
export function cartSubtotal(items: CartItem[]): {
  total: number
  quotedLines: number
} {
  let total = 0
  let quotedLines = 0

  for (const line of items) {
    if (line.price === null) {
      quotedLines += 1
      continue
    }

    total += line.price * line.quantity
  }

  // Two decimal places, applied once at the end. Multiplying a price with
  // cents by a quantity accumulates binary-floating-point error, and a basket
  // reading $120.00000000000001 is the sort of detail that costs trust on a
  // page whose whole job is to look like a real company.
  return { total: Math.round(total * 100) / 100, quotedLines }
}
