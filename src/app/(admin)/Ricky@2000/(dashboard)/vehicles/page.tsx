import type { Metadata } from "next"
import Link from "next/link"
import { Car, Plus } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { VehicleListFilters } from "@/components/admin/vehicle-list-filters"
import { VehicleStatusBadge } from "@/components/admin/vehicle-status-badge"
import { Button } from "@/components/ui/button"
import { requirePermission } from "@/lib/auth/admin-guard"
import { cn } from "@/lib/utils"
import {
  getVehicleStatusCounts,
  listVehicles,
  type VehicleListItem,
} from "@/lib/queries/vehicle.queries"
import { formatCurrency, formatMileage } from "@/lib/utils/format-currency"
import { vehicleListFiltersSchema } from "@/lib/validations/vehicle.schema"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

export const metadata: Metadata = {
  title: "Vehicles",
}

export default async function AdminVehiclesPage(
  props: PageProps<"/Ricky@2000/vehicles">
) {
  await requirePermission("vehicle:read")

  const searchParams = await props.searchParams

  // Parsed with `catch` defaults, so a hand-edited query string shows an
  // unfiltered list rather than an error page.
  const filters = vehicleListFiltersSchema.parse({
    search: searchParams.search,
    status: searchParams.status,
    page: searchParams.page,
  })

  const [result, statusCounts] = await Promise.all([
    listVehicles(filters),
    getVehicleStatusCounts(),
  ])

  const totalAll = Object.values(statusCounts).reduce((sum, n) => sum + n, 0)

  /**
   * Column order follows how an operator reads a row: what it is, what
   * state it is in, what it costs, then the details that only matter once
   * they have found the right row. The last three drop away on narrow
   * screens rather than being crushed.
   */
  const columns: DataTableColumn<VehicleListItem>[] = [
    {
      id: "vehicle",
      header: "Vehicle",
      render: (vehicle) => (
        <Link
          href={`${ADMIN_BASE_PATH}/vehicles/${vehicle.id}`}
          className="group/link flex flex-col gap-0.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="font-semibold transition-colors duration-fast group-hover/link:text-gold-ink">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {vehicle.referenceNumber}
          </span>
        </Link>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (vehicle) => <VehicleStatusBadge status={vehicle.status} />,
    },
    {
      id: "price",
      header: "Price",
      align: "right",
      render: (vehicle) => (
        <span className="font-semibold tabular-nums">
          {formatCurrency(vehicle.price)}
        </span>
      ),
    },
    {
      id: "mileage",
      header: "Mileage",
      align: "right",
      hideBelow: "md",
      render: (vehicle) => (
        <span className="tabular-nums text-muted-foreground">
          {formatMileage(vehicle.mileageKm)}
        </span>
      ),
    },
    {
      id: "photos",
      header: "Photos",
      align: "right",
      hideBelow: "lg",
      // Linked rather than displayed. The count is the only place the list
      // mentions photographs at all, so it is where an operator looks when
      // they want to add some — and a number that is not a route leaves them
      // hunting for one.
      render: (vehicle) => (
        <Link
          href={`${ADMIN_BASE_PATH}/vehicles/${vehicle.id}#photographs`}
          className={cn(
            "rounded-sm tabular-nums underline-offset-4 hover:underline",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            // A published vehicle with no photographs is the single most
            // damaging listing the business can have, so zero is marked
            // rather than rendered as just another number.
            vehicle.photoCount === 0 ? "text-warning" : "text-muted-foreground"
          )}
          aria-label={
            vehicle.photoCount === 0
              ? `Add photographs to the ${vehicle.year} ${vehicle.make} ${vehicle.model}`
              : `Manage the ${vehicle.photoCount} photographs of the ${vehicle.year} ${vehicle.make} ${vehicle.model}`
          }
        >
          {vehicle.photoCount}
        </Link>
      ),
    },
    {
      id: "updated",
      header: "Updated",
      align: "right",
      hideBelow: "lg",
      render: (vehicle) => (
        <span className="text-small text-muted-foreground">
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
            vehicle.updatedAt
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Vehicles"
        description="Everything in the inventory, including archived listings."
        actions={
          <Button render={<Link href={`${ADMIN_BASE_PATH}/vehicles/new`} />} size="lg">
            <Plus aria-hidden="true" />
            Add vehicle
          </Button>
        }
      />

      <VehicleListFilters statusCounts={statusCounts} total={totalAll} />

      <DataTable
        columns={columns}
        rows={result.vehicles}
        getRowKey={(vehicle) => vehicle.id}
        caption="Vehicle inventory"
        emptyState={
          <EmptyVehicles hasFilters={Boolean(filters.search || filters.status)} />
        }
      />

      {result.pageCount > 1 ? (
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          searchParams={searchParams}
        />
      ) : null}
    </div>
  )
}

/**
 * Two different empty states, because they call for different actions.
 *
 * "No vehicles yet" wants an invitation to add one; "nothing matched" wants
 * a way back to everything. Showing the first when a filter is active would
 * suggest the inventory is empty when it is not.
 */
function EmptyVehicles({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"
      >
        <Car className="size-6" />
      </span>

      {hasFilters ? (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-h3 font-semibold">No matches</h2>
            <p className="text-body text-muted-foreground">
              No vehicles match that search or filter.
            </p>
          </div>
          <Button render={<Link href={`${ADMIN_BASE_PATH}/vehicles`} />} variant="outline">
            Show all vehicles
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-h3 font-semibold">No vehicles yet</h2>
            <p className="max-w-sm text-body text-muted-foreground">
              Add your first vehicle. It starts as a draft, so nothing appears on
              the website until you publish it.
            </p>
          </div>
          <Button render={<Link href={`${ADMIN_BASE_PATH}/vehicles/new`} />}>
            <Plus aria-hidden="true" />
            Add vehicle
          </Button>
        </>
      )}
    </div>
  )
}

function Pagination({
  page,
  pageCount,
  total,
  searchParams,
}: {
  page: number
  pageCount: number
  total: number
  searchParams: Record<string, string | string[] | undefined>
}) {
  function hrefFor(target: number) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string" && key !== "page") params.set(key, value)
    }
    params.set("page", String(target))
    return `${ADMIN_BASE_PATH}/vehicles?${params.toString()}`
  }

  return (
    <nav
      aria-label="Vehicle list pages"
      className="flex items-center justify-between gap-4"
    >
      <p className="text-small text-muted-foreground">
        Page <span className="tabular-nums">{page}</span> of{" "}
        <span className="tabular-nums">{pageCount}</span> ·{" "}
        <span className="tabular-nums">{total}</span> vehicles
      </p>

      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button render={<Link href={hrefFor(page - 1)} />} variant="outline" size="sm">
            Previous
          </Button>
        ) : null}
        {page < pageCount ? (
          <Button render={<Link href={hrefFor(page + 1)} />} variant="outline" size="sm">
            Next
          </Button>
        ) : null}
      </div>
    </nav>
  )
}
