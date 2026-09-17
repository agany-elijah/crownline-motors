import Link from "next/link"
import { ArrowRight, ArrowUpRight, Wrench } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Container } from "@/components/layout/container"
import { InView } from "@/components/motion/in-view"
import { HomeSectionHeading } from "@/components/home/section-heading"
import { ITEM_STEP_MS, delay } from "@/components/motion/motion"
import { SparePartCard } from "@/components/spare-parts/spare-part-card"
import type {
  PublicSparePartCard,
  PublicSparePartCategory,
} from "@/lib/queries/public-spare-part.queries"
import { partCatalogueHref } from "@/lib/validations/spare-part-search.schema"

/** Two columns inside the band's wider half. */
const PART_CARD_SIZES = "(min-width: 1024px) 360px, 50vw"

/** How many categories stand in for featured parts. */
const CATEGORY_LIMIT = 6

/**
 * Spare parts, introduced without competing with the vehicles above.
 *
 * The product row shows only parts an operator has ticked "Feature on the
 * homepage" for. With none ticked, the band shows the catalogue's stocked
 * categories instead — also from the database — rather than promoting parts
 * nobody chose. With neither, it is an introduction and a link.
 */
export function SparePartsTeaser({
  parts,
  categories,
}: {
  parts: PublicSparePartCard[]
  categories: PublicSparePartCategory[]
}) {
  const stocked = categories.filter((category) => category.partCount > 0).slice(0, CATEGORY_LIMIT)
  const hasShowcase = parts.length > 0 || stocked.length > 0

  return (
    <section aria-labelledby="home-parts-heading" className="border-y border-white/8 bg-night py-20 md:py-24">
      <Container size="wide">
        <InView className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className={hasShowcase ? "flex flex-col gap-8 lg:col-span-5" : "flex flex-col gap-8 lg:col-span-8"}>
            <HomeSectionHeading
              id="home-parts-heading"
              icon={Wrench}
              label="Spare parts"
              lead="Parts for the car"
              accent="you already drive."
              description="Genuine and quality replacement parts from Japan and South Korea. Check fitment against your make, model and year, then order or ask us for a quote."
            />

            <div className="rv-up" style={delay(650)}>
              <Button render={<Link href="/spare-parts" />} variant="outline" size="lg" className="group/parts">
                Browse spare parts
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-fast ease-crownline group-hover/parts:translate-x-1"
                />
              </Button>
            </div>
          </div>

          {parts.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-7">
              {parts.map((part, index) => (
                <li key={part.slug} className="rv-up flex" style={delay(400 + index * ITEM_STEP_MS)}>
                  <SparePartCard part={part} sizes={PART_CARD_SIZES} />
                </li>
              ))}
            </ul>
          ) : stocked.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:col-span-7" aria-label="Spare-part categories">
              {stocked.map((category, index) => (
                <li key={category.slug} className="rv-up" style={delay(400 + index * ITEM_STEP_MS)}>
                  <Link
                    href={partCatalogueHref({ category: category.slug })}
                    className="group/pc flex h-full min-h-32 flex-col justify-between gap-6 rounded-2xl border border-white/10 bg-card p-5 transition-[border-color,background-color,translate] duration-slow ease-crownline-soft hover:-translate-y-1 hover:border-gold/45"
                  >
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-5 self-end text-muted-foreground transition-[color,rotate] duration-slow ease-crownline-soft group-hover/pc:rotate-45 group-hover/pc:text-gold"
                    />
                    <span className="flex flex-col gap-1">
                      <span className="font-heading text-title text-foreground">{category.name}</span>
                      <span className="text-small text-muted-foreground">
                        <span className="tabular">{category.partCount}</span>{" "}
                        {category.partCount === 1 ? "part" : "parts"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </InView>
      </Container>
    </section>
  )
}
