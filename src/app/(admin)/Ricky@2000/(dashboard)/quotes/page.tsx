import type { Metadata } from "next"
import Link from "next/link"
import { FileText } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { QuoteListFilters } from "@/components/admin/quote-list-filters"
import { QuoteStatusBadge } from "@/components/admin/quote-status-badge"
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
        <Link
          href={`${ADMIN_BASE_PATH}/quotes/${quote.id}`}
          className="group/link flex flex-col gap-0.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="font-semibold transition-colors duration-fast group-hover/link:text-gold-ink">
            {quote.customerName}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{quote.quoteNumber}</span>
        </Link>
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
      render: (quote) => <span className="tabular-nums">{quote.itemLineCount}</span>,
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      render: (quote) =>
        quote.totals.unpricedLines > 0 || quote.totals.total === 0 ? (
          <span className="text-small text-muted-foreground">Not priced</span>
        ) : (
          <span className="font-semibold tabular-nums">{formatCurrencyOrDash(quote.totals.total)}</span>
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
    <div className="flex flex-col gap-8">
      <AdminPageHeader title="Quotes" />

      <QuoteListFilters statusCounts={statusCounts} total={totalAll} />

      <DataTable
        columns={columns}
        rows={result.quotes}
        getRowKey={(quote) => quote.id}
        caption="Quotes"
        emptyState={<EmptyQuotes hasFilters={hasFilters} />}
      />

      {result.pageCount > 1 ? (
        <div className="flex flex-col gap-3">
          <p className="text-small text-muted-foreground">
            <span className="tabular">{result.total}</span> quotes
          </p>
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
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"
      >
        <FileText className="size-6" />
      </span>

      <h2 className="font-heading text-h3 font-semibold">
        {hasFilters ? "No matches" : "No quotes yet"}
      </h2>

      {hasFilters ? (
        <Link
          href={`${ADMIN_BASE_PATH}/quotes`}
          className="text-small font-medium text-gold-ink hover:underline"
        >
          Show all quotes
        </Link>
      ) : null}
    </div>
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
