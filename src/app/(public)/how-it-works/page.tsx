import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Check, MessageSquareText, Radar, Route, Wallet, Wrench } from "lucide-react"

import { ShipmentType } from "@/generated/prisma/enums"
import { ShowroomHeading } from "@/components/layout/showroom-heading"
import { ImportTimeline } from "@/components/how-it-works/import-timeline"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Container } from "@/components/layout/container"
import { AnimatedWords, wordsDuration } from "@/components/motion/animated-words"
import { CountUp } from "@/components/motion/count-up"
import { InView } from "@/components/motion/in-view"
import { ITEM_STEP_MS, delay } from "@/components/motion/motion"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { Button } from "@/components/ui/button"
import { getPublicSiteSettings, getSparePartDeliverySteps } from "@/lib/queries/settings.queries"
import { customerTimelineStages } from "@/lib/settings/tracking-stages"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

export async function generateMetadata(): Promise<Metadata> {
  const { businessName } = await getPublicSiteSettings()

  return {
    title: "How It Works",
    description: `How ${businessName} imports your vehicle from Japan or South Korea to South Sudan: choosing, reserving, inspection, shipping to Mombasa, clearing, transport and delivery — with staged payments and tracking at every step.`,
    alternates: { canonical: "/how-it-works" },
  }
}

const HERO_LEAD = "From the auction floor"
const HERO_ACCENT = "to your driveway."
const HERO_TEXT_AT = 160 + wordsDuration(HERO_LEAD) + wordsDuration(HERO_ACCENT) + 80

/** Trims a percentage for display: 50 → 50, 33.33 → 33.33. */
function wholeOrExact(value: number): { whole: boolean; text: string } {
  const rounded = Number(value.toFixed(2))
  return { whole: Number.isInteger(rounded), text: String(rounded) }
}

/**
 * How It Works (brief §7).
 *
 * The vehicle import in eight steps, then the three things a buyer asks next:
 * how the payments are split, how the journey is tracked, and how spare parts
 * differ. Everything that the dealership configures — the payment split, the
 * tracking stage names, the spare-parts steps, the contact actions — is read
 * from Settings, so this page cannot drift from the orders it describes.
 *
 * Dark throughout, like the homepage, so moving between the two pages feels
 * like one showroom.
 */
export default async function HowItWorksPage() {
  const [settings, partSteps] = await Promise.all([getPublicSiteSettings(), getSparePartDeliverySteps()])

  const payments = [
    {
      label: "Initial payment",
      due: "When your order is confirmed. Procurement and shipping begin once it is received.",
      percent: settings.paymentSchedule.initial,
    },
    {
      label: "Mombasa payment",
      due: "When your vehicle arrives at the port of Mombasa.",
      percent: settings.paymentSchedule.mombasa,
    },
    {
      label: "Final payment",
      due: "Before your vehicle is released and handed over to you.",
      percent: settings.paymentSchedule.final,
    },
  ]

  const stages = customerTimelineStages(settings.trackingStages, ShipmentType.VEHICLE, new Set())
  const showQuote = settings.catalogDisplay.actions.getQuote
  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: settings.contact.whatsappNumber,
    message: buildGeneralWhatsAppMessage(settings.businessName),
  })

  return (
    <div className="dark bg-background text-foreground">
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-night text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <Image
            src="/images/how-it-works/hero.jpg"
            alt=""
            fill
            preload
            sizes="100vw"
            className="load-settle object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-night via-night/80 to-night/20" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>

        <Container size="wide" className="flex flex-col gap-6 py-20 md:py-28 lg:py-32">
          <Breadcrumbs items={[{ label: "How It Works" }]} className="load-rise hidden sm:block" />
          <h1 className="max-w-4xl text-h1 sm:text-display">
            <AnimatedWords text={HERO_LEAD} trigger="load" startDelay={160} />{" "}
            <span className="text-gold">
              <AnimatedWords text={HERO_ACCENT} trigger="load" startDelay={160 + wordsDuration(HERO_LEAD)} />
            </span>
          </h1>
          <p className="load-rise max-w-2xl text-body-lg text-white/75" style={delay(HERO_TEXT_AT)}>
            {settings.businessName} sources your vehicle in Japan or South Korea, ships it through Mombasa and
            delivers it in South Sudan. Here is every step, and what happens at each.
          </p>
          <div className="load-rise flex flex-wrap gap-3 pt-2" style={delay(HERO_TEXT_AT + 120)}>
            <Button render={<Link href="/cars" />} size="lg" className="group/cta">
              Browse vehicles
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-fast ease-crownline group-hover/cta:translate-x-1"
              />
            </Button>
            {showQuote ? (
              <Button render={<Link href="/get-a-quote" />} variant="outline" size="lg">
                <MessageSquareText aria-hidden="true" className="size-4" />
                Get a quote
              </Button>
            ) : null}
          </div>
        </Container>
      </section>

      {/* ── The eight steps ────────────────────────────────────────── */}
      <section aria-labelledby="steps-heading" className="bg-background py-20 md:py-28">
        <Container size="wide" className="flex flex-col gap-14">
          <InView>
            <ShowroomHeading
              id="steps-heading"
              icon={Route}
              label="The import journey"
              lead="Eight steps,"
              accent="one team."
              description="You choose the car. We handle everything between the seller abroad and your hands."
              align="center"
            />
          </InView>
          <ImportTimeline />
        </Container>
      </section>

      {/* ── Payments ───────────────────────────────────────────────── */}
      <section aria-labelledby="payments-heading" className="relative isolate overflow-hidden bg-night py-20 md:py-28">
        <div aria-hidden="true" className="bg-dot-grid absolute inset-0 -z-10" />
        <Container size="wide">
          <InView className="flex flex-col gap-12">
            <ShowroomHeading
              id="payments-heading"
              icon={Wallet}
              label="Payments"
              lead="Pay in stages,"
              accent="as your car travels."
              description="Vehicle orders are paid in three parts of the agreed price. Your quotation shows the exact amount of each, and every payment is checked and confirmed by our team."
            />

            <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {payments.map((payment, index) => {
                const figure = wholeOrExact(payment.percent)
                return (
                  <li
                    key={payment.label}
                    className="rv-up relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-card/70 p-7"
                    style={delay(400 + index * ITEM_STEP_MS)}
                  >
                    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
                    <span className="tabular text-small font-semibold text-gold">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="font-heading text-display leading-none font-bold text-foreground">
                      {figure.whole ? (
                        <CountUp value={Number(figure.text)} trigger="view" startDelay={500 + index * 150} />
                      ) : (
                        <span className="tabular">{figure.text}</span>
                      )}
                      <span className="text-gold">%</span>
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <h3 className="font-heading text-title text-foreground">{payment.label}</h3>
                      <p className="text-body text-muted-foreground">{payment.due}</p>
                    </div>
                  </li>
                )
              })}
            </ol>

            <p className="rv-up text-small text-muted-foreground" style={delay(700)}>
              The full agreed price is paid before handover. Payments are made by bank transfer or mobile money.
            </p>
          </InView>
        </Container>
      </section>

      {/* ── Tracking ───────────────────────────────────────────────── */}
      <section aria-labelledby="tracking-heading" className="bg-background py-20 md:py-28">
        <Container size="wide">
          <InView className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="flex flex-col gap-8">
              <ShowroomHeading
                id="tracking-heading"
                icon={Radar}
                label="Tracking"
                lead="Follow every stage"
                accent="as it happens."
                description="You receive a tracking number once your initial payment is confirmed. Enter it on Track My Order to see where your vehicle is, each stage it has passed, and when to expect it."
              />
              <div className="rv-up relative aspect-[16/10] overflow-hidden rounded-2xl" style={delay(500)}>
                <Image
                  src="/images/how-it-works/tracking.jpg"
                  alt="A car transporter carrying vehicles by road"
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover"
                />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-night/70 to-transparent" />
              </div>
              <div className="rv-up" style={delay(600)}>
                <Button render={<Link href="/track-my-order" />} size="lg" className="group/track">
                  Track my order
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-fast ease-crownline group-hover/track:translate-x-1"
                  />
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-card/70 p-6 sm:p-8">
              <h3 className="mb-6 font-heading text-title text-foreground">The stages you will see</h3>
              <ol className="relative flex flex-col gap-4">
                <span aria-hidden="true" className="absolute top-3 bottom-3 left-3 w-px bg-white/10" />
                {stages.map((stage, index) => (
                  <li key={stage.status} className="rv-up relative flex gap-4" style={delay(400 + index * 80)}>
                    <span
                      aria-hidden="true"
                      className="relative z-10 grid size-6 shrink-0 place-items-center rounded-full border border-gold/50 bg-night text-gold"
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-body font-medium text-foreground">{stage.label}</span>
                      {stage.description ? (
                        <span className="text-small text-muted-foreground">{stage.description}</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </InView>
        </Container>
      </section>

      {/* ── Spare parts ────────────────────────────────────────────── */}
      {partSteps.length > 0 ? (
        <section aria-labelledby="parts-heading" className="border-y border-white/8 bg-night py-20 md:py-24">
          <Container size="wide">
            <InView className="flex flex-col gap-12">
              <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <ShowroomHeading
                  id="parts-heading"
                  icon={Wrench}
                  label="Spare parts"
                  lead="Spare parts take"
                  accent="a shorter road."
                  description="Parts do not go through the vehicle import process. This is how an order for parts reaches you."
                />
                <Link
                  href="/spare-parts"
                  className="rv-up group/parts inline-flex w-fit shrink-0 items-center gap-2 py-2 text-small font-semibold text-gold transition-colors duration-fast hover:text-gold-bright"
                  style={delay(500)}
                >
                  Browse spare parts
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-fast ease-crownline group-hover/parts:translate-x-1"
                  />
                </Link>
              </div>

              <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {partSteps.map((step, index) => (
                  <li
                    key={step.title}
                    className="rv-up flex flex-col gap-3 rounded-2xl border border-white/10 bg-card/70 p-6"
                    style={delay(400 + index * ITEM_STEP_MS)}
                  >
                    <span className="tabular text-small font-semibold text-gold">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-heading text-title text-foreground">{step.title}</h3>
                    <p className="text-body text-muted-foreground">{step.description}</p>
                  </li>
                ))}
              </ol>
            </InView>
          </Container>
        </section>
      ) : null}

      {/* ── Next step ──────────────────────────────────────────────── */}
      <section aria-labelledby="next-heading" className="bg-background py-20 md:py-28">
        <Container size="wide">
          <InView className="flex flex-col items-center gap-6 text-center">
            <h2 id="next-heading" className="max-w-3xl text-h1 text-foreground">
              <AnimatedWords text="Ready to find" startDelay={100} />{" "}
              <span className="text-gold">
                <AnimatedWords text="your vehicle?" startDelay={100 + wordsDuration("Ready to find")} />
              </span>
            </h2>
            <p className="rv-up max-w-xl text-body-lg text-muted-foreground" style={delay(450)}>
              Browse what is for sale now, or tell us what you want and we will source it.
            </p>
            <div className="rv-up flex flex-wrap justify-center gap-3" style={delay(600)}>
              <Button render={<Link href="/cars" />} size="lg">
                Browse vehicles
              </Button>
              {showQuote ? (
                <Button render={<Link href="/get-a-quote" />} variant="outline" size="lg">
                  Get a quote
                </Button>
              ) : null}
              {whatsappUrl ? (
                <Button
                  render={<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" />}
                  variant="whatsapp"
                  size="lg"
                >
                  <WhatsAppGlyph className="size-4" />
                  WhatsApp us
                </Button>
              ) : null}
            </div>
          </InView>
        </Container>
      </section>
    </div>
  )
}
