"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Bell, X } from "lucide-react"

import { getQuoteLeadCountAction } from "@/lib/actions/quote-lead-watch.actions"
import { Button } from "@/components/ui/button"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

const POLL_INTERVAL_MS = 30_000

/**
 * A quiet, in-app stand-in for "background push alerts for incoming leads".
 *
 * There is no push infrastructure in this stack yet (no service worker, no
 * subscription store, no external push provider — all Phase 2/3 territory
 * per the roadmap), so this does the useful part of the job without
 * inventing that infrastructure: while an operator has the dashboard open in
 * a tab, it polls the count of NEW quotes and surfaces a dismissible banner
 * the moment that count rises above what was last seen. It never fires for
 * a quote the operator has already acted on, and it goes quiet on its own
 * — no sound, no browser-level notification permission prompt.
 *
 * `lastSeenRef` rather than `useState` for the baseline: it must update
 * synchronously inside the same poll that reads the new count, or a second
 * poll landing before a re-render would compare against a stale baseline
 * and could double-fire the banner for one new lead.
 */
export function QuoteLeadWatcher() {
  const pathname = usePathname()
  const [newCount, setNewCount] = useState(0)
  const lastSeenRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      const count = await getQuoteLeadCountAction()
      if (cancelled) return

      if (lastSeenRef.current !== null && count > lastSeenRef.current) {
        setNewCount(count)
      }

      lastSeenRef.current = count
    }

    // The baseline read happens immediately so a lead that arrives on the
    // very first poll after that is still caught; it does not itself show a
    // banner, since "here is everything already waiting" is not a new alert.
    void poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  /**
   * A visit to the quotes list clears the banner — adjusted during render
   * rather than in an effect (see `VehicleListFilters` for the same
   * pattern), so the banner never has one extra frame where it is visible on
   * a page that has just shown the operator the queue it is about to name.
   */
  const onQuotesList = pathname === `${ADMIN_BASE_PATH}/quotes`
  const [wasOnQuotesList, setWasOnQuotesList] = useState(onQuotesList)
  if (onQuotesList !== wasOnQuotesList) {
    setWasOnQuotesList(onQuotesList)
    if (onQuotesList) setNewCount(0)
  }

  if (newCount === 0) return null

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-40 flex max-w-xs items-start gap-3 rounded-xl border border-gold-ink/30 bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
    >
      <Bell aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold-ink" />
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-small font-medium">
          {newCount} new enquir{newCount === 1 ? "y" : "ies"} waiting
        </p>
        <Button
          render={<Link href={`${ADMIN_BASE_PATH}/quotes?status=NEW`} />}
          size="sm"
          onClick={() => setNewCount(0)}
        >
          View
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setNewCount(0)}
        aria-label="Dismiss"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}
