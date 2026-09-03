"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Specifications and features, one at a time.
 *
 * ── Why these two share a surface ─────────────────────────────────────
 * They answer the same question — "what is this car" — from two sides:
 * the measured facts, and the equipment. Stacked, they make a wall of
 * fifty short lines that a buyer scrolls past rather than reads. Side by
 * side, neither gets the width its layout wants. A toggle gives both the
 * full measure and lets the buyer pick which question they are asking.
 *
 * ── This one *is* an ARIA tablist, unlike the gallery ─────────────────
 * VehicleGallery deliberately marks its thumbnails as plain buttons,
 * because it has one panel whose contents change. Here there are genuinely
 * two labelled panels, so the tab pattern is the honest description — and
 * committing to it means implementing all of it: roving focus, arrow keys,
 * Home/End, and `tabIndex={-1}` on the inactive tab so the tablist is one
 * tab stop rather than two.
 *
 * ── Why the inactive panel is unmounted, not hidden ───────────────────
 * `hidden` would keep both in the DOM, which is right for a gallery
 * preloading images and wrong here: the hidden panel's headings would stay
 * in the accessibility tree's document outline, and a specification and a
 * feature list are read out of order by a screen reader navigating by
 * heading. Neither panel holds state worth preserving across a toggle.
 */

export interface VehicleSpecification {
  label: string
  value: string
}

interface VehicleDetailTabsProps {
  specifications: VehicleSpecification[]
  features: string[]
}

type TabId = "specifications" | "features"

const TABS: { id: TabId; label: string }[] = [
  { id: "specifications", label: "Specifications" },
  { id: "features", label: "Features" },
]

export function VehicleDetailTabs({
  specifications,
  features,
}: VehicleDetailTabsProps) {
  const [active, setActive] = React.useState<TabId>("specifications")

  /**
   * One ref per tab, so a key press can move focus as well as selection.
   * A tablist that changes the selected tab without following it with
   * focus leaves a keyboard user's focus ring on a tab that is no longer
   * the one they are reading.
   */
  const tabRefs = React.useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})

  function select(id: TabId) {
    setActive(id)
    tabRefs.current[id]?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((tab) => tab.id === active)

    switch (event.key) {
      case "ArrowRight":
      case "ArrowLeft": {
        event.preventDefault()
        const delta = event.key === "ArrowRight" ? 1 : -1
        // Wraps, so the ends of a two-tab list are never dead.
        select(TABS[(index + delta + TABS.length) % TABS.length].id)
        break
      }
      case "Home":
        event.preventDefault()
        select(TABS[0].id)
        break
      case "End":
        event.preventDefault()
        select(TABS[TABS.length - 1].id)
        break
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/*
        The switcher is a rule with a travelling gold marker rather than a
        pill-shaped segmented control. A filled segment would read as a
        pressed button sitting a few hundred pixels from the page's one
        gold CTA, which is exactly the badge/button ambiguity the design
        system exists to prevent.
      */}
      <div
        role="tablist"
        aria-label="Vehicle details"
        onKeyDown={onKeyDown}
        className="flex items-stretch gap-8 border-b border-border"
      >
        {TABS.map((tab) => {
          const selected = tab.id === active

          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node
              }}
              type="button"
              role="tab"
              id={`${tab.id}-tab`}
              aria-selected={selected}
              aria-controls={`${tab.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={cn(
                "relative -mb-px cursor-pointer pb-4 font-heading text-h3 tracking-tight",
                "transition-colors duration-fast ease-crownline",
                "focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
                selected
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
                // The marker is the element's own bottom border, so it
                // cannot drift out of alignment with the rule it sits on.
                "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full",
                "after:transition-[background-color,opacity] after:duration-base after:ease-crownline",
                selected ? "after:bg-gold after:opacity-100" : "after:opacity-0"
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {active === "specifications" ? (
        <div
          role="tabpanel"
          id="specifications-panel"
          aria-labelledby="specifications-tab"
          /**
           * Focusable, because a panel whose content is not itself
           * focusable strands a screen-reader user who has just activated
           * the tab: without this, the next Tab jumps past the panel
           * entirely to whatever follows the section.
           */
          tabIndex={0}
          className="focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {/*
            Two columns from `sm`, filling the section's width rather than
            running one long ladder down a narrow card. The `<dl>` is the
            grid itself so each label/value pair stays a single term and
            definition — wrapping pairs in `<div>`s to lay them out is
            valid HTML but reads worse in a screen reader's list of terms.
          */}
          <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {specifications.map((spec) => (
              <div
                key={spec.label}
                className="flex items-baseline justify-between gap-4 border-b border-border py-3.5"
              >
                <dt className="text-small text-muted-foreground">{spec.label}</dt>
                <dd className="tabular text-right text-small font-medium">
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div
          role="tabpanel"
          id="features-panel"
          aria-labelledby="features-tab"
          tabIndex={0}
          className="focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {features.length > 0 ? (
            <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 border-b border-border py-3.5 text-small"
                >
                  {/* A gold tick rather than a list marker: this is the one
                      place on the page where a run of small gold accents
                      earns its keep, and it distinguishes "this car has
                      it" from a neutral bullet. */}
                  <CheckIcon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-gold-ink"
                  />
                  <span className="font-medium">{feature}</span>
                </li>
              ))}
            </ul>
          ) : (
            /**
             * Stated plainly rather than hiding the tab when the list is
             * empty. A tab that appears on some listings and not others
             * makes the page look broken to someone comparing two cars,
             * and "ask us" is a truthful answer that routes them somewhere.
             */
            <p className="max-w-xl text-body text-muted-foreground">
              The equipment list for this vehicle has not been published yet.
              Message us and we will confirm exactly what it carries.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
