import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  CreditCard,
  MessageCircle,
  SearchX,
  Send,
  type LucideIcon,
} from "lucide-react"

import { Section, SectionHeading } from "@/components/layout/section"
import { Reveal } from "@/components/shared/reveal"
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
import { exampleTrackingNumber, parseTrackingLookup } from "@/lib/tracking/tracking-number"
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
  // The configured prefix, so the help text matches the numbers being issued.
  const example = exampleTrackingNumber(siteSettings.trackingNumberPrefix)
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
        "gold-ambient flex flex-col gap-6 overflow-hidden rounded-2xl bg-foreground p-6 text-background sm:p-8",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-gold">Good to know</span>
        <h2 id="tracking-number-origin" className="text-h3">
          Where your tracking number comes from
        </h2>
      </div>
      <ol className="flex flex-col gap-5">
        <OriginStep icon={MessageCircle} step={1} title="Contact us about your order">
          Request a quote or message our team about the vehicle or parts you want.
        </OriginStep>
        <OriginStep icon={CreditCard} step={2} title="Pay your initial deposit">
          Tracking begins once our team has confirmed your deposit — or full payment, for parts.
        </OriginStep>
        <OriginStep icon={Send} step={3} title="Receive your tracking number">
          Your tracking number will be shared with you by our team via WhatsApp or email.
        </OriginStep>
      </ol>
      {whatsappUrl ? (
        <p className="text-small text-background/70">
          Paid your deposit but have no number yet?{" "}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gold underline-offset-4 hover:underline"
          >
            Message us on WhatsApp
          </a>
          .
        </p>
      ) : null}
    </aside>
  )

  const trackingSection = (
    <Section id="track" spacing="default" className="scroll-mt-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
          {/* ── The box ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <SectionHeading
              eyebrow="Your tracking number"
              title="Track your order"
              description="Enter the tracking number our team sent you to see the current stage of your order, when to expect it, and what happens next."
            />
            <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-raised)] ring-1 ring-foreground/10 sm:p-7">
              <TrackingSearch defaultValue={raw} example={example} />
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
            Tracking numbers look like <span className="font-mono text-foreground">{example}</span>. Check the number in
            your email or WhatsApp message and try again.
          </StatusMessage>
        ) : null}

        {view.kind === "NOT_FOUND" ? (
          <StatusMessage icon={SearchX} tone="warning" title="We couldn't find that order" action={whatsappButton}>
            Nothing matches <span className="font-mono text-foreground">{view.reference}</span>. Check it against the
            message we sent you, or message us and we will look it up for you.
          </StatusMessage>
        ) : null}

        {view.kind === "ORDER_UNTRACKED" ? (
          <StatusMessage icon={Clock3} title="Tracking hasn't started yet" action={whatsappButton}>
            There is no tracking to show for <span className="font-mono text-foreground">{view.orderNumber}</span> yet.
            Tracking starts once your initial deposit is confirmed, and our team then sends your tracking number — it
            looks like <span className="font-mono text-foreground">{example}</span>.
          </StatusMessage>
        ) : null}

        {view.kind === "RATE_LIMITED" ? (
          <StatusMessage icon={Clock3} tone="warning" title="Please try again shortly" action={whatsappButton}>
            There have been a lot of tracking searches from your connection. Please wait a few minutes and try again, or
            message us on WhatsApp.
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
            description="From the moment your deposit is confirmed to the day it reaches you, every order moves through a few clear stages. Your tracking page shows exactly which one yours is in."
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
          <span className="eyebrow text-gold">Track My Order</span>
          <h1 className="max-w-3xl text-h1">Every stage of your order, in plain sight.</h1>
          <p className="max-w-2xl text-body-lg text-background/70">
            Follow your vehicle or spare parts from the moment your deposit is confirmed — through shipping and clearing
            — to the day it reaches you in South Sudan.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="#track" className={buttonVariants({ size: "lg" })}>
              Track your order
            </a>
            {searched ? null : (
              <a href="#journey" className={buttonVariants({ variant: "outline", size: "lg" })}>
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
              <span className="eyebrow text-gold-ink">Not ordered yet?</span>
              <h2 className="text-h2">Still haven&apos;t found your vehicle?</h2>
              <p className="text-body text-muted-foreground">
                Browse the vehicles we have available now, or tell us what you are looking for and we will source it for
                you.
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

function OriginStep({
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
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold ring-1 ring-gold/30">
        <Icon aria-hidden="true" className="size-4.5" />
        <span className="sr-only">Step {step}</span>
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-body font-semibold">{title}</h3>
        <p className="text-small text-background/65">{children}</p>
      </div>
    </li>
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
