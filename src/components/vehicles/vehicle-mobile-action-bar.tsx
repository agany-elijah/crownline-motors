import { VehicleQuoteButton } from "@/components/quotes/quote-request-triggers"

/**
 * The vehicle page's primary action, pinned to the bottom of a phone
 * screen.
 *
 * ── Why it exists ─────────────────────────────────────────────────────
 * On a desktop the request button sits in the summary band under the
 * gallery and stays roughly in view. On a phone the same page is a long
 * single column — gallery, summary, specifications, description — and by
 * the time someone has read enough to want the car, the button is several
 * screens behind them. The brief puts phone users first for exactly this journey,
 * so the action follows the reader instead of waiting for them to scroll
 * back.
 *
 * ── What it deliberately does not carry ───────────────────────────────
 * Only the one action. A price and a second button were both tried and
 * both lose: at `size="lg"` the label is uppercase with wide tracking, and
 * on a 390px screen anything beside it squeezes the button below a
 * comfortable target. The price is already stated in the summary band, and
 * WhatsApp is already a persistent float on every public page — which this
 * bar lifts clear of rather than duplicating (see globals.css).
 *
 * ── How the rest of the page gets out of its way ──────────────────────
 * `data-mobile-action-bar` is the marker the shell keys off. It is not
 * decorative: rules in globals.css use `body:has([data-mobile-action-bar])`
 * to add bottom clearance to the site footer and to raise the WhatsApp
 * float, neither of which is a descendant of this page. Renaming or
 * dropping the attribute silently reintroduces both overlaps.
 *
 * The bar itself is a server component. Its one button is the same client
 * `VehicleQuoteButton` the summary band renders, given the same subject, so
 * the two can never open different panels for the same car.
 */
interface VehicleMobileActionBarProps {
  /** What the quote panel fills in — see `quoteSubject` on the vehicle page. */
  vehicleSlug: string
  label: string
  imageUrl: string | null
}

export function VehicleMobileActionBar({
  vehicleSlug,
  label,
  imageUrl,
}: VehicleMobileActionBarProps) {
  return (
    <div
      data-mobile-action-bar=""
      className={[
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        // Above the deep-black footer as readily as the warm-white page
        // body, so the bar never dissolves into whatever it happens to be
        // floating over.
        "border-t border-border bg-background/95 backdrop-blur-md",
        "shadow-[0_-4px_20px_oklch(0.16_0.004_90/0.08)]",
        // The inset keeps the row clear of the iOS home indicator; the row
        // itself holds the height the shell's clearance rules assume.
        "pb-[env(safe-area-inset-bottom)]",
      ].join(" ")}
    >
      <div className="flex h-(--mobile-action-bar-height) items-center px-4">
        <VehicleQuoteButton
          vehicleSlug={vehicleSlug}
          label={label}
          imageUrl={imageUrl}
          className="w-full"
        />
      </div>
    </div>
  )
}
