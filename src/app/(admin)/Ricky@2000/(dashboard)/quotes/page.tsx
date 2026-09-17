import type { Metadata } from "next"
import Link from "next/link"
import { FileText } from "lucide-react"

import { AdminEmptyState } from "@/components/admin/admin-empty-state"
import { AdminListCount } from "@/components/admin/admin-list-toolbar"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { DataTable, DataTableRecordLink, type DataTableColumn } from "@/components/admin/data-table"
import { QuoteListFilters } from "@/components/admin/quote-list-filters"
import { QuoteStatusBadge } from "@/components/admin/quote-status-badge"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/shared/pagination"
import { requirePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { QUOTE_CHANNEL_LABELS, QUOTE_TYPE_LABELS } from "@/lib/constants/quote-status"
import {
  getQuoteStatusCounts,
  listQuotes,
  type QuoteListItem,
} from "@/lib/queries/quote.queries"
import { formatCurrencyOrDash } from "@/lib/utils/format-currency"
import { quoteListFiltersSchema } from "@/lib/validations/quote.schema"

export const metadata: Metadata = {
  title: "Quotes",
}

/**
 * The quotation master view — every enquiry, its status, and what it is
 * currently worth, filterable by status, product type and free text.
 */
export default async function AdminQuotesPage(props: PageProps<"/Ricky@2000/quotes">) {
  await requirePermission("quote:read")

  const searchParams = await props.searchParams

  const filters = quoteListFiltersSchema.parse({
    search: searchParams.search,
    status: searchParams.status,
    type: searchParams.type,
    page: searchParams.page,
  })

  const [result, statusCounts] = await Promise.all([listQuotes(filters), getQuoteStatusCounts()])

  const totalAll = Object.values(statusCounts).reduce((sum, n) => sum + n, 0)

  const columns: DataTableColumn<QuoteListItem>[] = [
    {
      id: "quote",
      header: "Quote",
      render: (quote) => (
        <DataTableRecordLink
          href={`${ADMIN_BASE_PATH}/quotes/${quote.id}`}
          title={quote.customerName}
          reference={quote.quoteNumber}
        />
      ),
    },
    {
      id: "type",
      header: "Type",
      hideBelow: "md",
      render: (quote) => (
        <span className="text-small text-muted-foreground">{QUOTE_TYPE_LABELS[quote.type]}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (quote) => <QuoteStatusBadge status={quote.status} />,
    },
    {
      id: "items",
      header: "Lines",
      align: "right",
      hideBelow: "lg",
      render: (quote) => <span className="text-muted-foreground tabular-nums">{quote.itemLineCount}</span>,
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      render: (quote) =>
        quote.totals.unpricedLines > 0 || quote.totals.total === 0 ? (
          <span className="text-small text-muted-foreground">Not priced</span>
        ) : (
          <span className="font-medium tabular-nums">{formatCurrencyOrDash(quote.totals.total)}</span>
        ),
    },
    {
      id: "sent",
      header: "Last sent",
      align: "right",
      hideBelow: "lg",
      render: (quote) =>
        quote.sentAt ? (
          <span className="text-small text-muted-foreground">
            {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(quote.sentAt)}
            {quote.lastSentVia ? ` · ${QUOTE_CHANNEL_LABELS[quote.lastSentVia]}` : ""}
          </span>
        ) : (
          <span className="text-small text-muted-foreground">—</span>
        ),
    },
    {
      id: "created",
      header: "Received",
      align: "right",
      hideBelow: "md",
      render: (quote) => (
        <span className="text-small text-muted-foreground">
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(quote.createdAt)}
        </span>
      ),
    },
  ]

  const hasFilters = Boolean(filters.search || filters.status || filters.type)

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Quotes"
        description="Every enquiry from the website and the team — what it is worth, where it stands, and when it was last sent."
      />

      <QuoteListFilters statusCounts={statusCounts} total={totalAll} />

      <DataTable
        columns={columns}
        rows={result.quotes}
        getRowKey={(quote) => quote.id}
        caption="Quotes"
        emptyState={<EmptyQuotes hasFilters={hasFilters} />}
      />

      {result.pageCount > 1 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminListCount total={result.total} noun="quotes" />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(target) => paginationHref(searchParams, target)}
            label="Quotes list pages"
            className="border-t-0 pt-0"
          />
        </div>
      ) : null}
    </div>
  )
}

function EmptyQuotes({ hasFilters }: { hasFilters: boolean }) {
  return hasFilters ? (
    <AdminEmptyState
      icon={FileText}
      title="No quotes match"
      description="Nothing fits this search, status and type. Try a different term, or clear the filters."
      action={
        <Button render={<Link href={`${ADMIN_BASE_PATH}/quotes`} />} variant="outline">
          Show all quotes
        </Button>
      }
    />
  ) : (
    <AdminEmptyState
      icon={FileText}
      title="No quotes yet"
      description="Requests from Get a Quote and the vehicle and parts pages will arrive here."
    />
  )
}

function paginationHref(
  searchParams: Record<string, string | string[] | undefined>,
  target: number
): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value !== "" && key !== "page") {
      params.set(key, value)
    }
  }

  if (target > 1) params.set("page", String(target))

  const query = params.toString()

  return query ? `${ADMIN_BASE_PATH}/quotes?${query}` : `${ADMIN_BASE_PATH}/quotes`
}
