"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useId, useState, useTransition } from "react"

import { QuoteStatus, QuoteType } from "@/generated/prisma/enums"
import {
  AdminClearFilters,
  AdminFilterTab,
  AdminFilterTabs,
  AdminSearchInput,
  AdminSegmentedControl,
} from "@/components/admin/admin-list-toolbar"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_ORDER, QUOTE_TYPE_LABELS } from "@/lib/constants/quote-status"

interface QuoteListFiltersProps {
  statusCounts: Record<string, number>
  total: number
}

/**
 * Search and status/type filtering for the quotes master view.
 *
 * State lives in the URL — the same rule `VehicleListFilters` follows, for
 * the same reason: a filtered list is then shareable, survives a refresh,
 * and behaves correctly with the browser's back button.
 */
export function QuoteListFilters({ statusCounts, total }: QuoteListFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const searchId = useId()

  const activeStatus = searchParams.get("status")
  const activeType = searchParams.get("type")
  const urlSearch = searchParams.get("search") ?? ""

  const [search, setSearch] = useState(urlSearch)

  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch)
  if (urlSearch !== lastUrlSearch) {
    setLastUrlSearch(urlSearch)
    setSearch(urlSearch)
  }

  function apply(next: { search?: string; status?: string | null; type?: string | null }) {
    const params = new URLSearchParams(searchParams.toString())

    if (next.search !== undefined) {
      if (next.search) params.set("search", next.search)
      else params.delete("search")
    }

    if (next.status !== undefined) {
      if (next.status) params.set("status", next.status)
      else params.delete("status")
    }

    if (next.type !== undefined) {
      if (next.type) params.set("type", next.type)
      else params.delete("type")
    }

    params.delete("page")

    startTransition(() => {
      router.push(`${ADMIN_BASE_PATH}/quotes?${params.toString()}`, { scroll: false })
    })
  }

  useEffect(() => {
    if (search === urlSearch) return

    const timer = setTimeout(() => apply({ search }), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, urlSearch])

  const typeOptions: { value: QuoteType | null; label: string }[] = [
    { value: null, label: "All types" },
    { value: QuoteType.VEHICLE, label: QUOTE_TYPE_LABELS[QuoteType.VEHICLE] },
    { value: QuoteType.SPARE_PART, label: QUOTE_TYPE_LABELS[QuoteType.SPARE_PART] },
  ]

  /*
   * The statuses are always in view as a tab row. They used to sit behind a
   * "Filters" disclosure because as bordered chips they took two lines; as
   * tabs they take one, and "how many are New" is the question an operator
   * opens this list to answer.
   */
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <AdminSearchInput
            id={searchId}
            label="Search quotes"
            value={search}
            onChange={setSearch}
            placeholder="Quote number, name, phone or email…"
            pending={isPending}
            className="sm:w-80 sm:max-w-none"
          />

          {/*
            Vehicle vs. spare-parts quotations, as one segmented control rather
            than two independent chips: two chips can both read "off", which is
            a valid state (no type filter) that nothing about two separate
            buttons communicates. One control in one of three positions reads
            as exactly that.
          */}
          <AdminSegmentedControl
            label="Quote type"
            options={typeOptions}
            value={activeType as QuoteType | null}
            onChange={(type) => apply({ type })}
            className="self-start sm:self-auto"
          />
        </div>

        {activeStatus || activeType || urlSearch ? (
          <AdminClearFilters
            onClick={() => {
              setSearch("")
              apply({ search: "", status: null, type: null })
            }}
          />
        ) : null}
      </div>

      <AdminFilterTabs label="Filter by status">
        <AdminFilterTab label="All" count={total} active={!activeStatus} onClick={() => apply({ status: null })} />

        {QUOTE_STATUS_ORDER.map((status) => (
          <AdminFilterTab
            key={status}
            label={QUOTE_STATUS_LABELS[status]}
            count={statusCounts[status] ?? 0}
            active={activeStatus === status}
            emphasize={status === QuoteStatus.NEW && (statusCounts[status] ?? 0) > 0}
            onClick={() => apply({ status: activeStatus === status ? null : status })}
          />
        ))}
      </AdminFilterTabs>
    </div>
  )
}
