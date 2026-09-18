"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ImageOff } from "lucide-react"

import { Container } from "@/components/layout/container"
import { Section } from "@/components/layout/section"
import { cn } from "@/lib/utils"
import { formatCurrency, formatNumber } from "@/lib/utils/format-currency"
import {
  RECENTLY_VIEWED_VEHICLES_STRIP_LIMIT,
  recentlyViewedVehicleTitle,
  type RecentlyViewedVehicle,
} from "@/lib/recently-viewed/recently-viewed-vehicle-storage"
import {
  getRecentlyViewedVehiclesSnapshot,
  getServerRecentlyViewedVehiclesLoaded,
  getServerRecentlyViewedVehiclesSnapshot,
  isRecentlyViewedVehiclesLoaded,
  recordRecentlyViewedVehicle,
  subscribeRecentlyViewedVehicles,
} from "@/lib/recently-viewed/recently-viewed-vehicle-store"

/**
 * "Recently viewed cars" — the vehicles this customer has already opened.
 *
 * The mirror of `RecentlyViewedParts`, and it sits in the same place for the
 * same reason: at the bottom of the catalogue and of a listing page, below
 * everything the business wants to say, because this is the customer's own
 * trail rather than a suggestion. Someone who has scrolled a full catalogue
 * without acting is usually trying to get back to the car they saw four cards
 * ago, and this is the shortest route to it.
 *
 * ── Why it renders nothing on a first visit ───────────────────────────
 * A new customer has no history, and a heading over an empty row would end
 * the page on something that does not work. It also renders nothing when the
 * only entry is the vehicle being read — a "recently viewed" row containing
 * exactly the page you are on is a mirror, not a shortcut.
 *
 * ── The data is the customer's, and never leaves their browser ────────
 * Read through `useSyncExternalStore` from `localStorage` (see
 * `recently-viewed-vehicle-store.ts`). Nothing is written to the database and
 * nothing is sent anywhere. That is not only a privacy position — it is what
 * lets this render with no query on a page already doing three.
 */
interface RecentlyViewedVehiclesProps {
  /**
   * The vehicle currently being read, excluded from the strip.
   *
   * Passed rather than inferred from the route, because this component is
   * also rendered on the catalogue — where nothing is excluded.
   */
  excludeSlug?: string
  /** How many to show. */
  limit?: number
}

export function RecentlyViewedVehicles({
  excludeSlug,
  limit = RECENTLY_VIEWED_VEHICLES_STRIP_LIMIT,
}: RecentlyViewedVehiclesProps) {
  const entries = React.useSyncExternalStore(
    subscribeRecentlyViewedVehicles,
    getRecentlyViewedVehiclesSnapshot,
    getServerRecentlyViewedVehiclesSnapshot
  )

  const ready = React.useSyncExternalStore(
    subscribeRecentlyViewedVehicles,
    isRecentlyViewedVehiclesLoaded,
    getServerRecentlyViewedVehiclesLoaded
  )

  const visible = React.useMemo(
    () => entries.filter((entry) => entry.slug !== excludeSlug),
    [entries, excludeSlug]
  )

  // `ready` is false during the server render and hydration. Rendering the
  // strip before storage has been read would flash an empty band in and then
  // populate it, which is worse than one frame of nothing.
  if (!ready || visible.length === 0) return null

  return (
    <Section spacing="compact" className="border-t border-border">
      <Container className="flex flex-col gap-4 px-0">
        <h2 className="text-title">Recently viewed cars</h2>
        <RecentlyViewedVehicleRow vehicles={visible.slice(0, limit)} />
      </Container>
    </Section>
  )
}

/**
 * The row itself.
 *
 * Deliberately not `VehicleCard`: these are small, dense tiles rather than
 * catalogue cards. A history strip is a *shortcut*, and reproducing the full
 * card — specification band, availability tag, Explore cue — would give the
 * page's last band the same visual weight as the catalogue above it, from
 * snapshot data that is a visit old.
 *
 * Native horizontal scrolling with snap points, matching the parts strip: two
 * and a bit tiles visible on a phone so the next one peeks past the edge,
 * which is the affordance that says the row scrolls and the reason its
 * scrollbar can be hidden.
 */
export function RecentlyViewedVehicleRow({ vehicles }: { vehicles: RecentlyViewedVehicle[] }) {
  return (
    <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {vehicles.map((vehicle) => (
        <li key={vehicle.slug} className="w-[62%] shrink-0 snap-start sm:w-56 lg:w-64">
          <RecentlyViewedVehicleTile vehicle={vehicle} />
        </li>
      ))}
    </ul>
  )
}

export function RecentlyViewedVehicleTile({ vehicle }: { vehicle: RecentlyViewedVehicle }) {
  return (
    <Link
      href={`/cars/${vehicle.slug}`}
      className={cn(
        "group/tile flex h-full flex-col overflow-hidden rounded-[4px] border border-border bg-card",
        "transition-[border-color,box-shadow] duration-base ease-crownline",
        "hover:border-gold-ink/30 hover:shadow-[var(--shadow-subtle)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      )}
    >
      {/* 16:9, the ratio every vehicle image on the site is locked to, so a
          row of these stays uniform however the photographs were cropped. */}
      <div className="relative aspect-video shrink-0 overflow-hidden bg-muted">
        {vehicle.imageUrl ? (
          <Image
            src={vehicle.imageUrl}
            // Decorative: the vehicle's name is the next thing in the reading
            // order, so describing the photograph would announce it twice.
            alt=""
            fill
            sizes="(min-width: 1024px) 16rem, (min-width: 640px) 14rem, 62vw"
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-4" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 text-small leading-snug font-medium text-foreground">
          {recentlyViewedVehicleTitle(vehicle)}
        </span>

        {vehicle.mileageKm !== null ? (
          <span className="tabular text-xs text-muted-foreground">
            {formatNumber(vehicle.mileageKm)} km
          </span>
        ) : null}

        <span className="tabular mt-auto pt-1 text-small font-bold text-price">
          {vehicle.price === null
            ? // Never "$0" and never a dash: a listing without a published
              // price has a deliberate decision behind it, and either of
              // those would read as a listing that is not finished.
              "Price on request"
            : formatCurrency(vehicle.price)}
        </span>
      </div>
    </Link>
  )
}

/**
 * Records that this vehicle was viewed. Renders nothing.
 *
 * ── Why a component rather than a hook on the page ────────────────────
 * The vehicle page is a Server Component — it has to be, for the metadata,
 * the structured data and the visibility-pinned query. It cannot hold an
 * effect. This is the smallest possible client island that can: one effect,
 * no markup, no state, and nothing in the accessibility tree.
 *
 * ── Why an effect and not a call during render ────────────────────────
 * Writing to `localStorage` during render is a side effect in a function
 * React may call twice, discard, or replay. In an effect it runs once per
 * committed navigation, which is exactly the definition of "viewed".
 *
 * The dependency list is the vehicle's own fields rather than the object, so
 * a new object identity from a re-render does not re-record a view that
 * already happened — and a genuine navigation to a different car does.
 */
export function RecordRecentlyViewedVehicle({
  slug,
  make,
  model,
  year,
  price,
  mileageKm,
  imageUrl,
}: {
  slug: string
  make: string
  model: string
  year: number | null
  price: number | null
  mileageKm: number | null
  imageUrl: string | null
}) {
  React.useEffect(() => {
    recordRecentlyViewedVehicle({ slug, make, model, year, price, mileageKm, imageUrl })
  }, [slug, make, model, year, price, mileageKm, imageUrl])

  return null
}
