import Link from "next/link"
import { ArrowRight, CarFront, Sparkles } from "lucide-react"

import { Container } from "@/components/layout/container"
import { InView } from "@/components/motion/in-view"
import { HomeSectionHeading } from "@/components/home/section-heading"
import { ITEM_STEP_MS, delay } from "@/components/motion/motion"
import { Button } from "@/components/ui/button"
import { VehicleCard } from "@/components/vehicles/vehicle-card"
import type { PublicVehicleCard } from "@/lib/queries/public-vehicle.queries"

/** Up to four across in the wide container — the catalogue grid's own measure. */
const CARD_SIZES = "(min-width: 1280px) 400px, (min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw"

/**
 * The vehicles on sale now, featured listings first.
 *
 * The "View inventory" link sits above the grid rather than below it, where a
 * visitor who already knows they want the full catalogue finds it before
 * scrolling through a curated selection they did not ask for.
 */
export function FeaturedVehicles({
  vehicles,
  totalVehicles,
  showQuote,
}: {
  vehicles: PublicVehicleCard[]
  totalVehicles: number
  showQuote: boolean
}) {
  return (
    <section aria-labelledby="home-featured-heading" className="bg-background py-20 md:py-28">
      <Container size="wide">
        <InView className="flex flex-col gap-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <HomeSectionHeading
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

          {vehicles.length > 0 ? (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {vehicles.map((vehicle, index) => (
                <li key={vehicle.slug} className="rv-up flex" style={delay(300 + index * ITEM_STEP_MS)}>
                  <VehicleCard vehicle={vehicle} sizes={CARD_SIZES} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rv-up flex flex-col items-center gap-5 rounded-2xl border border-dashed border-white/12 bg-card/40 px-6 py-16 text-center" style={delay(300)}>
              <span className="grid size-14 place-items-center rounded-full bg-gold/10 text-gold">
                <CarFront aria-hidden="true" className="size-6" />
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-h3 text-foreground">New vehicles are on their way</h3>
                <p className="mx-auto max-w-md text-body text-muted-foreground">
                  Listings are added as vehicles are sourced. Tell us what you are looking for and
                  we will find it for you.
                </p>
              </div>
              {showQuote ? (
                <Button render={<Link href="/get-a-quote" />} size="lg">
                  Request a vehicle
                </Button>
              ) : null}
            </div>
          )}
        </InView>
      </Container>
    </section>
  )
}
