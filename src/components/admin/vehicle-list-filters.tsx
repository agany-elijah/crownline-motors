"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useId, useState, useTransition } from "react"

import { VehicleStatus } from "@/generated/prisma/enums"
import {
  AdminClearFilters,
  AdminFilterTab,
  AdminFilterTabs,
  AdminSearchInput,
} from "@/components/admin/admin-list-toolbar"
import { VEHICLE_STATUS_LABELS } from "@/lib/constants/vehicle-options"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

interface VehicleListFiltersProps {
  /** Row counts per status, for the chips. Absent keys render as zero. */
  statusCounts: Record<string, number>
  total: number
}

const STATUS_ORDER: VehicleStatus[] = [
  VehicleStatus.DRAFT,
  VehicleStatus.PUBLISHED,
  VehicleStatus.RESERVED,
  VehicleStatus.SOLD,
  VehicleStatus.ARCHIVED,
]

/**
 * Search and status filtering for the vehicle list.
 *
 * State lives in the URL, not in this component. That is what makes a
 * filtered list shareable, survivable across a refresh, and navigable with
 * the browser's back button — an operator who filters to Drafts, opens one,
 * and presses Back expects the Drafts list, not everything.
 */
export function VehicleListFilters({
  statusCounts,
  total,
}: VehicleListFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const searchId = useId()

  const activeStatus = searchParams.get("status")
  const urlSearch = searchParams.get("search") ?? ""

  // Local mirror so typing stays responsive while the debounced navigation
  // catches up.
  const [search, setSearch] = useState(urlSearch)

  /**
   * Re-sync when the URL changes from outside this component — a back
   * navigation, or the Clear control below. Without it the input keeps
   * showing a term the list is no longer filtered by.
   *
   * Adjusted during render rather than in an effect. React documents this
   * as the correct shape for "reset state when a prop changes": the state
   * update is applied before anything is committed to the DOM, so there is
   * no flash of the stale value and no second render pass. Doing it in an
   * effect renders the wrong value once, then corrects it — which is both
   * slower and visible.
   */
  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch)
  if (urlSearch !== lastUrlSearch) {
    setLastUrlSearch(urlSearch)
    setSearch(urlSearch)
  }

  function apply(next: { search?: string; status?: string | null }) {
    const params = new URLSearchParams(searchParams.toString())

    if (next.search !== undefined) {
      if (next.search) params.set("search", next.search)
      else params.delete("search")
    }

    if (next.status !== undefined) {
      if (next.status) params.set("status", next.status)
      else params.delete("status")
    }

    // Any filter change returns to the first page. Staying on page 3 of a
    // result set that now has one page shows an empty list and looks like
    // the filter matched nothing.
    params.delete("page")

    startTransition(() => {
      router.push(`${ADMIN_BASE_PATH}/vehicles?${params.toString()}`, { scroll: false })
    })
  }

  /**
   * Debounced so the list is not re-queried on every keystroke.
   *
   * 350ms is long enough to skip the intermediate states of a typed word
   * and short enough that the result feels like a consequence of typing
   * rather than of stopping.
   */
  useEffect(() => {
    if (search === urlSearch) return

    const timer = setTimeout(() => apply({ search }), 350)
    return () => clearTimeout(timer)
    // `apply` is stable enough for this purpose; re-running on every render
    // would reset the timer continuously and the search would never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, urlSearch])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          id={searchId}
          label="Search vehicles"
          value={search}
          onChange={setSearch}
          placeholder="Search make, model or reference…"
          pending={isPending}
        />

        {activeStatus || urlSearch ? (
          <AdminClearFilters
            onClick={() => {
              setSearch("")
              apply({ search: "", status: null })
            }}
          />
        ) : null}
      </div>

      <AdminFilterTabs label="Filter by status">
        <AdminFilterTab label="All" count={total} active={!activeStatus} onClick={() => apply({ status: null })} />

        {STATUS_ORDER.map((status) => (
          <AdminFilterTab
            key={status}
            label={VEHICLE_STATUS_LABELS[status]}
            count={statusCounts[status] ?? 0}
            active={activeStatus === status}
            onClick={() => apply({ status: activeStatus === status ? null : status })}
          />
        ))}
      </AdminFilterTabs>
    </div>
  )
}
