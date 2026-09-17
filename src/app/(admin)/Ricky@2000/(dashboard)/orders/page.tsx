import type { Metadata } from "next"
import { Package } from "lucide-react"

import { AdminEmptyState } from "@/components/admin/admin-empty-state"
import { AdminListCount } from "@/components/admin/admin-list-toolbar"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { DataTable, DataTableRecordLink, type DataTableColumn } from "@/components/admin/data-table"
import { StatusBadge } from "@/components/admin/status-badge"
import { Pagination } from "@/components/shared/pagination"
import { requirePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/lib/constants/order-status"
import { FINANCIAL_STATUS_LABELS } from "@/lib/orders/order-finance"
import { listOrders, type OrderListItem } from "@/lib/queries/order.queries"
import { formatCurrency } from "@/lib/utils/format-currency"

export const metadata: Metadata = {
  title: "Orders",
}

/**
 * Every order created from an accepted quotation.
 *
 * The list is for finding an order; recording payments, cancelling and
 * tracking all happen on the order's own page, beside its balance.
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
        <DataTableRecordLink
          href={`${ADMIN_BASE_PATH}/orders/${order.id}`}
          title={order.customerName}
          reference={order.orderNumber}
        />
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (order) => (
        <StatusBadge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
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
      render: (order) => <span className="font-medium tabular-nums">{formatCurrency(order.totalAmount)}</span>,
    },
    {
      id: "balance",
      header: "Balance",
      align: "right",
      hideBelow: "md",
      render: (order) => (
        <span
          className={
            order.finance.balance > 0
              ? "text-foreground tabular-nums"
              : "text-muted-foreground tabular-nums"
          }
        >
          {formatCurrency(order.finance.balance)}
        </span>
      ),
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
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Orders"
        description="Orders created from accepted quotations — what each is worth, what has been paid, and what is still owed."
      />

      <DataTable
        columns={columns}
        rows={result.orders}
        getRowKey={(order) => order.id}
        caption="Orders"
        emptyState={
          <AdminEmptyState
            icon={Package}
            title="No orders yet"
            description="An order is created when a customer accepts a quotation. Convert one from its quote page."
          />
        }
      />

      {result.pageCount > 1 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminListCount total={result.total} noun="orders" />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(target) =>
              target > 1 ? `${ADMIN_BASE_PATH}/orders?page=${target}` : `${ADMIN_BASE_PATH}/orders`
            }
            label="Orders list pages"
            className="border-t-0 pt-0"
          />
        </div>
      ) : null}
    </div>
  )
}
