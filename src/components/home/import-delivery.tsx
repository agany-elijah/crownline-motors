import Link from "next/link"
import { Anchor, ArrowRight, Check, FileCheck2, PackageSearch, Radar, Ship } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/layout/container"
import { InView } from "@/components/motion/in-view"
import { HomeSectionHeading } from "@/components/home/section-heading"
import { ITEM_STEP_MS, delay } from "@/components/motion/motion"
import { TrackingSearch } from "@/components/tracking/tracking-search"

const SERVICES = [
  {
    icon: PackageSearch,
    title: "International sourcing",
    body: "We find and buy the vehicle in Japan or South Korea.",
  },
  {
    icon: FileCheck2,
    title: "Export and shipping",
    body: "Export paperwork, loading and ocean freight to Mombasa.",
  },
  {
    icon: Anchor,
    title: "Clearing and transport",
    body: "Port clearing in Mombasa and the road journey to South Sudan.",
  },
  {
    icon: Radar,
    title: "Order tracking",
    body: "A tracking number once your order is confirmed, updated at every stage.",
  },
] as const

/**
 * The import service, and the tracking that makes it visible.
 *
 * The panel on the right is the real Track My Order form — it submits to the
 * tracking page — above an illustration of what a timeline looks like. The
 * illustration uses the stage names configured in Settings, and says plainly
 * that it is an example, so it can never be mistaken for somebody's order.
 */
export function ImportDelivery({
  businessName,
  stageLabels,
}: {
  businessName: string
  stageLabels: string[]
}) {
  // An illustrative position part-way along the journey.
  const currentIndex = Math.min(Math.max(stageLabels.length - 5, 1), stageLabels.length - 1)

  return (
    <section aria-labelledby="home-import-heading" className="bg-background py-20 md:py-28">
      <Container size="wide">
        <InView className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="flex flex-col gap-10 lg:col-span-6">
            <HomeSectionHeading
              id="home-import-heading"
              icon={Ship}
              label="Import and delivery"
              lead="We handle the import."
              accent="You follow every step."
              description={`${businessName} manages the whole journey from the seller abroad to your door. Once your order is confirmed you receive a tracking number, and the tracking page updates as your vehicle moves.`}
            />

            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {SERVICES.map((service, index) => {
                const Icon = service.icon
                return (
                  <li key={service.title} className="rv-up flex gap-4" style={delay(600 + index * ITEM_STEP_MS)}>
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-heading text-body-lg font-semibold text-foreground">{service.title}</h3>
                      <p className="text-small text-muted-foreground">{service.body}</p>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="rv-up flex flex-wrap gap-3" style={delay(1000)}>
              <Button render={<Link href="/track-my-order" />} size="lg" className="group/track">
                Track my order
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-fast ease-crownline group-hover/track:translate-x-1"
                />
              </Button>
              <Button render={<Link href="/how-it-works" />} variant="outline" size="lg">
                How it works
              </Button>
            </div>
          </div>

          <div className="rv-up lg:col-span-6" style={delay(400)}>
            <div>
              <div className="relative flex flex-col gap-8 overflow-hidden rounded-2xl border border-white/10 bg-card p-6 shadow-[0_24px_80px_-32px_oklch(0_0_0/0.8)] sm:p-8">
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
                <div className="flex flex-col gap-1">
                  <h3 className="font-heading text-h3 text-foreground">Track My Order</h3>
                  <p className="text-small text-muted-foreground">
                    Enter the tracking or order number from your confirmation.
                  </p>
                </div>

                <TrackingSearch />

                {stageLabels.length > 1 ? (
                  <div className="flex flex-col gap-4 border-t border-white/10 pt-6">
                    <p className="text-small text-muted-foreground">Example of a vehicle timeline</p>
                    <ol className="relative flex flex-col gap-3.5">
                      <span aria-hidden="true" className="absolute top-2 bottom-2 left-[0.6875rem] w-px bg-white/10" />
                      {stageLabels.map((label, index) => {
                        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "next"
                        return (
                          <li key={label} className="rv-up relative flex items-center gap-3.5" style={delay(700 + index * 110)}>
                            <span
                              aria-hidden="true"
                              className={cn(
                                "relative z-10 grid size-6 shrink-0 place-items-center rounded-full border",
                                state === "done" && "border-gold bg-gold text-gold-foreground",
                                state === "current" && "pulse-ring border-gold bg-night",
                                state === "next" && "border-white/15 bg-card"
                              )}
                            >
                              {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : null}
                              {state === "current" ? <span className="size-2 rounded-full bg-gold" /> : null}
                            </span>
                            <span
                              className={cn(
                                "text-small",
                                state === "next" ? "text-muted-foreground" : "font-medium text-foreground",
                                state === "current" && "text-gold"
                              )}
                            >
                              {label}
                              {state === "current" ? <span className="sr-only"> (current stage in this example)</span> : null}
                            </span>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </InView>
      </Container>
    </section>
  )
}
