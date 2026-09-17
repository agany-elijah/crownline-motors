import { StatusBadge, type StatusTone } from "@/components/admin/status-badge"
import type { OrderFinanceSummary } from "@/lib/orders/order-finance"
import { FINANCIAL_STATUS_LABELS } from "@/lib/orders/order-finance"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format-currency"

const MILESTONE_TONE: Record<string, StatusTone> = {
  PENDING: "muted",
  DUE: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "positive",
}

const MILESTONE_LABEL: Record<string, string> = {
  PENDING: "Not yet due",
  DUE: "Due now",
  PARTIALLY_PAID: "Part paid",
  PAID: "Paid",
}

/**
 * An order's payment position: what is still owed, how far along the total
 * the customer is, and each milestone.
 *
 * Every figure comes from `summarizeOrderFinance`, computed live from the
 * payment ledger — never a stored "amount paid" column. See the schema
 * documentation on why that number is never cached. The bar is drawn from the
 * same two figures printed beside it, and says so to assistive technology, so
 * it can never show a different story from the numbers.
 */
export function OrderFinanceSummaryCard({ finance }: { finance: OrderFinanceSummary }) {
  const paidShare =
    finance.totalAmount > 0 ? Math.min(100, Math.max(0, (finance.amountPaid / finance.totalAmount) * 100)) : 0
  const settled = finance.financialStatus === "PAID_IN_FULL"

  return (
    <section
      aria-labelledby="order-finance-heading"
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-subtle)]"
    >
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="order-finance-heading" className="text-h3">
            Payment position
          </h2>
          <StatusBadge tone={settled ? "positive" : "warning"}>
            {FINANCIAL_STATUS_LABELS[finance.financialStatus]}
          </StatusBadge>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-small text-muted-foreground">Balance due</span>
          <span className="text-[2rem] leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums">
            {formatCurrency(finance.balance)}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div
            role="meter"
            aria-label="Share of the order total paid"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(paidShare)}
            aria-valuetext={`${formatCurrency(finance.amountPaid)} of ${formatCurrency(finance.totalAmount)} paid`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
          >
            <div
              className={cn("h-full rounded-full", settled ? "bg-success" : "bg-gold")}
              style={{ width: `${paidShare}%` }}
            />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-small">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Paid</dt>
              <dd className="text-foreground tabular-nums">{formatCurrency(finance.amountPaid)}</dd>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <dt className="text-xs text-muted-foreground">Order total</dt>
              <dd className="text-foreground tabular-nums">{formatCurrency(finance.totalAmount)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <ol className="flex flex-col divide-y divide-border/70 border-t border-border">
        {finance.milestones.map((milestone) => (
          <li
            key={milestone.id}
            aria-current={finance.currentlyDue?.id === milestone.id ? "step" : undefined}
            className={cn(
              "flex items-center justify-between gap-3 px-5 py-3 sm:px-6",
              finance.currentlyDue?.id === milestone.id && "bg-accent/40"
            )}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-small font-medium text-foreground">{milestone.label}</span>
              <StatusBadge tone={MILESTONE_TONE[milestone.status] ?? "muted"} className="w-fit">
                {MILESTONE_LABEL[milestone.status] ?? milestone.status}
              </StatusBadge>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5 text-small tabular-nums">
              <span className="text-foreground">{formatCurrency(milestone.amountPaid)}</span>
              <span className="text-xs text-muted-foreground">of {formatCurrency(milestone.amountDue)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
