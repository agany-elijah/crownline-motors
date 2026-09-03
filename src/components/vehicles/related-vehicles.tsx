import { Reveal } from "@/components/shared/reveal"
import { Section, SectionHeading } from "@/components/layout/section"
import { VehicleCard } from "@/components/vehicles/vehicle-card"
import { VehicleCarousel } from "@/components/vehicles/vehicle-carousel"
import type { PublicVehicleCard } from "@/lib/queries/public-vehicle.queries"

/**
 * "You may also like" — other live listings from the same make.
 *
 * ── Why this closes the vehicle page ──────────────────────────────────
 * It replaced a dark call-to-action block that restated the two actions
 * already sitting above it, beside the price, and again in the pinned
 * mobile bar. A third copy of "Request this vehicle" does not make anyone
 * more likely to press it; it just makes the page end on an advert for
 * itself.
 *
 * Someone who has read a whole vehicle page and not pressed either action
 * has usually made a decision about *that* vehicle, not about the
 * business. The useful thing to offer them next is another car — which is
 * also what keeps them inside the catalogue rather than back on a search
 * engine.
 *
 * ── A strip, not a grid ───────────────────────────────────────────────
 * The cards scroll horizontally on every screen, phone and desktop alike.
 * See VehicleCarousel for why that is native scrolling rather than a
 * carousel library, and why these cards and this heading are rendered
 * here, on the server, and handed to the client island rather than built
 * inside it.
 *
 * ── Renders nothing rather than something apologetic ──────────────────
 * With one Toyota in stock there is no honest strip to draw, and a section
 * heading over an empty state ("no similar vehicles") would close the page
 * on the fact that the inventory is small. The caller decides by looking
 * at the array; this component simply refuses to render an empty one, so
 * neither side can forget.
 *
 * The visibility guarantee lives in `listRelatedVehicles`, not here — this
 * component renders whatever it is handed, which is exactly why the query
 * it is handed by must be the one that pins the status.
 */
interface RelatedVehiclesProps {
  vehicles: PublicVehicleCard[]
  /** The make these share, named in the eyebrow so the strip explains itself. */
  make: string
}

/**
 * How wide one card sits in the strip.
 *
 * Below `sm` a card takes 88% of the strip so the next one always peeks
 * past the right edge — the affordance that says the strip scrolls, and
 * the reason its scrollbar can be hidden. Above that the widths are fixed
 * so a card here is close to the size it is in the catalogue.
 *
 * All three are chosen to land the card's specification band in a range
 * where nothing truncates and, on a phone, where it keeps the same
 * side-by-side arrangement the catalogue gives it — a card should not
 * rearrange itself between two screens of the same site. The percentage
 * resolves against the scroller's content box, so 88% of a 390px phone is
 * a 315px card, not 343px. See the container-query note in VehicleCard.
 */
const CARD_WIDTH = "w-[88%] shrink-0 snap-start sm:w-[21rem] lg:w-[23rem]"

/**
 * Sized for the widths above rather than for a three-column grid, so a
 * phone does not fetch a source built for a desktop column.
 */
const CARD_IMAGE_SIZES = "(min-width: 1024px) 23rem, (min-width: 640px) 21rem, 88vw"

export function RelatedVehicles({ vehicles, make }: RelatedVehiclesProps) {
  if (vehicles.length === 0) return null

  return (
    <Section
      spacing="default"
      /**
       * `default`, not `muted` — the section immediately above this one is
       * already muted, and two adjacent secondary surfaces read as one
       * long band with a seam in it rather than as two sections.
       */
      variant="default"
    >
      {/*
        The same 72rem cap the catalogue uses, so a card here is close to
        the size a card is on /cars. Without it the section container's
        80rem would let the strip run wider than the grid the customer was
        looking at a moment ago.
      */}
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <VehicleCarousel
            label={`More ${make} vehicles`}
            heading={
              <SectionHeading
                eyebrow={`More ${make}`}
                title="You may also like"
                description="Other vehicles in stock from the same make, sourced and imported on the same terms."
              />
            }
          >
            {vehicles.map((vehicle) => (
              <li key={vehicle.slug} className={CARD_WIDTH}>
                {/*
                  No `priority` on any card: the strip sits at the bottom
                  of a long page, so every photograph here is genuinely
                  below the fold and eager-loading them would compete with
                  the gallery the customer is actually looking at.
                */}
                <VehicleCard vehicle={vehicle} sizes={CARD_IMAGE_SIZES} />
              </li>
            ))}
          </VehicleCarousel>
        </Reveal>
      </div>
    </Section>
  )
}
