import { StatusBadge, type StatusTone } from "@/components/admin/status-badge"
import type { OrderFinanceSummary } from "@/lib/orders/order-finance"
import { FINANCIAL_STATUS_LABELS } from "@/lib/orders/order-finance"
import { formatCurrency } from "@/lib/utils/format-currency"

const MILESTONE_TONE: Record<string, StatusTone> = {
  PENDING: "muted",
  DUE: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "positive",
}

/**
 * An order's payment position: total, paid, balance, and each milestone.
 *
 * Every figure comes from `summarizeOrderFinance`, computed live from the
 * payment ledger — never a stored "amount paid" column. See the schema
 * documentation on why that number is never cached.
 */
export function OrderFinanceSummaryCard({ finance }: { finance: OrderFinanceSummary }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-6 shadow-[var(--shadow-subtle)] ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-h3 font-semibold">Payments</h2>
        <StatusBadge tone={finance.financialStatus === "PAID_IN_FULL" ? "positive" : "warning"}>
          {FINANCIAL_STATUS_LABELS[finance.financialStatus]}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-3 gap-4 border-b border-border/60 pb-4">
        <div>
          <p className="text-small text-muted-foreground">Total</p>
          <p className="font-semibold tabular-nums">{formatCurrency(finance.totalAmount)}</p>
        </div>
        <div>
          <p className="text-small text-muted-foreground">Paid</p>
          <p className="font-semibold tabular-nums">{formatCurrency(finance.amountPaid)}</p>
        </div>
        <div>
          <p className="text-small text-muted-foreground">Balance</p>
          <p className="font-semibold tabular-nums">{formatCurrency(finance.balance)}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {finance.milestones.map((milestone) => (
          <li key={milestone.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <StatusBadge tone={MILESTONE_TONE[milestone.status] ?? "muted"}>
                {milestone.status === "DUE" ? "Due now" : milestone.status.replace("_", " ").toLowerCase()}
              </StatusBadge>
              <span className="text-small">{milestone.label}</span>
            </div>
            <div className="text-right text-small tabular-nums">
              <span className="font-semibold">{formatCurrency(milestone.amountPaid)}</span>
              <span className="text-muted-foreground"> / {formatCurrency(milestone.amountDue)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
