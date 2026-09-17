import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Building2, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Container } from "@/components/layout/container"
import { InView } from "@/components/motion/in-view"
import { HomeSectionHeading } from "@/components/home/section-heading"
import { ITEM_STEP_MS, delay } from "@/components/motion/motion"
import { HOME_MEDIA } from "@/components/home/home-media"
import { catalogueHref } from "@/lib/validations/vehicle-search.schema"

/** The route every vehicle takes, shown over the photograph. */
const ROUTE = ["Japan & South Korea", "Mombasa", "South Sudan"] as const

/**
 * Who Crownline Motors is, in a few facts a buyer can check.
 *
 * The description and contact facts come from Settings → Business
 * information, and the makes from the published inventory, so nothing here
 * goes stale when the business changes.
 */
export function CompanyIntro({
  businessName,
  description,
  address,
  hours,
  makes,
}: {
  businessName: string
  description: string
  address: string
  hours: string[] | null
  makes: string[]
}) {
  const facts = [
    { term: "Vehicles sourced from", detail: "Japan and South Korea" },
    { term: "Shipped through", detail: "The port of Mombasa, Kenya" },
    { term: "Delivered to", detail: "Customers across South Sudan" },
    address ? { term: "Find us", detail: address } : null,
    hours && hours.length > 0
      ? {
          term: "Opening hours",
          detail: (
            <span className="flex flex-col">
              {hours.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          ),
        }
      : null,
  ].filter((fact) => fact !== null)

  return (
    <section aria-labelledby="home-company-heading" className="bg-background py-20 md:py-28">
      <Container size="wide">
        <InView className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="relative">
            <div className="rv-unveil relative aspect-[4/5] overflow-hidden rounded-2xl sm:aspect-[5/4] lg:aspect-[4/5]" style={delay(150)}>
              <Image
                src={HOME_MEDIA.inspection.src}
                alt={HOME_MEDIA.inspection.alt}
                fill
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover object-[75%_center]"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-night/85 via-transparent to-transparent" />
            </div>

            {/* The route, as a caption over the photograph. */}
            <div
              className="rv-up absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/15 bg-night/70 px-4 py-3 text-small font-medium text-white backdrop-blur-md sm:inset-x-6 sm:bottom-6"
              style={delay(900)}
            >
              <span className="sr-only">Every vehicle travels from </span>
              {ROUTE.map((stop, index) => (
                <span key={stop} className="inline-flex items-center gap-2">
                  {index > 0 ? <ChevronRight aria-hidden="true" className="size-4 text-gold" /> : null}
                  {stop}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <HomeSectionHeading
              id="home-company-heading"
              icon={Building2}
              label={`About ${businessName}`}
              lead="A dealership and import partner"
              accent="for South Sudan."
              description={description}
            />

            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {facts.map((fact, index) => (
                <div key={fact.term} className="rv-up flex flex-col gap-1 border-l-2 border-gold/40 pl-4" style={delay(700 + index * ITEM_STEP_MS)}>
                  <dt className="text-small text-muted-foreground">{fact.term}</dt>
                  <dd className="text-body font-medium text-foreground">{fact.detail}</dd>
                </div>
              ))}
            </dl>

            {makes.length > 0 ? (
              <div className="flex flex-col gap-4">
                <p className="rv-up text-small text-muted-foreground" style={delay(1000)}>
                  Makes in our current inventory
                </p>
                <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  {makes.map((make, index) => (
                    <li key={make} className="rv-up" style={delay(1080 + index * 70)}>
                      <Link
                        href={catalogueHref({ make })}
                        className="font-heading text-h3 font-bold tracking-tight text-foreground/35 transition-colors duration-fast ease-crownline hover:text-gold"
                      >
                        {make}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rv-up" style={delay(1200)}>
              <Button render={<Link href="/about-us" />} variant="outline" size="lg" className="group/about">
                About us
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-fast ease-crownline group-hover/about:translate-x-1"
                />
              </Button>
            </div>
          </div>
        </InView>
      </Container>
    </section>
  )
}
