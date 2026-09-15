import type { Metadata } from "next"
import Link from "next/link"
import { Package } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusBadge } from "@/components/admin/status-badge"
import { Pagination } from "@/components/shared/pagination"
import { requirePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { FINANCIAL_STATUS_LABELS } from "@/lib/orders/order-finance"
import { listOrders, type OrderListItem } from "@/lib/queries/order.queries"
import { formatCurrency } from "@/lib/utils/format-currency"

export const metadata: Metadata = {
  title: "Orders",
}

/**
 * Every order created from an accepted quotation.
 *
 * Read-only for now — recording payments, cancelling an order, and creating
 * its shipment are their own, later phase of work (see order.queries.ts's
 * file note). This exists so "Convert Quote to Order" has somewhere real to
 * send an operator and something real to show them once they arrive.
 */
export default async function AdminOrdersPage(props: PageProps<"/Ricky@2000/orders">) {
  await requirePermission("order:read")

  const searchParams = await props.searchParams
  const page = Number.parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1

  const result = await listOrders({ page })

  const columns: DataTableColumn<OrderListItem>[] = [
    {
      id: "order",
      header: "Order",
      render: (order) => (
        <Link
          href={`${ADMIN_BASE_PATH}/orders/${order.id}`}
          className="group/link flex flex-col gap-0.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="font-semibold transition-colors duration-fast group-hover/link:text-gold-ink">
            {order.customerName}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{order.orderNumber}</span>
        </Link>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (order) => (
        <StatusBadge tone="neutral">{order.status.replaceAll("_", " ").toLowerCase()}</StatusBadge>
      ),
    },
    {
      id: "finance",
      header: "Payment",
      render: (order) => (
        <StatusBadge tone={order.finance.financialStatus === "PAID_IN_FULL" ? "positive" : "warning"}>
          {FINANCIAL_STATUS_LABELS[order.finance.financialStatus]}
        </StatusBadge>
      ),
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      render: (order) => <span className="font-semibold tabular-nums">{formatCurrency(order.totalAmount)}</span>,
    },
    {
      id: "balance",
      header: "Balance",
      align: "right",
      hideBelow: "md",
      render: (order) => <span className="tabular-nums">{formatCurrency(order.finance.balance)}</span>,
    },
    {
      id: "created",
      header: "Created",
      align: "right",
      hideBelow: "lg",
      render: (order) => (
        <span className="text-small text-muted-foreground">
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(order.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title="Orders" />

      <DataTable
        columns={columns}
        rows={result.orders}
        getRowKey={(order) => order.id}
        caption="Orders"
        emptyState={
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"
            >
              <Package className="size-6" />
            </span>
            <h2 className="font-heading text-h3 font-semibold">No orders yet</h2>
          </div>
        }
      />

      {result.pageCount > 1 ? (
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          hrefFor={(target) =>
            target > 1 ? `${ADMIN_BASE_PATH}/orders?page=${target}` : `${ADMIN_BASE_PATH}/orders`
          }
          label="Orders list pages"
          className="border-t-0 pt-0"
        />
      ) : null}
    </div>
  )
}
