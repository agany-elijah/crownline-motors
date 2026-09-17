import Image from "next/image"
import {
  BadgeCheck,
  ClipboardCheck,
  Globe2,
  Headset,
  ReceiptText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Container } from "@/components/layout/container"
import { InView } from "@/components/motion/in-view"
import { ShowroomHeading } from "@/components/layout/showroom-heading"
import { ITEM_STEP_MS, delay } from "@/components/motion/motion"
import { HOME_MEDIA } from "@/components/home/home-media"

interface Benefit {
  icon: LucideIcon
  title: string
  body: string
}

/**
 * Service descriptions, not credentials. Every line describes something the
 * platform actually does — the inspection step, the itemised quotation, the
 * staged payments and the tracking number are all real workflows — and none
 * claims a figure, certification or guarantee the business has not given.
 */
const BENEFITS: Benefit[] = [
  {
    icon: ShieldCheck,
    title: "Quality vehicles, chosen with care",
    body: "We list vehicles for their condition, history and value — not simply because they are cheap to buy.",
  },
  {
    icon: ClipboardCheck,
    title: "Inspected and verified",
    body: "Vehicle information, condition and documentation are checked before a car is shipped.",
  },
  {
    icon: ReceiptText,
    title: "Transparent information and pricing",
    body: "Full specifications and photographs on every listing, and an itemised quotation before you pay anything.",
  },
  {
    icon: Headset,
    title: "Support from quote to handover",
    body: "One team through purchase, shipping, clearing and delivery — with a tracking number once your order is confirmed.",
  },
]

/**
 * Why buy through Crownline — an asymmetric grid rather than a row of
 * identical cards: international sourcing is the premise of the business,
 * so it takes the photograph and the largest tile, and the four benefits
 * that follow from it sit beside it.
 */
export function WhyCrownline({ businessName }: { businessName: string }) {
  return (
    <section
      aria-labelledby="home-why-heading"
      className="relative isolate overflow-hidden bg-night py-20 md:py-28"
    >
      <div aria-hidden="true" className="bg-dot-grid absolute inset-0 -z-10" />

      <Container size="wide">
        <InView className="flex flex-col gap-14">
          <ShowroomHeading
            id="home-why-heading"
            icon={BadgeCheck}
            label={`Why ${businessName}`}
            lead="Why buy through"
            accent={businessName}
            description="Buying a car from abroad asks for trust. Here is what we do to earn it."
            align="center"
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
            {/* The lead tile: international sourcing. */}
            <article
              className="rv-up group/tile relative isolate flex min-h-96 flex-col justify-end overflow-hidden rounded-2xl border border-white/10 p-7 md:col-span-2 lg:row-span-2 lg:p-9"
              style={delay(250)}
            >
              <div aria-hidden="true" className="media-frame absolute inset-0 -z-10 bg-night">
                <Image
                  src={HOME_MEDIA.shipping.src}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 640px, 100vw"
                  className="object-cover object-[center_75%] opacity-70 group-hover/tile:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-night via-night/75 to-night/5" />
              </div>

              <span
                className="rv-icon mb-6 grid size-14 place-items-center rounded-xl bg-gradient-to-br from-gold-bright to-gold text-gold-foreground shadow-[var(--shadow-gold)]"
                style={delay(450)}
              >
                <Globe2 aria-hidden="true" className="size-6" />
              </span>
              <h3 className="max-w-md text-h2 text-white">Sourced from Japan and South Korea</h3>
              <p className="mt-3 max-w-md text-body-lg text-white/75">
                We buy from auction houses and dealers in Japan and South Korea on your behalf,
                then handle the shipping all the way to South Sudan.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Sourcing countries">
                {["Japan", "South Korea"].map((country) => (
                  <li
                    key={country}
                    className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-small font-medium text-white backdrop-blur-sm"
                  >
                    {country}
                  </li>
                ))}
              </ul>
            </article>

            {BENEFITS.map((benefit, index) => (
              <BenefitTile key={benefit.title} benefit={benefit} delayMs={400 + index * ITEM_STEP_MS} />
            ))}
          </div>
        </InView>
      </Container>
    </section>
  )
}

function BenefitTile({ benefit, delayMs }: { benefit: Benefit; delayMs: number }) {
  const Icon = benefit.icon

  return (
    <div className="rv-up" style={delay(delayMs)}>
      <article
        className={cn(
          "group/tile flex h-full flex-col gap-5 rounded-2xl border border-white/8 bg-card/70 p-7 backdrop-blur-sm",
          "transition-[border-color,background-color,translate] duration-slow ease-crownline-soft",
          "hover:-translate-y-1 hover:border-gold/35 hover:bg-card"
        )}
      >
        {/* Two layers: the outer one arrives on scroll, the inner one answers
            the pointer — one element cannot carry both transitions. */}
        <span className="rv-icon w-fit" style={delay(delayMs + 180)}>
          <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-gold-bright to-gold text-gold-foreground shadow-[var(--shadow-gold)] transition-[scale,rotate] duration-slow ease-crownline-soft group-hover/tile:scale-110 group-hover/tile:-rotate-6">
            <Icon aria-hidden="true" className="size-5" />
          </span>
        </span>
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-title text-foreground">{benefit.title}</h3>
          <p className="text-body text-muted-foreground">{benefit.body}</p>
        </div>
      </article>
    </div>
  )
}
