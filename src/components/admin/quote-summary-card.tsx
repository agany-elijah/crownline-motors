"use client"

import { useQuotePricing } from "@/lib/quotes/quote-pricing-context"
import { formatCurrency } from "@/lib/utils/format-currency"

/**
 * The sidebar's live running total — subtotal, then extras, then the number
 * that matters. Reads the same `QuotePricingProvider` state the details form
 * edits, so it updates as the operator types rather than only after
 * "Save details".
 */
export function QuoteSummaryCard() {
  const { totals } = useQuotePricing()

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-5 shadow-[var(--shadow-subtle)] ring-1 ring-foreground/10">
      <h2 className="text-meta text-muted-foreground">Quote summary</h2>

      <dl className="flex flex-col gap-2 text-small">
        <Row label="Items" value={formatCurrency(totals.itemsSubtotal)} />
        {totals.accessoriesTotal > 0 ? (
          <Row label="Accessories" value={formatCurrency(totals.accessoriesTotal)} />
        ) : null}
        {totals.feesTotal > 0 ? (
          <Row label="Additional costs" value={formatCurrency(totals.feesTotal)} />
        ) : null}
      </dl>

      <div className="flex items-baseline justify-between gap-3 border-t border-border/60 pt-3">
        <span className="text-small font-medium text-muted-foreground">Total</span>
        <span className="font-heading text-h3 font-semibold tabular-nums">
          {formatCurrency(totals.total)}
        </span>
      </div>

      {totals.unpricedLines > 0 ? (
        <p className="text-small text-warning">
          {totals.unpricedLines} line{totals.unpricedLines === 1 ? "" : "s"} still need a price
        </p>
      ) : null}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
