import type { Metadata } from "next"
import Link from "next/link"
import { Car, Plus } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { Pagination } from "@/components/shared/pagination"
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
        <div className="flex flex-col gap-3">
          <p className="text-small text-muted-foreground">
            <span className="tabular">{result.total}</span> vehicles
          </p>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(target) => paginationHref(searchParams, target)}
            label="Vehicle list pages"
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

/**
 * A list URL with the current search and status filters preserved.
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
    ? `${ADMIN_BASE_PATH}/vehicles?${query}`
    : `${ADMIN_BASE_PATH}/vehicles`
}
