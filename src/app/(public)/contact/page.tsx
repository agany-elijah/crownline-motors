import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Radar,
  type LucideIcon,
} from "lucide-react"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Container } from "@/components/layout/container"
import { ShowroomHeading } from "@/components/layout/showroom-heading"
import { AnimatedWords, wordsDuration } from "@/components/motion/animated-words"
import { InView } from "@/components/motion/in-view"
import { ITEM_STEP_MS, delay } from "@/components/motion/motion"
import { QuoteRequestForm } from "@/components/quotes/quote-request-form"
import { SocialIcon } from "@/components/shared/social-icon"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { cn } from "@/lib/utils"
import { toTelHref } from "@/lib/utils/tel"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

export async function generateMetadata(): Promise<Metadata> {
  const { businessName, contact } = await getPublicSiteSettings()
  const where = contact.address ? ` in ${contact.address}` : " in South Sudan"

  return {
    title: "Contact",
    description: `Contact ${businessName}${where} — call, WhatsApp, email or send us a message about a vehicle, spare parts or an order.`,
    alternates: { canonical: "/contact" },
  }
}

const HERO_LEAD = "Talk to a real person"
const HERO_ACCENT = "about your car."
const HERO_TEXT_AT = 160 + wordsDuration(HERO_LEAD) + wordsDuration(HERO_ACCENT) + 80

interface Channel {
  key: string
  icon: LucideIcon | "whatsapp"
  label: string
  value: string
  href: string
  external?: boolean
  action: string
}

/**
 * Contact (brief §14).
 *
 * Every detail on the page — phone, WhatsApp, email, address, hours, social
 * links, and whether calling and WhatsApp are offered at all — comes from
 * Settings → Business information and Catalogue display. A detail left empty
 * there renders no card rather than a placeholder.
 *
 * The message form is the general enquiry form. What a visitor sends arrives
 * in the dashboard's Quotes inbox, marked "Contact page", with the same
 * notifications as any other enquiry — one inbox rather than a second one to
 * keep an eye on.
 *
 * The location is a link to Google Maps rather than an embedded map, so no
 * third-party script or tracking loads on the page for visitors who never
 * look at it.
 */
export default async function ContactPage() {
  const settings = await getPublicSiteSettings()
  const { contact } = settings

  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: contact.whatsappNumber,
    message: buildGeneralWhatsAppMessage(settings.businessName),
  })

  const channels: Channel[] = [
    contact.phone && contact.callUsEnabled
      ? {
          key: "phone",
          icon: Phone,
          label: "Call us",
          value: contact.phone,
          href: toTelHref(contact.phone),
          action: "Call now",
        }
      : null,
    whatsappUrl
      ? {
          key: "whatsapp",
          icon: "whatsapp" as const,
          label: "WhatsApp",
          value: contact.whatsappNumber,
          href: whatsappUrl,
          external: true,
          action: "Start a chat",
        }
      : null,
    contact.email
      ? {
          key: "email",
          icon: Mail,
          label: "Email",
          value: contact.email,
          href: `mailto:${contact.email}`,
          action: "Send an email",
        }
      : null,
    contact.address
      ? {
          key: "address",
          icon: MapPin,
          label: "Visit us",
          value: contact.address,
          href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`,
          external: true,
          action: "Open in Google Maps",
        }
      : null,
  ].filter((channel) => channel !== null)

  return (
    <div className="dark bg-background text-foreground">
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-night text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <Image
            src="/images/contact/hero.jpg"
            alt=""
            fill
            preload
            sizes="100vw"
            className="load-settle object-cover object-[70%_center] opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-night via-night/85 to-night/25" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>

        <Container size="wide" className="flex flex-col gap-6 py-20 md:py-28">
          <Breadcrumbs items={[{ label: "Contact" }]} className="load-rise hidden sm:block" />
          <h1 className="max-w-3xl text-h1 sm:text-display">
            <AnimatedWords text={HERO_LEAD} trigger="load" startDelay={160} />{" "}
            <span className="text-gold">
              <AnimatedWords text={HERO_ACCENT} trigger="load" startDelay={160 + wordsDuration(HERO_LEAD)} />
            </span>
          </h1>
          <p className="load-rise max-w-2xl text-body-lg text-white/75" style={delay(HERO_TEXT_AT)}>
            Questions about a vehicle, spare parts, a quotation or an order already on its way — reach us however
            suits you.
          </p>
        </Container>
      </section>

      {/* ── Ways to reach us ───────────────────────────────────────── */}
      {channels.length > 0 ? (
        <section aria-label="Ways to reach us" className="bg-background pb-8">
          <Container size="wide">
            <InView>
              <ul
                className={cn(
                  "grid grid-cols-1 gap-4 sm:grid-cols-2",
                  channels.length >= 4 ? "lg:grid-cols-4" : channels.length === 3 ? "lg:grid-cols-3" : ""
                )}
              >
                {channels.map((channel, index) => (
                  <li key={channel.key} className="rv-up" style={delay(200 + index * ITEM_STEP_MS)}>
                    <ChannelCard channel={channel} />
                  </li>
                ))}
              </ul>
            </InView>
          </Container>
        </section>
      ) : null}

      {/* ── Message, hours and elsewhere ───────────────────────────── */}
      <section aria-labelledby="message-heading" className="bg-background py-16 md:py-24">
        <Container size="wide">
          <InView className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="flex flex-col gap-10 lg:col-span-5">
              <ShowroomHeading
                id="message-heading"
                icon={MessageSquareText}
                label="Send a message"
                lead="Tell us what"
                accent="you need."
                description="Leave your details and a few words. Our team replies by WhatsApp or email."
              />

              {settings.hours && settings.hours.length > 0 ? (
                <div className="rv-up flex gap-4 rounded-2xl border border-white/10 bg-card/70 p-6" style={delay(500)}>
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                    <Clock aria-hidden="true" className="size-5" />
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <h2 className="font-heading text-title text-foreground">Opening hours</h2>
                    <ul className="flex flex-col gap-0.5 text-body text-muted-foreground">
                      {settings.hours.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {settings.social.length > 0 ? (
                <div className="rv-up flex flex-col gap-3" style={delay(600)}>
                  <h2 className="text-small text-muted-foreground">Follow us</h2>
                  <ul className="flex flex-wrap gap-2.5">
                    {settings.social.map(({ network, label, url }) => (
                      <li key={network}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={label}
                          className="grid size-11 place-items-center rounded-full border border-white/15 text-foreground/75 transition-[color,border-color,background-color] duration-fast ease-crownline hover:border-gold/60 hover:bg-gold/10 hover:text-gold"
                        >
                          <SocialIcon network={network} />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rv-up flex flex-col gap-2 border-t border-white/10 pt-8" style={delay(700)}>
                <h2 className="text-small text-muted-foreground">Already ordered?</h2>
                <Link
                  href="/track-my-order"
                  className="group/track inline-flex w-fit items-center gap-2 text-body font-semibold text-gold transition-colors duration-fast hover:text-gold-bright"
                >
                  <Radar aria-hidden="true" className="size-4" />
                  Track your order
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-fast ease-crownline group-hover/track:translate-x-1"
                  />
                </Link>
              </div>
            </div>

            <div className="rv-up lg:col-span-7" style={delay(300)}>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card p-5 sm:p-8">
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
                <QuoteRequestForm subject={{ kind: "GENERAL", source: "CONTACT_PAGE" }} submitLabel="Send message" />
              </div>
            </div>
          </InView>
        </Container>
      </section>
    </div>
  )
}

function ChannelCard({ channel }: { channel: Channel }) {
  const Icon = channel.icon

  return (
    <a
      href={channel.href}
      {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "group/ch relative flex h-full flex-col gap-6 overflow-hidden rounded-2xl border border-white/10 bg-card/80 p-6",
        "transition-[border-color,translate,background-color] duration-slow ease-crownline-soft",
        "hover:-translate-y-1 hover:border-gold/45 hover:bg-card",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      )}
    >
      <div className="flex items-start justify-between">
        <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-gold-bright to-gold text-gold-foreground shadow-[var(--shadow-gold)]">
          {Icon === "whatsapp" ? (
            <WhatsAppGlyph className="size-5" />
          ) : (
            <Icon aria-hidden="true" className="size-5" />
          )}
        </span>
        <ArrowUpRight
          aria-hidden="true"
          className="size-5 text-muted-foreground transition-[color,rotate] duration-slow ease-crownline-soft group-hover/ch:rotate-45 group-hover/ch:text-gold"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-small text-muted-foreground">{channel.label}</span>
        <span className="font-heading text-title [overflow-wrap:anywhere] text-foreground">{channel.value}</span>
        <span className="mt-2 text-small font-semibold text-gold">{channel.action}</span>
      </div>
    </a>
  )
}
