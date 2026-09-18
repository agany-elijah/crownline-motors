import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { AlertCircle, ArrowRight, Clock3, SearchX, type LucideIcon } from "lucide-react"

import { Section, SectionHeading } from "@/components/layout/section"
import { Reveal } from "@/components/shared/reveal"
import { AnimatedWords } from "@/components/motion/animated-words"
import { delay } from "@/components/motion/motion"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { OrderJourneyExplainer } from "@/components/tracking/order-journey-explainer"
import { TrackingResult } from "@/components/tracking/tracking-result"
import { TrackingSearch } from "@/components/tracking/tracking-search"
import { Button, buttonVariants } from "@/components/ui/button"
import { getClientIp } from "@/lib/auth/client-ip"
import {
  RATE_LIMIT_SCOPES,
  TRACKING_LOOKUP_MAX_PER_IP,
  TRACKING_LOOKUP_WINDOW_MS,
  consumeRateLimit,
} from "@/lib/auth/rate-limit"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { lookupPublicTracking, type PublicTrackingResult } from "@/lib/queries/tracking.queries"
import { buildCustomerJourney } from "@/lib/tracking/customer-journey"
import { parseTrackingLookup } from "@/lib/tracking/tracking-number"
import { cn } from "@/lib/utils"
import {
  buildGeneralWhatsAppMessage,
  buildOrderWhatsAppMessage,
  buildTrackingWhatsAppMessage,
  buildWhatsAppUrl,
} from "@/lib/utils/whatsapp"

/**
 * Track My Order — what an order goes through, and where a customer's is now.
 *
 * ── The shape of the page ─────────────────────────────────────────────
 * Before a search: the journey explained in its major phases, then the
 * tracking-number box with where that number comes from, then a way into the
 * inventory for someone who has not ordered yet. After a search the answer
 * moves to the top — a customer who typed a number came for the result, not
 * for the explanation, which follows it.
 *
 * ── What a lookup shows ───────────────────────────────────────────────
 * Only the journey: phases, dates staff recorded, the current location, the
 * expected delivery window staff set, and the listing photograph. Never who
 * the order belongs to or what it cost (see tracking.queries.ts). Every
 * lookup is rate-limited per connection, because tracking numbers are
 * sequential.
 */

type ViewState =
  | { kind: "IDLE" }
  | { kind: "INVALID" }
  | { kind: "RATE_LIMITED" }
  | { kind: "ERROR"; reference: string }
  | { kind: "NOT_FOUND"; reference: string }
  | { kind: "ORDER_UNTRACKED"; orderNumber: string }
  | { kind: "FOUND"; result: PublicTrackingResult }

function readNumber(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === "string" ? raw.slice(0, 60) : ""
}

export async function generateMetadata(props: PageProps<"/track-my-order">): Promise<Metadata> {
  const { number } = await props.searchParams
  const { businessName } = await getPublicSiteSettings()

  return {
    title: "Track My Order",
    description: `See every stage of your ${businessName} order — from securing your vehicle or parts, through shipping and clearing, to delivery in South Sudan.`,
    alternates: { canonical: "/track-my-order" },
    // A result is one customer's shipment. Only the explanation page is indexed.
    ...(readNumber(number) ? { robots: { index: false, follow: false } } : {}),
  }
}

async function resolveView(raw: string): Promise<ViewState> {
  if (raw.trim().length === 0) return { kind: "IDLE" }

  const lookup = parseTrackingLookup(raw)
  if (!lookup) return { kind: "INVALID" }

  try {
    const ip = await getClientIp()

    if (ip) {
      const verdict = await consumeRateLimit(
        [
          {
            key: { scope: RATE_LIMIT_SCOPES.trackingLookupIp, identifier: ip },
            max: TRACKING_LOOKUP_MAX_PER_IP,
          },
        ],
        TRACKING_LOOKUP_WINDOW_MS,
      )

      if (!verdict.allowed) return { kind: "RATE_LIMITED" }
    }

    const outcome = await lookupPublicTracking(lookup)

    if (outcome.kind === "FOUND") return { kind: "FOUND", result: outcome }
    if (outcome.kind === "ORDER_UNTRACKED") return outcome
    return { kind: "NOT_FOUND", reference: lookup.value }
  } catch (error) {
    console.error("[track-my-order] lookup failed", error)
    return { kind: "ERROR", reference: lookup.value }
  }
}

function supportMessage(view: ViewState, siteName: string): string {
  switch (view.kind) {
    case "FOUND":
      return buildTrackingWhatsAppMessage({
        siteName,
        trackingNumber: view.result.trackingNumber,
      })
    case "ORDER_UNTRACKED":
      return buildOrderWhatsAppMessage({
        siteName,
        orderNumber: view.orderNumber,
      })
    case "NOT_FOUND":
    case "ERROR":
      return buildTrackingWhatsAppMessage({
        siteName,
        trackingNumber: view.reference,
      })
    default:
      return buildGeneralWhatsAppMessage(siteName)
  }
}

export default async function TrackMyOrderPage(props: PageProps<"/track-my-order">) {
  const { number } = await props.searchParams
  const raw = readNumber(number)

  const [view, siteSettings] = await Promise.all([resolveView(raw), getPublicSiteSettings()])
  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: siteSettings.contact.whatsappNumber,
    message: supportMessage(view, siteSettings.businessName),
  })
  const searched = view.kind !== "IDLE"

  const whatsappButton = whatsappUrl ? (
    <Button render={<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" />} variant="whatsapp" size="lg">
      <WhatsAppGlyph className="size-4" />
      WhatsApp us
    </Button>
  ) : null

  const numberOrigin = (className?: string) => (
    <aside
      aria-labelledby="tracking-number-origin"
      data-tone="dark"
      className={cn(
        "gold-ambient flex flex-col gap-3 self-start overflow-hidden rounded-2xl bg-foreground p-6 text-background sm:p-8",
        className,
      )}
    >
      <h2 id="tracking-number-origin" className="text-h3">
        No tracking number yet?
      </h2>
      <p className="text-body text-background/70">
        Your tracking number will be shared with you by our team via WhatsApp or email once your deposit — or full
        payment, for parts — is confirmed.
      </p>
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-small font-medium text-gold underline-offset-4 hover:underline"
        >
          Message us on WhatsApp
        </a>
      ) : null}
    </aside>
  )

  const trackingSection = (
    <Section id="track" spacing="default" className="scroll-mt-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
          {/* ── The box ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <SectionHeading title="Track your order" description="Enter the tracking number our team sent you." />
            <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-raised)] ring-1 ring-foreground/10 sm:p-7">
              <TrackingSearch defaultValue={raw} />
            </div>
          </div>

          {/* ── Where the number comes from ──────────────────────── */}
          {numberOrigin(searched ? "hidden lg:flex" : undefined)}
        </div>

        {/* ── The answer ─────────────────────────────────────────── */}
        {view.kind === "FOUND" ? (
          <TrackingResult
            result={view.result}
            journey={buildCustomerJourney({
              shipmentType: view.result.shipmentType,
              currentStatus: view.result.currentStatus,
              events: view.result.events,
              stages: siteSettings.trackingStages[view.result.shipmentType],
            })}
            supportAction={whatsappButton}
          />
        ) : null}

        {view.kind === "INVALID" ? (
          <StatusMessage icon={AlertCircle} tone="warning" title="That doesn't look like a tracking number">
            Check the number in your email or WhatsApp message and try again.
          </StatusMessage>
        ) : null}

        {view.kind === "NOT_FOUND" ? (
          <StatusMessage icon={SearchX} tone="warning" title="We couldn't find that order" action={whatsappButton}>
            Check the number and try again, or message us and we will look it up for you.
          </StatusMessage>
        ) : null}

        {view.kind === "ORDER_UNTRACKED" ? (
          <StatusMessage icon={Clock3} title="Tracking hasn't started yet" action={whatsappButton}>
            Tracking starts once your deposit is confirmed. Our team will then send you your tracking number.
          </StatusMessage>
        ) : null}

        {view.kind === "RATE_LIMITED" ? (
          <StatusMessage icon={Clock3} tone="warning" title="Please try again shortly" action={whatsappButton}>
            Too many searches from your connection. Please wait a few minutes and try again.
          </StatusMessage>
        ) : null}

        {view.kind === "ERROR" ? (
          <StatusMessage icon={AlertCircle} tone="warning" title="We couldn't check your order just now">
            Something went wrong on our side. Please try again in a moment.
          </StatusMessage>
        ) : null}

        {/* After a search the answer comes first on a phone; the explanation
            of where numbers come from follows it rather than pushing it down. */}
        {searched ? numberOrigin("lg:hidden") : null}
      </div>
    </Section>
  )

  const journeySection = (
    <Section id="journey" variant="muted" spacing="default" className="scroll-mt-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="The order journey"
            title="What your order goes through"
            description="Every order moves through a few clear stages, from deposit to delivery."
          />
        </Reveal>
        <Reveal delay={80}>
          <OrderJourneyExplainer />
        </Reveal>
      </div>
    </Section>
  )

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section data-tone="dark" className="gold-ambient overflow-hidden bg-foreground text-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 md:py-20 lg:px-8">
          <span className="load-rise eyebrow text-gold" style={delay(80)}>
            Track My Order
          </span>
          <h1 className="max-w-3xl text-h1">
            <AnimatedWords text="Every stage of your order, in plain sight." trigger="load" startDelay={160} />
          </h1>
          <p className="load-rise max-w-2xl text-body-lg text-background/70" style={delay(680)}>
            Follow your vehicle or spare parts from deposit to delivery in South Sudan.
          </p>
          <div className="load-rise flex flex-wrap gap-3 pt-2" style={delay(800)}>
            <a href="#track" className={buttonVariants({ size: "lg" })}>
              Track your order
            </a>
            {searched ? null : (
              // The data attributes are what the dark-surface button rules in
              // globals.css key on; without them an outline link paints white.
              <a
                href="#journey"
                data-slot="button"
                data-variant="outline"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                How it works
              </a>
            )}
          </div>
        </div>
      </section>

      {searched ? (
        <>
          {trackingSection}
          {journeySection}
        </>
      ) : (
        <>
          {journeySection}
          {trackingSection}
        </>
      )}

      {/* ── Not ordered yet ──────────────────────────────────────── */}
      <Section spacing="default">
        <Reveal>
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-2xl bg-card p-7 ring-1 ring-foreground/10 sm:p-10 md:flex-row md:items-center md:justify-between">
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 className="text-h2">Still haven&apos;t found your vehicle?</h2>
              <p className="text-body text-muted-foreground">
                Browse our inventory, or tell us what you need and we will source it.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/cars" className={cn(buttonVariants({ size: "lg" }), "group/cta")}>
                View our inventory
                <ArrowRight
                  aria-hidden="true"
                  className="transition-transform duration-fast group-hover/cta:translate-x-0.5"
                />
              </Link>
              <Link href="/get-a-quote" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Request a vehicle
              </Link>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  )
}

function StatusMessage({
  icon: Icon,
  title,
  tone = "neutral",
  action,
  children,
}: {
  icon: LucideIcon
  title: string
  tone?: "neutral" | "warning"
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-5 rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between md:p-8"
    >
      <div className="flex gap-4">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full",
            tone === "warning" ? "bg-destructive/10 text-destructive" : "bg-gold/15 text-gold-ink",
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-h3">{title}</h2>
          <p className="max-w-2xl text-body text-muted-foreground">{children}</p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
