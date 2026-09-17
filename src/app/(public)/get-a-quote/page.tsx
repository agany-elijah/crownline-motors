import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, BadgeCheck, FileText, MessageCircle, Search, ShieldCheck, type LucideIcon } from "lucide-react"

import { Section } from "@/components/layout/section"
import { QuoteRequestForm } from "@/components/quotes/quote-request-form"
import { Reveal } from "@/components/shared/reveal"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { JourneyArt } from "@/components/tracking/journey-art"
import { Button, buttonVariants } from "@/components/ui/button"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { cn } from "@/lib/utils"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

/**
 * Get a Quote — the open request: a vehicle or parts the customer has not
 * found in the catalogue, described in their own words.
 *
 * The form is the existing `QuoteRequestForm` in its GENERAL, detailed mode —
 * the same component, server action, validation, customer matching and
 * notifications as every other request on the site, so this page adds a
 * surface and nothing to maintain twice. Around it, the page says what happens
 * after sending, because a customer deciding whether to hand over their phone
 * number wants to know that first.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { businessName } = await getPublicSiteSettings()

  return {
    title: "Get a Quote",
    description: `Tell ${businessName} the vehicle or spare parts you are looking for. We source from Japan and Korea and send you a full quotation — no commitment.`,
    alternates: { canonical: "/get-a-quote" },
  }
}

export default async function GetAQuotePage() {
  const settings = await getPublicSiteSettings()
  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: settings.contact.whatsappNumber,
    message: buildGeneralWhatsAppMessage(settings.businessName),
  })

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section data-tone="dark" className="gold-ambient overflow-hidden bg-foreground text-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 md:py-20 lg:px-8">
          <span className="eyebrow text-gold">Get a Quote</span>
          <h1 className="max-w-3xl text-h1">Tell us what you&apos;re looking for. We&apos;ll find it.</h1>
          <p className="max-w-2xl text-body-lg text-background/70">
            A particular vehicle, or the spare parts your car needs — describe it, and our team sources it from Japan
            and Korea and sends you a full quotation.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-small text-background/75">
            {["No commitment", "Full price confirmed before you pay", "We reply by WhatsApp or email"].map((point) => (
              <li key={point} className="flex items-center gap-2">
                <BadgeCheck aria-hidden="true" className="size-4 text-gold" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── The request ──────────────────────────────────────────── */}
      <Section spacing="default">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          {/* What happens after sending — beside the form on a desktop, above it on a phone. */}
          <aside className="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
            <JourneyArt
              image="/images/quote/quote-hero.jpg"
              icon="ship"
              sizes="(min-width: 1024px) 38vw, 100vw"
              className="hidden aspect-[16/10] rounded-2xl ring-1 ring-foreground/10 lg:block"
            />

            <div className="flex flex-col gap-2">
              <span className="eyebrow text-gold-ink">How it works</span>
              <h2 className="text-h2">From your request to your quotation</h2>
            </div>

            <ol className="flex flex-col gap-6">
              <QuoteStep icon={FileText} step={1} title="Tell us what you need">
                The make and model, a year, a budget — or a part name and your car. Whatever you know is enough to
                start.
              </QuoteStep>
              <QuoteStep icon={Search} step={2} title="We source it">
                Our team searches suppliers and auctions in Japan and Korea for the right match.
              </QuoteStep>
              <QuoteStep icon={ShieldCheck} step={3} title="You receive a full quotation">
                The price, shipping and clearing, set out clearly. Nothing is charged until you accept it.
              </QuoteStep>
            </ol>

            {whatsappUrl ? (
              <div className="flex flex-col gap-3 rounded-2xl bg-secondary p-5">
                <p className="flex items-center gap-2 text-small font-medium">
                  <MessageCircle aria-hidden="true" className="size-4 text-gold-ink" />
                  Prefer to talk it through?
                </p>
                <Button
                  render={<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" />}
                  variant="whatsapp"
                  size="lg"
                  className="w-full sm:w-fit"
                >
                  <WhatsAppGlyph className="size-4" />
                  WhatsApp us
                </Button>
              </div>
            ) : null}
          </aside>

          <Reveal>
            <div
              id="quote-form"
              className="scroll-mt-28 rounded-2xl bg-card p-5 shadow-[var(--shadow-raised)] ring-1 ring-foreground/10 sm:p-8"
            >
              <div className="mb-6 flex flex-col gap-1.5 border-b border-border pb-6">
                <h2 className="text-h3">Request a quote</h2>
                <p className="text-small text-muted-foreground">
                  Takes about two minutes. Fields not marked optional are needed so we can reply.
                </p>
              </div>
              <QuoteRequestForm
                subject={{ kind: "GENERAL", source: "QUOTE_PAGE", detailed: true }}
                submitLabel="Request my quote"
              />
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ── Already know what you want ───────────────────────────── */}
      <Section spacing="compact" className="pb-16 md:pb-24">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 rounded-2xl bg-card p-7 ring-1 ring-foreground/10 sm:p-9 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-h3">It might already be here</h2>
            <p className="text-body text-muted-foreground">
              Browse the vehicles and spare parts we have available now before you ask.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/cars" className={cn(buttonVariants({ size: "lg" }), "group/cta")}>
              Browse inventory
              <ArrowRight aria-hidden="true" className="transition-transform duration-fast group-hover/cta:translate-x-0.5" />
            </Link>
            <Link href="/spare-parts" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Spare parts
            </Link>
          </div>
        </div>
      </Section>
    </>
  )
}

function QuoteStep({
  icon: Icon,
  step,
  title,
  children,
}: {
  icon: LucideIcon
  step: number
  title: string
  children: ReactNode
}) {
  return (
    <li className="flex gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-gold">
        <Icon aria-hidden="true" className="size-5" />
        <span className="sr-only">Step {step}</span>
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-body font-semibold">{title}</h3>
        <p className="text-small text-muted-foreground">{children}</p>
      </div>
    </li>
  )
}
