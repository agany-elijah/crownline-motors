"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useId, useState, useTransition } from "react"
import { Loader2, PackageX, Search, X } from "lucide-react"

import { SparePartStatus } from "@/generated/prisma/enums"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  SPARE_PART_AVAILABILITY_OPTIONS,
  SPARE_PART_STATUS_LABELS,
} from "@/lib/constants/spare-part-options"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import type { SparePartCategoryOption } from "@/lib/queries/spare-part.queries"

interface SparePartListFiltersProps {
  /** Row counts per status, for the chips. Absent keys render as zero. */
  statusCounts: Record<string, number>
  total: number
  categories: Array<SparePartCategoryOption & { partCount: number }>
}

const STATUS_ORDER: SparePartStatus[] = [
  SparePartStatus.DRAFT,
  SparePartStatus.PUBLISHED,
  SparePartStatus.ARCHIVED,
]

/**
 * Search, status, category and stock filtering for the parts list.
 *
 * State lives in the URL, not in this component. That is what makes a
 * filtered list shareable, survivable across a refresh, and navigable with
 * the browser's back button — an operator who filters to out-of-stock parts,
 * opens one, and presses Back expects that list, not everything.
 */
export function SparePartListFilters({
  statusCounts,
  total,
  categories,
}: SparePartListFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const searchId = useId()
  const categoryId = useId()
  const availabilityId = useId()

  const activeStatus = searchParams.get("status")
  const activeAvailability = searchParams.get("availability") ?? ""
  const activeCategory = searchParams.get("categoryId") ?? ""
  const activeOutOfStock = searchParams.get("outOfStock") === "1"
  const urlSearch = searchParams.get("search") ?? ""

  // Local mirror so typing stays responsive while the debounced navigation
  // catches up.
  const [search, setSearch] = useState(urlSearch)

  /**
   * Re-sync when the URL changes from outside this component — a back
   * navigation, or the Clear control below. Adjusted during render rather
   * than in an effect: React documents this as the correct shape for "reset
   * state when a prop changes", and it applies before anything is committed
   * to the DOM, so there is no flash of the stale value.
   */
  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch)
  if (urlSearch !== lastUrlSearch) {
    setLastUrlSearch(urlSearch)
    setSearch(urlSearch)
  }

  function apply(next: {
    search?: string
    status?: string | null
    availability?: string | null
    categoryId?: string | null
    outOfStock?: boolean
  }) {
    const params = new URLSearchParams(searchParams.toString())

    if (next.search !== undefined) {
      if (next.search) params.set("search", next.search)
      else params.delete("search")
    }

    if (next.status !== undefined) {
      if (next.status) params.set("status", next.status)
      else params.delete("status")
    }

    if (next.availability !== undefined) {
      if (next.availability) params.set("availability", next.availability)
      else params.delete("availability")
    }

    if (next.categoryId !== undefined) {
      if (next.categoryId) params.set("categoryId", next.categoryId)
      else params.delete("categoryId")
    }

    if (next.outOfStock !== undefined) {
      if (next.outOfStock) params.set("outOfStock", "1")
      else params.delete("outOfStock")
    }

    // Any filter change returns to the first page. Staying on page 3 of a
    // result set that now has one page shows an empty list and looks like
    // the filter matched nothing.
    params.delete("page")

    startTransition(() => {
      router.push(`${ADMIN_BASE_PATH}/spare-parts?${params.toString()}`, {
        scroll: false,
      })
    })
  }

  /**
   * Debounced so the list is not re-queried on every keystroke. 350ms is
   * long enough to skip the intermediate states of a typed word and short
   * enough that the result feels like a consequence of typing rather than of
   * stopping.
   */
  useEffect(() => {
    if (search === urlSearch) return

    const timer = setTimeout(() => apply({ search }), 350)
    return () => clearTimeout(timer)
    // `apply` is stable enough for this purpose; re-running on every render
    // would reset the timer continuously and the search would never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, urlSearch])

  const hasFilters =
    Boolean(activeStatus) ||
    Boolean(activeAvailability) ||
    Boolean(activeCategory) ||
    activeOutOfStock ||
    Boolean(urlSearch)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-md">
          <Label htmlFor={searchId} className="sr-only">
            Search spare parts
          </Label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, part number or reference…"
            className="pl-9"
          />
          {isPending ? (
            <Loader2
              aria-hidden="true"
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          ) : null}
        </div>

        {/*
          A select rather than another row of chips. Twelve categories would
          wrap to three lines of chips on a laptop and push the table below
          the fold, and unlike status they are not a state an operator scans
          for — they are a place they navigate to.
        */}
        <div className="flex flex-col gap-1 sm:w-56">
          <Label htmlFor={categoryId} className="sr-only">
            Filter by category
          </Label>
          <select
            id={categoryId}
            value={activeCategory}
            onChange={(event) => apply({ categoryId: event.target.value || null })}
            className={cn(
              "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground",
              "transition-colors outline-none",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "md:text-sm"
            )}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.partCount})
                {category.isActive ? "" : " — retired"}
              </option>
            ))}
          </select>
        </div>

        {/*
          Availability, as a select beside the category one.

          A select rather than chips for the same reason categories are: six
          more chips would wrap the filter row onto a third line and push the
          table below the fold, and unlike status this is not a state an
          operator scans — it is one they occasionally narrow to ("what is
          everything I have marked out of stock").

          It is deliberately separate from the "Out of stock" toggle beside
          it. That one reads `stockQuantity = 0` — what we have counted — and
          this reads the published promise. The most useful query in this
          dashboard is the disagreement between them: parts claiming to be in
          stock with nothing behind them.
        */}
        <div className="flex flex-col gap-1 sm:w-52">
          <Label htmlFor={availabilityId} className="sr-only">
            Filter by availability
          </Label>
          <select
            id={availabilityId}
            value={activeAvailability}
            onChange={(event) =>
              apply({ availability: event.target.value || null })
            }
            className={cn(
              "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground",
              "transition-colors outline-none",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "md:text-sm"
            )}
          >
            <option value="">Any availability</option>
            {SPARE_PART_AVAILABILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="All"
          count={total}
          active={!activeStatus}
          onClick={() => apply({ status: null })}
        />

        {STATUS_ORDER.map((status) => (
          <FilterChip
            key={status}
            label={SPARE_PART_STATUS_LABELS[status]}
            count={statusCounts[status] ?? 0}
            active={activeStatus === status}
            onClick={() => apply({ status: activeStatus === status ? null : status })}
          />
        ))}

        {/*
          "Show me what I cannot sell." Separate from the status chips because
          it is orthogonal to them — a part can be out of stock in any status,
          and combining the two answers the question that actually gets asked:
          which live listings have nothing behind them.
        */}
        <button
          type="button"
          onClick={() => apply({ outOfStock: !activeOutOfStock })}
          aria-pressed={activeOutOfStock}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-small font-medium",
            "transition-colors duration-fast",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            activeOutOfStock
              ? "border-gold-ink/45 bg-accent text-accent-foreground"
              : "border-border bg-card text-muted-foreground hover:border-gold-ink/30 hover:text-foreground"
          )}
        >
          <PackageX aria-hidden="true" className="size-3.5" />
          Out of stock
        </button>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("")
              apply({ search: "", status: null, categoryId: null, outOfStock: false })
            }}
            className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-small text-muted-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden="true" className="size-3.5" />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-small font-medium",
        "transition-colors duration-fast",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-gold-ink/45 bg-accent text-accent-foreground"
          : "border-border bg-card text-muted-foreground hover:border-gold-ink/30 hover:text-foreground"
      )}
    >
      {label}
      {/* No opacity here. The chip label is already --muted-foreground when
          inactive; fading the count on top of that puts it under 3:1. */}
      <span className="text-xs tabular-nums">{count}</span>
    </button>
  )
}
