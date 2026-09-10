import type { Metadata } from "next"
import Link from "next/link"
import { Plus, Wrench } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { Pagination } from "@/components/shared/pagination"
import { SparePartListFilters } from "@/components/admin/spare-part-list-filters"
import { SparePartAvailabilityTag } from "@/components/spare-parts/spare-part-availability-tag"
import { SparePartStatusBadge } from "@/components/admin/spare-part-status-badge"
import { Button } from "@/components/ui/button"
import { requirePermission } from "@/lib/auth/admin-guard"
import { cn } from "@/lib/utils"
import { SparePartPricingMode, SparePartStatus } from "@/generated/prisma/enums"
import {
  getCategoryFilterOptions,
  getSparePartStatusCounts,
  listSpareParts,
  type SparePartListItem,
} from "@/lib/queries/spare-part.queries"
import { formatCurrency, formatNumber } from "@/lib/utils/format-currency"
import { SPARE_PART_PRICING_MODE_LABELS } from "@/lib/constants/spare-part-options"
import { sparePartListFiltersSchema } from "@/lib/validations/spare-part.schema"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

export const metadata: Metadata = {
  title: "Spare Parts",
}

export default async function AdminSparePartsPage(
  props: PageProps<"/Ricky@2000/spare-parts">
) {
  await requirePermission("sparePart:read")

  const searchParams = await props.searchParams

  // Parsed with `catch` defaults, so a hand-edited query string shows an
  // unfiltered list rather than an error page.
  const filters = sparePartListFiltersSchema.parse({
    search: searchParams.search,
    status: searchParams.status,
    availability: searchParams.availability,
    categoryId: searchParams.categoryId,
    outOfStock: searchParams.outOfStock,
    page: searchParams.page,
  })

  const [result, statusCounts, categories] = await Promise.all([
    listSpareParts(filters),
    getSparePartStatusCounts(),
    getCategoryFilterOptions(),
  ])

  const totalAll = Object.values(statusCounts).reduce((sum, n) => sum + n, 0)

  /**
   * Column order follows how an operator reads a row: what it is, what state
   * it is in, what it costs, how many we hold, then the details that only
   * matter once they have found the right row. The last three drop away on
   * narrow screens rather than being crushed.
   */
  const columns: DataTableColumn<SparePartListItem>[] = [
    {
      id: "part",
      header: "Part",
      render: (part) => (
        <Link
          href={`${ADMIN_BASE_PATH}/spare-parts/${part.id}`}
          className="group/link flex flex-col gap-0.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="font-semibold transition-colors duration-fast group-hover/link:text-gold-ink">
            {part.name}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {/*
              The manufacturer's number first when there is one: it is what a
              customer reads off the old part and quotes down the phone, so it
              is what an operator is most often matching against. Ours is
              always shown beside it, because it is the one that identifies
              exactly this listing.
            */}
            {part.oemPartNumber
              ? `${part.oemPartNumber} · ${part.referenceNumber}`
              : part.referenceNumber}
          </span>
        </Link>
      ),
    },
    {
      id: "category",
      header: "Category",
      hideBelow: "lg",
      render: (part) => (
        <span className="text-small text-muted-foreground">{part.categoryName}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (part) => <SparePartStatusBadge status={part.status} />,
    },
    {
      id: "price",
      header: "Price",
      align: "right",
      render: (part) =>
        part.pricingMode === SparePartPricingMode.QUOTE_ONLY ? (
          // Never "—" and never "$0". A quoted part has a deliberate pricing
          // decision behind it, and a dash would read as an unfinished
          // listing rather than as the offer it is.
          <span className="text-small text-muted-foreground">
            {SPARE_PART_PRICING_MODE_LABELS.QUOTE_ONLY}
          </span>
        ) : (
          <span className="font-semibold tabular-nums">
            {part.price === null ? "—" : formatCurrency(part.price)}
          </span>
        ),
    },
    {
      id: "stock",
      header: "Stock",
      align: "right",
      render: (part) => (
        <span
          className={cn(
            "tabular-nums",
            // Zero stock on a *published* part is the state worth marking:
            // customers can see it and cannot buy it. On a draft it is
            // normal — the listing is being prepared before the box arrives.
            part.stockQuantity === 0 && part.status === SparePartStatus.PUBLISHED
              ? "font-semibold text-warning"
              : "text-muted-foreground"
          )}
        >
          {formatNumber(part.stockQuantity)}
        </span>
      ),
    },
    {
      id: "availability",
      header: "Availability",
      hideBelow: "lg",
      render: (part) => (
        /**
         * The same tag the customer sees on the card, on purpose.
         *
         * An operator reading this column is answering "what does the website
         * currently promise about this part", and the fastest way to answer it
         * is to show them the thing the website shows. A separate dashboard
         * vocabulary here would be a second wording of the same state, and the
         * two would eventually disagree — with the operator confidently telling
         * a customer whatever the dashboard said.
         *
         * Note this is *not* the stock column beside it. Stock is what we have
         * counted; this is what we have chosen to say.
         */
        <SparePartAvailabilityTag availability={part.availability} />
      ),
    },
    {
      id: "fitment",
      header: "Fits",
      align: "right",
      hideBelow: "lg",
      render: (part) => (
        <span
          className={cn(
            "tabular-nums",
            // A part with no fitment cannot be found by anyone searching for
            // their own car, which is how most parts are found.
            part.fitmentCount === 0 ? "text-warning" : "text-muted-foreground"
          )}
        >
          {part.fitmentCount}
        </span>
      ),
    },
    {
      id: "updated",
      header: "Updated",
      align: "right",
      hideBelow: "md",
      render: (part) => (
        <span className="text-small text-muted-foreground">
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
            part.updatedAt
          )}
        </span>
      ),
    },
  ]

  const hasFilters = Boolean(
    filters.search ||
    filters.status ||
    filters.availability ||
    filters.categoryId ||
    filters.outOfStock
  )

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Spare parts"
        description="Everything in the parts catalogue, including archived listings."
        actions={
          <Button
            render={<Link href={`${ADMIN_BASE_PATH}/spare-parts/new`} />}
            size="lg"
          >
            <Plus aria-hidden="true" />
            Add part
          </Button>
        }
      />

      <SparePartListFilters
        statusCounts={statusCounts}
        total={totalAll}
        categories={categories}
      />

      <DataTable
        columns={columns}
        rows={result.parts}
        getRowKey={(part) => part.id}
        caption="Spare parts catalogue"
        emptyState={<EmptyParts hasFilters={hasFilters} />}
      />

      {result.pageCount > 1 ? (
        <div className="flex flex-col gap-3">
          <p className="text-small text-muted-foreground">
            <span className="tabular">{result.total}</span> parts
          </p>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(target) => paginationHref(searchParams, target)}
            label="Spare parts list pages"
            className="border-t-0 pt-0"
          />
        </div>
      ) : null}
    </div>
  )
}

/**
 * Two different empty states, because they call for different actions.
 *
 * "No parts yet" wants an invitation to add one; "nothing matched" wants a
 * way back to everything. Showing the first when a filter is active would
 * suggest the catalogue is empty when it is not.
 */
function EmptyParts({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"
      >
        <Wrench className="size-6" />
      </span>

      {hasFilters ? (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-h3 font-semibold">No matches</h2>
            <p className="text-body text-muted-foreground">
              No parts match that search or filter.
            </p>
          </div>
          <Button
            render={<Link href={`${ADMIN_BASE_PATH}/spare-parts`} />}
            variant="outline"
          >
            Show all parts
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-h3 font-semibold">No parts yet</h2>
            <p className="max-w-sm text-body text-muted-foreground">
              Add your first spare part. It starts as a draft, so nothing appears
              on the website until you publish it.
            </p>
          </div>
          <Button render={<Link href={`${ADMIN_BASE_PATH}/spare-parts/new`} />}>
            <Plus aria-hidden="true" />
            Add part
          </Button>
        </>
      )}
    </div>
  )
}

/**
 * A list URL with the current filters preserved.
 *
 * Built from the raw `searchParams` rather than from the parsed filters so
 * that a key added to the list later is carried through pagination without
 * anyone having to remember to add it here. Array values are dropped: a
 * repeated key is not a filter this list can satisfy, and the parser takes
 * the first occurrence anyway.
 */
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

  // Page one is the default and is left out, so the list has one address
  // rather than two.
  if (target > 1) params.set("page", String(target))

  const query = params.toString()

  return query
    ? `${ADMIN_BASE_PATH}/spare-parts?${query}`
    : `${ADMIN_BASE_PATH}/spare-parts`
}
