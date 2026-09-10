import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format-currency"

/**
 * How a part's price is written, everywhere it appears.
 *
 * ── One component so three surfaces cannot disagree ───────────────────
 * The card, the quick-view panel and the part page all state a price, and all
 * three have to make the same two things true: a listed figure is green (the
 * same treatment money already has on a vehicle card, so a customer moving
 * between the two catalogues meets one house style), and it is marked as an
 * estimate.
 *
 * ── Why every price is an estimate ────────────────────────────────────
 * At the dealership's instruction, and for the same reason the vehicle page
 * refuses to publish a delivered total: what a customer finally pays depends
 * on shipping, clearing and where in South Sudan they are collecting, none of
 * which the catalogue knows. A figure a customer budgets against and the
 * business cannot honour is the most expensive thing this site could publish,
 * because it is quoted back at collection.
 *
 * So the estimate marker is not decoration and is not optional — it is part
 * of the price. It is rendered as a separate, quieter word rather than folded
 * into the figure, so the number stays scannable in a grid.
 *
 * ── A part with no listed price ───────────────────────────────────────
 * Rendered as "Price on enquiry". That is a fact about this listing, not the
 * name of an internal pricing mode — the public DTOs do not carry
 * `pricingMode` at all (see public-spare-part.queries.ts), so `price === null`
 * is the only thing this component can see, and the only thing it needs to.
 */
interface SparePartPriceProps {
  price: number | null
  /** `card` is the catalogue grid; `detail` is the part page's headline. */
  size?: "card" | "panel" | "detail"
  className?: string
}

const FIGURE_SIZE = {
  card: "text-body",
  panel: "text-title",
  detail: "text-h2",
} as const

const MARKER_SIZE = {
  card: "text-xs",
  panel: "text-xs",
  detail: "text-small",
} as const

export function SparePartPrice({
  price,
  size = "card",
  className,
}: SparePartPriceProps) {
  if (price === null) {
    return (
      <span
        className={cn(
          "font-sans font-semibold text-foreground",
          FIGURE_SIZE[size],
          className
        )}
      >
        Price on enquiry
      </span>
    )
  }

  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      {/*
        Inter rather than the heading face, matching the vehicle card: Manrope
        draws a display dollar sign that stops reading as currency beside four
        figures. `tabular` so a column of prices in a grid lines up.
      */}
      <span
        className={cn(
          "tabular font-sans font-bold text-price",
          FIGURE_SIZE[size]
        )}
      >
        {formatCurrency(price)}
      </span>
      {/*
        The abbreviation, on the two surfaces where the figure has to stay
        scannable in a grid or a panel.

        Suppressed at `detail` size: the part page states it in full and in
        red beside the figure (`PriceEstimateTag`), and printing both would
        qualify the same number twice — "$120 est. ESTIMATE" — which reads as
        a mistake rather than as emphasis.
      */}
      {size === "detail" ? null : (
        <span
          className={cn(
            "font-sans font-medium text-muted-foreground",
            MARKER_SIZE[size]
          )}
        >
          est.
        </span>
      )}
    </span>
  )
}

/**
 * The sentence that explains the marker above.
 *
 * Shown once per page, near the price a customer is actually deciding on —
 * not on every card, where twenty-four copies of it would be wallpaper.
 */
export function PriceEstimateNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-small text-muted-foreground", className)}>
      {/*
        The lead clause is load-bearing and was briefly dropped.

        On the part page this sits under a red ESTIMATE tag, so "prices are
        estimates" reads as a restatement — which is why it was trimmed. But
        the same component is the *only* explanation on the catalogue, where
        the nearest marker is a two-letter "est." beside each figure. Removing
        the subject left that page with a sentence about shipping and nothing
        saying what the prices actually were.

        A little redundancy on the page that matters most is the right trade:
        the tag is the flag, this is the reason.
      */}
      Prices are estimates. Shipping, clearing and delivery depend on where you
      are collecting, so we confirm the final cost on your quotation before you
      commit to anything.
    </p>
  )
}

/**
 * The word "Estimate", said in full and in red, beside the price on a part
 * page.
 *
 * ── Why this is louder than the "est." on a card ──────────────────────
 * A card's job is to get a customer to the part; the part page is where they
 * decide to spend money, and it is the last screen before they message a
 * business in another country about wiring some. That is the moment a figure
 * has to be unmistakably provisional.
 *
 * The abbreviation is right on a card, where twenty-four of them have to stay
 * scannable. Here it is spelled out: "est." is a convention a used-car buyer
 * knows and a first-time customer reading a second language does not, and the
 * one thing this label must not do is fail to be understood.
 *
 * ── Why red, when nothing has gone wrong ──────────────────────────────
 * Red is the site's caution colour and this is the one genuine caution on the
 * page — the brief is explicit that a price a customer budgets against and
 * the business cannot honour is the most expensive thing this site could
 * publish, because it gets quoted back at collection. Using the destructive
 * token rather than a new colour keeps it inside the palette and inside the
 * theme.
 *
 * It is deliberately a *tint*, not a filled alert: `bg-destructive/10` with
 * destructive text is a quiet flag beside a figure, where a solid red block
 * would read as an error on the listing itself.
 *
 * Rendered only where there is a figure to qualify — a part priced on enquiry
 * has no number for this to be about, and the words "Price on enquiry" are
 * already their own answer.
 */
export function PriceEstimateTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-[3px] px-2 py-0.5",
        "border border-destructive/25 bg-destructive/10",
        "text-xs font-bold tracking-wide text-destructive uppercase",
        className
      )}
    >
      Estimate
    </span>
  )
}
