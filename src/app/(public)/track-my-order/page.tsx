import type { Metadata } from "next"
import type { ReactNode } from "react"
import { AlertCircle, Clock3, Mail, MapPin, SearchX, Ship, type LucideIcon } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Section } from "@/components/layout/section"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { TrackingSearch } from "@/components/tracking/tracking-search"
import { TrackingTimeline } from "@/components/tracking/tracking-timeline"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import { getClientIp } from "@/lib/auth/client-ip"
import {
  RATE_LIMIT_SCOPES,
  TRACKING_LOOKUP_MAX_PER_IP,
  TRACKING_LOOKUP_WINDOW_MS,
  consumeRateLimit,
} from "@/lib/auth/rate-limit"
import { getWhatsAppNumber } from "@/lib/queries/settings.queries"
import { lookupPublicTracking, type PublicTrackingResult } from "@/lib/queries/tracking.queries"
import { parseTrackingLookup } from "@/lib/tracking/tracking-number"
import { cn } from "@/lib/utils"
import {
  buildGeneralWhatsAppMessage,
  buildOrderWhatsAppMessage,
  buildTrackingWhatsAppMessage,
  buildWhatsAppUrl,
} from "@/lib/utils/whatsapp"

/**
 * Track My Order — where a customer follows their vehicle or parts.
 *
 * The tracking number arrives by email the moment an operator activates
 * tracking on the order, and every later update links back here. The page
 * works out from the number alone which journey to draw.
 *
 * Every lookup is rate-limited per connection (tracking numbers are
 * sequential), and the result shows the journey only — never who the order
 * belongs to or what it cost. See tracking.queries.ts.
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

  return {
    title: "Track My Order",
    description:
      "Follow your Crownline Motors order — from Japan or Korea, through Mombasa, to delivery in South Sudan — with your tracking number.",
    alternates: { canonical: "/track-my-order" },
    // A result is one customer's shipment. Only the search page is indexed.
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
        [{ key: { scope: RATE_LIMIT_SCOPES.trackingLookupIp, identifier: ip }, max: TRACKING_LOOKUP_MAX_PER_IP }],
        TRACKING_LOOKUP_WINDOW_MS
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

function supportMessage(view: ViewState): string {
  switch (view.kind) {
    case "FOUND":
      return buildTrackingWhatsAppMessage({ siteName: siteConfig.name, trackingNumber: view.result.trackingNumber })
    case "ORDER_UNTRACKED":
      return buildOrderWhatsAppMessage({ siteName: siteConfig.name, orderNumber: view.orderNumber })
    case "NOT_FOUND":
    case "ERROR":
      return buildTrackingWhatsAppMessage({ siteName: siteConfig.name, trackingNumber: view.reference })
    default:
      return buildGeneralWhatsAppMessage(siteConfig.name)
  }
}

export default async function TrackMyOrderPage(props: PageProps<"/track-my-order">) {
  const { number } = await props.searchParams
  const raw = readNumber(number)

  const [view, whatsappNumber] = await Promise.all([resolveView(raw), getWhatsAppNumber()])
  const whatsappUrl = buildWhatsAppUrl({ phoneNumber: whatsappNumber, message: supportMessage(view) })

  return (
    <>
      <PageHeader
        eyebrow="Track My Order"
        title="Follow your order's journey"
        description="Enter your tracking number to see where your vehicle or parts are — from export, across the sea to Mombasa, to delivery in South Sudan."
      />

      <Section spacing="compact" className="pb-16 md:pb-24">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <div className="rounded-xl bg-card p-6 shadow-[var(--shadow-subtle)] ring-1 ring-foreground/10 md:p-8">
            <TrackingSearch defaultValue={raw} />
          </div>

          {view.kind === "FOUND" ? <TrackingTimeline result={view.result} /> : null}

          {view.kind === "INVALID" ? (
            <StatusMessage icon={AlertCircle} tone="warning" title="Check the tracking number">
              Crownline tracking numbers look like <span className="font-mono">CLM-2026-000125</span>. Check the
              number in your email or WhatsApp message and try again.
            </StatusMessage>
          ) : null}

          {view.kind === "NOT_FOUND" ? (
            <StatusMessage icon={SearchX} tone="warning" title="We couldn't find that order">
              Nothing matches <span className="font-mono">{view.reference}</span>. Check it against your tracking
              email, or message us and we will look it up for you.
            </StatusMessage>
          ) : null}

          {view.kind === "ORDER_UNTRACKED" ? (
            <StatusMessage icon={Clock3} title="No tracking to show yet">
              There is no tracking to show for <span className="font-mono">{view.orderNumber}</span>. Tracking starts
              once an order begins its journey, and we email the tracking number — it looks like{" "}
              <span className="font-mono">CLM-2026-000125</span> — the moment it does. If you were expecting an update,
              check the number or message us.
            </StatusMessage>
          ) : null}

          {view.kind === "RATE_LIMITED" ? (
            <StatusMessage icon={Clock3} tone="warning" title="Please try again shortly">
              There have been a lot of tracking searches from your connection. Please wait a few minutes and try
              again, or message us on WhatsApp.
            </StatusMessage>
          ) : null}

          {view.kind === "ERROR" ? (
            <StatusMessage icon={AlertCircle} tone="warning" title="We couldn't check your order just now">
              Something went wrong on our side. Please try again in a moment.
            </StatusMessage>
          ) : null}

          {view.kind === "IDLE" ? (
            <ul className="grid gap-6 sm:grid-cols-3">
              <HelpPoint icon={Mail} title="Sent to your inbox">
                Your tracking number is emailed as soon as your order starts its journey.
              </HelpPoint>
              <HelpPoint icon={Ship} title="Every stage, dated">
                Inspection, export, shipping, clearing at Mombasa and the road to South Sudan.
              </HelpPoint>
              <HelpPoint icon={MapPin} title="Kept up to date">
                Our team records each step, and we email you every time it moves.
              </HelpPoint>
            </ul>
          ) : null}

          {whatsappUrl ? (
            <div className="flex flex-col items-start gap-4 rounded-xl bg-secondary p-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-body text-muted-foreground">Questions about your order? Our team replies on WhatsApp.</p>
              <Button
                render={<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" />}
                variant="whatsapp"
                size="lg"
              >
                <WhatsAppGlyph className="size-4" />
                WhatsApp us
              </Button>
            </div>
          ) : null}
        </div>
      </Section>
    </>
  )
}

function StatusMessage({
  icon: Icon,
  title,
  tone = "neutral",
  children,
}: {
  icon: LucideIcon
  title: string
  tone?: "neutral" | "warning"
  children: ReactNode
}) {
  return (
    <div role="status" className="flex gap-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <Icon
        aria-hidden="true"
        className={cn("mt-1 size-5 shrink-0", tone === "warning" ? "text-destructive" : "text-gold-ink")}
      />
      <div className="flex flex-col gap-1.5">
        <h2 className="text-h3">{title}</h2>
        <p className="text-body text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

function HelpPoint({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2">
      <Icon aria-hidden="true" className="size-5 text-gold-ink" />
      <h2 className="text-body font-semibold">{title}</h2>
      <p className="text-small text-muted-foreground">{children}</p>
    </li>
  )
}
