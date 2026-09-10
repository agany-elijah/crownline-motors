import { AddToCart } from "@/components/spare-parts/add-to-cart"
import type { CartItemInput } from "@/lib/cart/cart-storage"

/**
 * The part page's primary action, pinned to the bottom of a phone screen.
 *
 * ── Why it exists ─────────────────────────────────────────────────────
 * The deliberate mirror of `VehicleMobileActionBar`, for the same reason and
 * with the same mechanics — a customer should meet the same gesture on both
 * halves of the catalogue rather than having to learn each section's habits.
 *
 * On a desktop the Add control sits beside the gallery in a column that stays
 * roughly in view. On a phone the page is one long stack — gallery, price,
 * fitment, actions, description, delivery steps — and the fitment list is the
 * part a buyer reads most carefully, which is exactly the point at which the
 * Add button has scrolled away above them. The brief puts phone users first
 * for this journey, so the action follows the reader rather than waiting for
 * them to scroll back.
 *
 * ── What it deliberately does not carry ───────────────────────────────
 * Only the one action, as on the vehicle bar. The price is stated twice on the
 * page already, and WhatsApp is a persistent float on every public page —
 * which this bar lifts clear of rather than duplicating (see globals.css).
 *
 * A part priced on enquiry still gets this bar. Adding is a shortlisting
 * gesture, not a purchase: the basket holds no stock and locks no price, and
 * "request a quote" is the only thing it can ever become. See `cart-storage.ts`
 * and the note on `AddToCart`.
 *
 * ── How the rest of the page gets out of its way ──────────────────────
 * `data-mobile-action-bar` is the marker the shell keys off. It is not
 * decorative: rules in globals.css use `body:has([data-mobile-action-bar])` to
 * add bottom clearance to the site footer and to raise the WhatsApp float,
 * neither of which is a descendant of this page. Renaming or dropping the
 * attribute silently reintroduces both overlaps.
 *
 * This file itself is a server component — `AddToCart` is the only client
 * boundary, and it is the same instance of the same button the page body
 * renders, so the two can never disagree about what pressing them does.
 */
interface SparePartMobileActionBarProps {
  /** Exactly what the in-page Add control puts in the basket. */
  item: CartItemInput
  /** The part's name, for the button's accessible name. */
  label: string
}

export function SparePartMobileActionBar({
  item,
  label,
}: SparePartMobileActionBarProps) {
  return (
    <div
      data-mobile-action-bar=""
      className={[
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        // Reads above the deep-black footer as readily as the warm-white page
        // body, so the bar never dissolves into whatever it is floating over.
        "border-t border-border bg-background/95 backdrop-blur-md",
        "shadow-[0_-4px_20px_oklch(0.16_0.004_90/0.08)]",
        // The inset keeps the row clear of the iOS home indicator; the row
        // itself holds the height the shell's clearance rules assume.
        "pb-[env(safe-area-inset-bottom)]",
      ].join(" ")}
    >
      <div className="flex h-(--mobile-action-bar-height) items-center px-4">
        {/*
          The `sm:` rules in the button's own default sizing are for the
          two-button row in the page body, where it shares a line with
          WhatsApp. Here it is the only thing in the bar, so it stays full
          width at every size the bar is visible at.
        */}
        <AddToCart item={item} label={label} className="sm:w-full sm:flex-none" />
      </div>
    </div>
  )
}
