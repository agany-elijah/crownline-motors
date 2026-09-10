"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ImageOff } from "lucide-react"

import { Container } from "@/components/layout/container"
import { Section } from "@/components/layout/section"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format-currency"
import {
  RECENTLY_VIEWED_STRIP_LIMIT,
  type RecentlyViewedPart,
} from "@/lib/recently-viewed/recently-viewed-storage"
import {
  getRecentlyViewedSnapshot,
  getServerRecentlyViewedLoaded,
  getServerRecentlyViewedSnapshot,
  isRecentlyViewedLoaded,
  recordRecentlyViewed,
  subscribeRecentlyViewed,
} from "@/lib/recently-viewed/recently-viewed-store"

/**
 * "Recently viewed" — the parts this customer has already looked at.
 *
 * ── Where it sits, and why there ──────────────────────────────────────
 * Directly below "More in this category", at the very bottom of a part page.
 * That order is deliberate: the category strip is a *suggestion*, which is
 * the business talking, and this is the customer's own trail back to
 * something they were comparing. Someone who has scrolled past a full listing
 * and a row of suggestions without acting is usually trying to get back to
 * the one they saw two parts ago, and this is the shortest route to it.
 *
 * ── Why it renders nothing on a first visit ───────────────────────────
 * A new customer has no history, and a heading over an empty row would open
 * the page's last impression on something that does not work. It also renders
 * nothing while there is only the current part to show — a "recently viewed"
 * row containing exactly the page you are on is a mirror, not a shortcut.
 *
 * ── The data is the customer's, and never leaves their browser ────────
 * Read through `useSyncExternalStore` from `localStorage` (see
 * `recently-viewed-store.ts`). Nothing is written to the database, nothing is
 * sent anywhere, and it disappears with the browser it belongs to. That is
 * not only a privacy position — it is what lets this render with no query on
 * a page that is already doing three.
 *
 * The entries are snapshots taken when the part was viewed, so a price here
 * can be one visit stale. The card links to the live listing and the card
 * itself says nothing that would commit the business, which is why a
 * shortlist can afford a staleness a catalogue could not.
 */
interface RecentlyViewedPartsProps {
  /**
   * The part currently being read, excluded from the strip.
   *
   * Passed rather than inferred from the route, because this component is
   * also rendered on the catalogue — where nothing is excluded.
   */
  excludeSlug?: string
  /** How many to show before the "see all" link takes over. */
  limit?: number
}

export function RecentlyViewedParts({
  excludeSlug,
  limit = RECENTLY_VIEWED_STRIP_LIMIT,
}: RecentlyViewedPartsProps) {
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

  const visible = React.useMemo(
    () => entries.filter((entry) => entry.slug !== excludeSlug),
    [entries, excludeSlug]
  )

  // `ready` is false during the server render and hydration. Rendering the
  // strip before storage has been read would flash an empty band in and then
  // populate it, which is worse than one frame of nothing.
  if (!ready || visible.length === 0) return null

  const shown = visible.slice(0, limit)
  const hasMore = visible.length > shown.length

  return (
    <Section spacing="compact" className="border-t border-border">
      <Container className="flex flex-col gap-4 px-0">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-title">Recently viewed</h2>

          {/*
            A link, not a button.

            It is a way back to a list the customer already has, not an action
            the business is asking for — and the page below it already carries
            two real calls to action in gold. Sized and weighted like a
            breadcrumb so it reads as navigation, with the arrow shifting on
            hover as the one piece of motion it gets.

            Rendered only when there is genuinely more to see: a "see all"
            leading to the six cards already on screen is a link that lies.
          */}
          {hasMore ? (
            <Link
              href="/spare-parts/recently-viewed"
              className={cn(
                "group/all inline-flex shrink-0 items-center gap-1 text-small font-medium",
                "text-muted-foreground transition-colors duration-fast hover:text-gold-ink",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              )}
            >
              See all {visible.length}
              <ArrowRight
                aria-hidden="true"
                className="size-3.5 transition-transform duration-fast ease-crownline group-hover/all:translate-x-0.5"
              />
            </Link>
          ) : null}
        </div>

        <RecentlyViewedRow parts={shown} />
      </Container>
    </Section>
  )
}

/**
 * The row itself.
 *
 * Deliberately not `SparePartCard`: these are small, dense tiles rather than
 * catalogue cards. A history strip is a *shortcut*, and reproducing the full
 * card — availability tag, fitment line, gold add button — would give the
 * page's last band the same visual weight as the catalogue above it, from
 * snapshot data that is a visit old. Half the height and no controls is the
 * honest size for "you looked at these".
 *
 * Native horizontal scrolling with snap points, matching `CardCarousel`: two
 * and a bit tiles visible on a phone so the next one peeks past the edge,
 * which is the affordance that says the row scrolls and the reason its
 * scrollbar can be hidden.
 *
 * Exported so the "see all" page can render the same tiles in a grid without
 * a second implementation of them.
 */
export function RecentlyViewedRow({ parts }: { parts: RecentlyViewedPart[] }) {
  return (
    <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {parts.map((part) => (
        <li
          key={part.slug}
          className="w-[38%] shrink-0 snap-start sm:w-40 lg:w-44"
        >
          <RecentlyViewedTile part={part} />
        </li>
      ))}
    </ul>
  )
}

export function RecentlyViewedTile({ part }: { part: RecentlyViewedPart }) {
  return (
    <Link
      href={`/spare-parts/${part.slug}`}
      className={cn(
        "group/tile flex h-full flex-col overflow-hidden rounded-[4px] border border-border bg-card",
        "transition-[border-color,box-shadow] duration-base ease-crownline",
        "hover:border-gold-ink/30 hover:shadow-[var(--shadow-subtle)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      )}
    >
      <div className="relative aspect-square shrink-0 overflow-hidden bg-muted">
        {part.imageUrl ? (
          <Image
            src={part.imageUrl}
            // Decorative: the part's name is the next thing in the reading
            // order, so describing the photograph would announce it twice.
            alt=""
            fill
            sizes="(min-width: 1024px) 11rem, (min-width: 640px) 10rem, 38vw"
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-4" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="line-clamp-2 text-xs leading-snug font-medium text-foreground">
          {part.name}
        </span>
        <span className="tabular mt-auto text-xs font-bold text-price">
          {part.price === null
            ? // Never "$0" and never a dash: a quoted part has a deliberate
              // decision behind it, and either of those would read as a
              // listing that is not finished.
              "On enquiry"
            : formatCurrency(part.price)}
        </span>
      </div>
    </Link>
  )
}

/**
 * Records that this part was viewed. Renders nothing.
 *
 * ── Why a component rather than a hook on the page ────────────────────
 * The part page is a Server Component — it has to be, for the metadata, the
 * structured data and the visibility-pinned query. It cannot hold an effect.
 * This is the smallest possible client island that can: one effect, no
 * markup, no state, and nothing in the accessibility tree.
 *
 * ── Why an effect and not a call during render ────────────────────────
 * Writing to `localStorage` during render is a side effect in a function
 * React may call twice, discard, or replay. In an effect it runs once per
 * committed navigation, which is exactly the definition of "viewed".
 *
 * The dependency list is the part's own fields rather than the object, so a
 * new object identity from a re-render does not re-record a view that already
 * happened — and a genuine navigation to a different part does.
 */
export function RecordRecentlyViewed({
  slug,
  name,
  price,
  imageUrl,
}: {
  slug: string
  name: string
  price: number | null
  imageUrl: string | null
}) {
  React.useEffect(() => {
    recordRecentlyViewed({ slug, name, price, imageUrl })
  }, [slug, name, price, imageUrl])

  return null
}
