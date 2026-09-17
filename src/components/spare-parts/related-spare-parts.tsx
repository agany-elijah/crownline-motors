import { CardCarousel } from "@/components/shared/card-carousel"
import { Reveal } from "@/components/shared/reveal"
import { Section, SectionHeading } from "@/components/layout/section"
import { SparePartCard } from "@/components/spare-parts/spare-part-card"
import type { PublicSparePartCard } from "@/lib/queries/public-spare-part.queries"

/**
 * "You may also like" — other live parts in the same category.
 *
 * ── A strip, not a grid ───────────────────────────────────────────────
 * The cards scroll horizontally on every screen, phone and desktop alike, so
 * a customer moves through them with the one gesture they already make. See
 * `CardCarousel` for why that is native scrolling rather than a carousel
 * library, and why the cards are rendered here, on the server, and handed to
 * the client island rather than built inside it.
 *
 * ── Renders nothing rather than something apologetic ──────────────────
 * With one part in a category there is no honest strip to draw, and a heading
 * over an empty state ("no similar parts") would close the page on the fact
 * that the catalogue is small. The caller decides by looking at the array;
 * this component refuses to render an empty one, so neither side can forget.
 *
 * The visibility guarantee lives in `listRelatedSpareParts`, not here — this
 * component renders whatever it is handed, which is exactly why the query it
 * is handed by must be the one that pins the status.
 */
interface RelatedSparePartsProps {
  parts: PublicSparePartCard[]
  /** The category these share, named in the eyebrow so the strip explains
   *  itself rather than presenting an unexplained row of products. */
  /** Null when the category is hidden; the strip then does not name it. */
  categoryName: string | null
  /** Units in hand by slug — present only while stock quantities are published. */
  stock?: Record<string, number>
}

/**
 * How wide one card sits in the strip.
 *
 * Below `sm` two and a bit cards are visible, so the next one always peeks
 * past the right edge — the affordance that says the strip scrolls, and the
 * reason its scrollbar can be hidden. Above that the widths are fixed so a
 * card here is close to the size it is in the catalogue grid: a card should
 * not change size between two screens of the same site. They moved up with
 * the grid's own columns, which now hold three ~19rem cards at `lg`.
 */
const CARD_WIDTH = "w-[46%] shrink-0 snap-start sm:w-[15rem] lg:w-[17rem]"

/** Sized for the widths above rather than for the catalogue grid, so a phone
 *  does not fetch a source built for a desktop column. */
const CARD_IMAGE_SIZES = "(min-width: 1024px) 17rem, (min-width: 640px) 15rem, 46vw"

export function RelatedSpareParts({ parts, categoryName, stock }: RelatedSparePartsProps) {
  if (parts.length === 0) return null

  return (
    <Section
      spacing="default"
      /**
       * `muted` — the part page above this one now ends on the background
       * surface (its description moved into the decision column, taking the
       * muted band with it), so this strip is what separates the listing from
       * the suggestions. Without the change of surface the two run together as
       * one very long white page.
       */
      variant="muted"
    >
      {/* The container's own measure, matching the catalogue grid, so the
          strip does not run to a different width than the page the customer
          was looking at a moment ago. */}
      <div className="w-full">
        <Reveal>
          <CardCarousel
            label={categoryName ? `More parts in ${categoryName}` : "Related parts"}
            heading={
              <SectionHeading
                eyebrow={categoryName ? `More in ${categoryName}` : "Related parts"}
                title="You may also like"
                description={
                  categoryName
                    ? "Other parts in the same category, sourced and imported on the same terms."
                    : "Similar parts, sourced and imported on the same terms."
                }
              />
            }
          >
            {parts.map((part) => (
              <li key={part.slug} className={CARD_WIDTH}>
                {/*
                  No `priority` on any card: the strip sits at the bottom of a
                  long page, so every photograph here is genuinely below the
                  fold and eager-loading them would compete with the gallery
                  the customer is actually looking at.
                */}
                <SparePartCard part={part} sizes={CARD_IMAGE_SIZES} stockQuantity={stock?.[part.slug]} />
              </li>
            ))}
          </CardCarousel>
        </Reveal>
      </div>
    </Section>
  )
}
