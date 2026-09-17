import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

import { Container } from "@/components/layout/container"
import { InView } from "@/components/motion/in-view"
import { ShowroomHeading } from "@/components/layout/showroom-heading"
import { ITEM_STEP_MS, delay } from "@/components/motion/motion"
import { VehicleCard } from "@/components/vehicles/vehicle-card"
import type { PublicVehicleCard } from "@/lib/queries/public-vehicle.queries"

/** Up to four across in the wide container — the catalogue grid's own measure. */
const CARD_SIZES = "(min-width: 1280px) 400px, (min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw"

/**
 * The vehicles an operator has marked "Feature on the homepage" in the
 * dashboard — and only those. Renders nothing when none are featured, so the
 * homepage never fills this space with listings nobody chose.
 *
 * The "View inventory" link sits above the grid rather than below it, where a
 * visitor who already knows they want the full catalogue finds it before
 * scrolling through a curated selection they did not ask for.
 */
export function FeaturedVehicles({
  vehicles,
  totalVehicles,
}: {
  vehicles: PublicVehicleCard[]
  totalVehicles: number
}) {
  if (vehicles.length === 0) return null

  return (
    <section aria-labelledby="home-featured-heading" className="bg-background py-20 md:py-28">
      <Container size="wide">
        <InView className="flex flex-col gap-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <ShowroomHeading
              id="home-featured-heading"
              icon={Sparkles}
              label="Featured vehicles"
              lead="Hand-picked vehicles,"
              accent="ready to import."
              description="Real photographs, full specifications and a clear price on every listing. Open any vehicle for the complete details."
            />

            {totalVehicles > 0 ? (
              <Link
                href="/cars"
                className="rv-up group/inv inline-flex w-fit shrink-0 items-center gap-2.5 rounded-full py-2 text-small font-semibold text-gold transition-colors duration-fast hover:text-gold-bright"
                style={delay(500)}
              >
                View inventory
                <span className="tabular rounded-full bg-gold/12 px-2 py-0.5 text-xs text-gold">
                  {totalVehicles}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-fast ease-crownline group-hover/inv:translate-x-1"
                />
              </Link>
            ) : null}
          </div>

          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {vehicles.map((vehicle, index) => (
              <li key={vehicle.slug} className="rv-up flex" style={delay(300 + index * ITEM_STEP_MS)}>
                <VehicleCard vehicle={vehicle} sizes={CARD_SIZES} />
              </li>
            ))}
          </ul>
        </InView>
      </Container>
    </section>
  )
}
