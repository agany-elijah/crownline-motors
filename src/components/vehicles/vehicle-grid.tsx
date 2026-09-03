import Link from "next/link"
import { CarFront, SearchX } from "lucide-react"

import { Reveal } from "@/components/shared/reveal"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { VehicleCard } from "@/components/vehicles/vehicle-card"
import type { PublicVehicleCard } from "@/lib/queries/public-vehicle.queries"

/**
 * The catalogue grid.
 *
 * ── Why the stagger stops after the first row ─────────────────────────
 * Each card is revealed with a delay derived from its position, but the
 * offset is taken modulo the row width and capped. A delay that keeps
 * growing down a twelve-card page means the last card waits most of a
 * second after entering view, which does not read as elegance — it reads as
 * a slow site, which is the specific failure the brief warns against on
 * mobile connections. Staggering across a row is enough to make the
 * movement feel authored; staggering down a page just makes it late.
 *
 * The reveal itself degrades correctly on its own: the hidden starting
 * state in globals.css is scoped to `(scripting: enabled)` and
 * `prefers-reduced-motion: no-preference`, so a visitor without JavaScript
 * or with reduced motion requested simply sees the cards.
 */
interface VehicleGridProps {
  vehicles: PublicVehicleCard[]
  /**
   * How many cards sit above the fold and should load their photograph
   * eagerly. Three matches the widest grid — one full row on a desktop.
   */
  priorityCount?: number
  /**
   * True when the empty result is the answer to a search rather than the
   * state of the inventory. The two need different words and a different
   * way out — see the empty state below.
   */
  filtered?: boolean
}

/** Cards per row at the widest breakpoint. Also the stagger's wrap point. */
const COLUMNS = 3

export function VehicleGrid({
  vehicles,
  priorityCount = COLUMNS,
  filtered = false,
}: VehicleGridProps) {
  if (vehicles.length === 0) {
    /**
     * Two different empty states, because they are two different situations
     * and a customer can act on only one of them.
     *
     * An empty *inventory* is the dealership's state: nothing the visitor
     * did caused it, and the useful next step is to have us source the car.
     * An empty *search* is the visitor's own doing, and the useful next step
     * is to widen it — telling them "new arrivals are added as they are
     * sourced" when the floor is full of cars they filtered out would be
     * both wrong and quietly insulting.
     */
    return filtered ? (
      <EmptyState
        icon={<SearchX />}
        title="No vehicles match those filters"
        description="Nothing in the current inventory matches that combination. Try clearing a filter, or tell us exactly what you are after and we will source it from Japan or Korea."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button render={<Link href="/cars" />} variant="outline">
              Clear filters
            </Button>
            <Button render={<Link href="/get-a-quote" />}>Request a vehicle</Button>
          </div>
        }
      />
    ) : (
      <EmptyState
        icon={<CarFront />}
        title="No vehicles listed yet"
        description="New arrivals from Japan and Korea are added as they are sourced. Tell us what you are looking for and we will find it for you."
        action={
          <Button render={<Link href="/get-a-quote" />} variant="outline">
            Request a vehicle
          </Button>
        }
      />
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((vehicle, index) => (
        <li key={vehicle.slug} className="flex">
          <Reveal delay={(index % COLUMNS) * 70} className="flex w-full">
            <VehicleCard vehicle={vehicle} priority={index < priorityCount} />
          </Reveal>
        </li>
      ))}
    </ul>
  )
}
