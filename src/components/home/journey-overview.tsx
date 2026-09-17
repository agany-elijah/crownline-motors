import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  FileText,
  KeyRound,
  MapPin,
  Route,
  Ship,
  Truck,
  type LucideIcon,
} from "lucide-react"

import { Container } from "@/components/layout/container"
import { InView } from "@/components/motion/in-view"
import { ShowroomHeading } from "@/components/layout/showroom-heading"
import { delay } from "@/components/motion/motion"

interface JourneyStep {
  icon: LucideIcon
  title: string
  body: string
  /** Where this step happens, when that helps a customer picture it. */
  place?: string
}

/**
 * The customer's journey in six steps — the full eight-step explanation lives
 * on How It Works. Numbered because the content genuinely is a sequence, and
 * the order is the point.
 */
const STEPS: JourneyStep[] = [
  {
    icon: FileText,
    title: "Choose and request a quote",
    body: "Pick a listed vehicle or tell us what you want. We send a full quotation.",
  },
  {
    icon: BadgeCheck,
    title: "Confirm your order",
    body: "Accept the quotation and make the initial payment to secure the vehicle.",
  },
  {
    icon: ClipboardCheck,
    title: "Procurement and inspection",
    body: "We buy the vehicle, check its condition and documents, and prepare it for export.",
    place: "Japan or South Korea",
  },
  {
    icon: Ship,
    title: "Shipping to Mombasa",
    body: "Your vehicle is shipped by sea to the port of Mombasa.",
    place: "Mombasa, Kenya",
  },
  {
    icon: Truck,
    title: "Clearing and transport",
    body: "Port clearing is completed and the vehicle travels overland to South Sudan.",
  },
  {
    icon: KeyRound,
    title: "Delivery or collection",
    body: "With the balance settled, your vehicle is handed over, ready to drive.",
    place: "South Sudan",
  },
]

/** How long the connecting line takes to reach the last step. */
const STEP_MS = 260

export function JourneyOverview() {
  return (
    <section aria-labelledby="home-journey-heading" className="bg-background py-20 md:py-28">
      <Container size="wide">
        <InView className="flex flex-col gap-14 lg:gap-20">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <ShowroomHeading
              id="home-journey-heading"
              icon={Route}
              label="How it works"
              lead="From the auction floor"
              accent="to South Sudan."
              description="You choose the car. We handle the buying, shipping, clearing and delivery — and you can follow each stage."
            />
            <Link
              href="/how-it-works"
              className="rv-up group/how inline-flex w-fit shrink-0 items-center gap-2 py-2 text-small font-semibold text-gold transition-colors duration-fast hover:text-gold-bright"
              style={delay(500)}
            >
              See the full process
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-fast ease-crownline group-hover/how:translate-x-1"
              />
            </Link>
          </div>

          <div className="relative">
            {/* The route. A faint track with a gold line drawn along it —
                across the top on a wide screen, down the left on a phone.
                On the wide layout it runs between the centres of the first
                and last of six columns, which sit a twelfth of the width in
                from each edge. */}
            <div aria-hidden="true" className="pointer-events-none absolute top-7 bottom-7 left-7 w-px bg-white/10 lg:inset-x-[8.33%] lg:bottom-auto lg:h-px lg:w-auto">
              <span className="rv-draw-y absolute inset-0 bg-gradient-to-b from-gold via-gold to-gold/40 lg:hidden" style={delay(300)} />
              <span className="rv-draw-x absolute inset-0 hidden bg-gradient-to-r from-gold via-gold to-gold/40 lg:block" style={delay(300)} />
            </div>

          <ol className="relative grid grid-cols-1 gap-10 lg:grid-cols-6 lg:gap-6">

            {STEPS.map((step, index) => {
              const Icon = step.icon
              const at = 300 + index * STEP_MS

              return (
                <li key={step.title} className="relative flex gap-6 lg:flex-col lg:items-center lg:gap-5 lg:text-center">
                  <span className="rv-pop relative z-10 shrink-0" style={delay(at)}>
                    <span className="group/node grid size-14 place-items-center rounded-full border border-gold/40 bg-night text-gold shadow-[0_0_0_6px_var(--background)] transition-colors duration-fast hover:bg-gold hover:text-gold-foreground">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                  </span>

                  <div className="rv-up flex flex-col gap-2 pt-1 lg:pt-0" style={delay(at + 120)}>
                    <span className="tabular text-small font-semibold text-gold">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-heading text-title text-foreground">{step.title}</h3>
                    <p className="text-body text-muted-foreground">{step.body}</p>
                    {step.place ? (
                      <p className="inline-flex items-center gap-1.5 text-small text-foreground/70 lg:justify-center">
                        <MapPin aria-hidden="true" className="size-3.5 text-gold" />
                        {step.place}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
          </div>
        </InView>
      </Container>
    </section>
  )
}
