"use client"

import * as React from "react"
import { Loader2, Search, X, type LucideIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * The controls above a dashboard list: status tabs, a search field, and the
 * occasional segmented switch.
 *
 * Presentation only. Each list's filter component still owns its URL state and
 * decides what a click means; these pieces only decide how that looks, so the
 * vehicle, spare-part and quote lists read as one product instead of three
 * slightly different ones.
 */

/** The row of status tabs, with a hairline under it that the active tab sits on. */
export function AdminFilterTabs({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "no-scrollbar -mx-4 flex min-w-0 items-end gap-5 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * One status tab. `aria-pressed` rather than tab semantics: these filter one
 * table, they do not swap panels, so a toggle button is what they are.
 */
export function AdminFilterTab({
  label,
  count,
  active,
  emphasize = false,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  /** Draws the count in gold — for the one bucket that wants attention, e.g. new quotes. */
  emphasize?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group/tab relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 text-small font-medium whitespace-nowrap",
        "transition-colors duration-fast ease-crownline outline-none",
        "focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-gold",
        "after:transition-transform after:duration-fast after:ease-crownline",
        active
          ? "text-foreground after:scale-x-100"
          : "text-muted-foreground after:scale-x-0 hover:text-foreground"
      )}
    >
      {label}
      <span
        className={cn(
          "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[0.6875rem] tabular-nums",
          "transition-colors duration-fast",
          active
            ? "bg-foreground text-background"
            : emphasize
              ? "bg-accent text-gold-ink"
              : "bg-secondary text-muted-foreground group-hover/tab:text-foreground"
        )}
      >
        {count}
      </span>
    </button>
  )
}

/** A search field with the pending spinner that tells an operator the list is catching up. */
export function AdminSearchInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  pending = false,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  pending?: boolean
  className?: string
}) {
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pr-9 pl-9"
      />
      {pending ? (
        <Loader2
          aria-hidden="true"
          className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
        />
      ) : null}
    </div>
  )
}

/** A small set of mutually exclusive options, as one control. */
export function AdminSegmentedControl<TValue extends string | null>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: { value: TValue; label: string }[]
  value: TValue
  onChange: (value: TValue) => void
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex h-(--control-height) shrink-0 items-center gap-0.5 rounded-lg border border-border bg-sunken p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const checked = value === option.value

        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-full cursor-pointer items-center rounded-md px-3 text-small font-medium whitespace-nowrap",
              "transition-[color,background-color,box-shadow] duration-fast ease-crownline",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              checked
                ? "bg-card text-foreground shadow-[var(--shadow-subtle)] ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * An on/off filter that is not one of the status tabs — "Out of stock", say,
 * which cuts across every status rather than being one of them.
 */
export function AdminToggleFilter({
  pressed,
  onClick,
  icon: Icon,
  children,
}: {
  pressed: boolean
  onClick: () => void
  icon?: LucideIcon
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-(--control-height) shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-small font-medium whitespace-nowrap",
        "transition-colors duration-fast ease-crownline",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        pressed
          ? "border-gold-ink/40 bg-accent text-accent-foreground"
          : "border-input bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground"
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
      {children}
    </button>
  )
}

/** Resets every filter on a list. Rendered only while one is in effect. */
export function AdminClearFilters({ onClick, children = "Clear filters" }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-small font-medium text-muted-foreground",
        "transition-colors duration-fast hover:bg-secondary hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      )}
    >
      <X aria-hidden="true" className="size-3.5" />
      {children}
    </button>
  )
}

/** "32 vehicles", under a list — the count a pager on its own does not give. */
export function AdminListCount({ total, noun }: { total: number; noun: string }) {
  return (
    <p className="text-small text-muted-foreground">
      <span className="text-foreground tabular-nums">{total}</span> {noun}
    </p>
  )
}
