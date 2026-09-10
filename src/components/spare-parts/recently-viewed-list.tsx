"use client"

import * as React from "react"
import Link from "next/link"
import { History } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { RecentlyViewedTile } from "@/components/spare-parts/recently-viewed-parts"
import { Button } from "@/components/ui/button"
import {
  clearRecentlyViewed,
  getRecentlyViewedSnapshot,
  getServerRecentlyViewedLoaded,
  getServerRecentlyViewedSnapshot,
  isRecentlyViewedLoaded,
  subscribeRecentlyViewed,
} from "@/lib/recently-viewed/recently-viewed-store"

/**
 * The whole viewing history, as a grid.
 *
 * The strip on a part page shows the most recent handful; this is what its
 * "see all" link reaches. Same tiles, laid out as a grid rather than a
 * scroller, because here the list is the page rather than a band at the
 * bottom of one.
 *
 * ── Three states, and they are genuinely different ────────────────────
 *   not yet read  — storage has not been touched. Render nothing: an empty
 *                   state that flicks to six tiles a frame later is worse
 *                   than a frame of nothing, and this is reachable directly
 *                   from a bookmark where that frame is the whole page.
 *   read, empty   — a new browser, cleared site data, or a customer who has
 *                   cleared the list. Say so, and offer the catalogue.
 *   read, full    — the grid.
 *
 * ── Clearing it ──────────────────────────────────────────────────────
 * Offered because this is the customer's own data and a shared or borrowed
 * phone is the normal case in this market, not an edge one. It writes to
 * their browser and nowhere else — there is nothing on our side to delete —
 * so it takes effect immediately and needs no confirmation beyond being an
 * ordinary, clearly-labelled control set apart from the grid.
 */
export function RecentlyViewedList() {
  const entries = React.useSyncExternalStore(
    subscribeRecentlyViewed,
    getRecentlyViewedSnapshot,
    getServerRecentlyViewedSnapshot
  )

  const ready = React.useSyncExternalStore(
    subscribeRecentlyViewed,
    isRecentlyViewedLoaded,
    getServerRecentlyViewedLoaded
  )

  if (!ready) return null

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<History />}
        title="Nothing viewed yet"
        description="Parts you open are listed here so you can find your way back to them. The list is kept in this browser only — we never see it."
        action={
          <Button render={<Link href="/spare-parts" />}>Browse spare parts</Button>
        }
      />
    )
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className="text-small text-muted-foreground">
          {entries.length === 1
            ? "One part, kept in this browser only."
            : `${entries.length} parts, kept in this browser only.`}
        </p>

        <button
          type="button"
          onClick={clearRecentlyViewed}
          className="text-small font-medium text-muted-foreground underline-offset-4 transition-colors duration-fast hover:text-destructive hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Clear history
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
        {entries.map((part) => (
          <li key={part.slug} className="flex">
            <div className="w-full">
              <RecentlyViewedTile part={part} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
