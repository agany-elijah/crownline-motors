"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useId, useState, useTransition } from "react"
import { ChevronDown, Loader2, Search, SlidersHorizontal, X } from "lucide-react"

import { QuoteStatus, QuoteType } from "@/generated/prisma/enums"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
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
  const statusFiltersId = useId()

  const activeStatus = searchParams.get("status")
  const activeType = searchParams.get("type")
  const urlSearch = searchParams.get("search") ?? ""

  // Collapsed by default — a status a customer's quote is already sitting in
  // is scannable at a glance in the table's own status column, so the full
  // New/Contacted/Sent/… row only earns its space once an operator actually
  // wants to narrow the list. Opens itself if a status filter is already
  // active (arriving via a shared/bookmarked filtered URL, say), so the
  // control a filter is coming from is never hidden while it is in effect.
  const [filtersOpen, setFiltersOpen] = useState(() => Boolean(activeStatus))

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

  const activeStatusLabel = activeStatus
    ? QUOTE_STATUS_LABELS[activeStatus as QuoteStatus]
    : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Label htmlFor={searchId} className="sr-only">
            Search quotes
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
            placeholder="Search quote number, name, phone or email…"
            className="pl-9"
          />
          {isPending ? (
            <Loader2
              aria-hidden="true"
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          ) : null}
        </div>

        <TypeToggle
          active={activeType as QuoteType | null}
          onChange={(type) => apply({ type })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((current) => !current)}
          aria-expanded={filtersOpen}
          aria-controls={statusFiltersId}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-small font-medium text-muted-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <SlidersHorizontal aria-hidden="true" className="size-3.5" />
          Filters
          {activeStatusLabel ? (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-gold-ink">
              {activeStatusLabel}
            </span>
          ) : null}
          <ChevronDown
            aria-hidden="true"
            className={cn("size-3.5 transition-transform duration-fast", filtersOpen && "rotate-180")}
          />
        </button>

        {activeStatus || activeType || urlSearch ? (
          <button
            type="button"
            onClick={() => {
              setSearch("")
              apply({ search: "", status: null, type: null })
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-small text-muted-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden="true" className="size-3.5" />
            Clear all
          </button>
        ) : null}
      </div>

      {filtersOpen ? (
        <div id={statusFiltersId} className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All"
            count={total}
            active={!activeStatus}
            onClick={() => apply({ status: null })}
          />

          {QUOTE_STATUS_ORDER.map((status) => (
            <FilterChip
              key={status}
              label={QUOTE_STATUS_LABELS[status]}
              count={statusCounts[status] ?? 0}
              active={activeStatus === status}
              emphasize={status === QuoteStatus.NEW && (statusCounts[status] ?? 0) > 0}
              onClick={() => apply({ status: activeStatus === status ? null : status })}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function FilterChip({
  label,
  count,
  active,
  emphasize = false,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  emphasize?: boolean
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
      <span
        className={cn(
          "text-xs tabular-nums",
          emphasize && !active && "font-bold text-warning"
        )}
      >
        {count}
      </span>
    </button>
  )
}

/**
 * Vehicle vs. spare-parts quotations, as one segmented control rather than
 * two independent chips.
 *
 * Two `TypeChip`s could both read "off" at once, which is a perfectly valid
 * state (no type filter) but not one a glance at two separate buttons
 * communicates — nothing about them said they were mutually exclusive. A
 * single grouped control with three positions (All / Vehicles / Spare
 * parts) makes "what am I currently looking at" legible at a glance, the
 * same way a light switch reads as one thing in one of two states rather
 * than as two independent buttons that happen to be wired together.
 */
function TypeToggle({
  active,
  onChange,
}: {
  active: QuoteType | null
  onChange: (type: QuoteType | null) => void
}) {
  const options: { value: QuoteType | null; label: string }[] = [
    { value: null, label: "All" },
    { value: QuoteType.VEHICLE, label: QUOTE_TYPE_LABELS[QuoteType.VEHICLE] },
    { value: QuoteType.SPARE_PART, label: QUOTE_TYPE_LABELS[QuoteType.SPARE_PART] },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Quote type"
      className="inline-flex items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={active === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-small font-medium transition-colors duration-fast",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            active === option.value
              ? "bg-card text-foreground shadow-[var(--shadow-subtle)]"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
