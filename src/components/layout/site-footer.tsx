import Link from "next/link"
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Container } from "@/components/layout/container"
import { BrandMark } from "@/components/layout/brand-mark"
import { siteConfig } from "@/config/site"
import { footerLinkGroups, isNavLinkAvailable } from "@/lib/constants/nav-links"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

const socialLinks = [
  { label: "Facebook", href: siteConfig.social.facebook, icon: "facebook" },
  { label: "Instagram", href: siteConfig.social.instagram, icon: "instagram" },
  { label: "LinkedIn", href: siteConfig.social.linkedin, icon: "linkedin" },
] as const

/** Sanitizes a display phone number down to a dialable tel: URI. Not a
 *  security boundary — just correctness, since the display string carries
 *  spaces and formatting a dialer would choke on. */
function toTelHref(displayNumber: string): string {
  return `tel:${displayNumber.replace(/[^\d+]/g, "")}`
}

function SocialIcon({ name }: { name: (typeof socialLinks)[number]["icon"] }) {
  if (name === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
        <path d="M14 8h3V4h-3c-3.3 0-5 1.7-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9c0-.7.3-1 1-1Z" />
      </svg>
    )
  }

  if (name === "instagram") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
      <path d="M5 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.6h.1c.5-.9 1.7-2 3.6-2 3.9 0 4.5 2.6 4.5 6V21h-4v-5.7c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V21H9V9Z" />
    </svg>
  )
}

export function SiteFooter() {
  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: siteConfig.whatsappNumber,
    message: buildGeneralWhatsAppMessage(siteConfig.name),
  })

  const contactItems = [
    { icon: MapPinIcon, content: siteConfig.contact.address },
    { icon: ClockIcon, content: siteConfig.contact.hours },
    {
      icon: PhoneIcon,
      content: (
        <a
          href={toTelHref(siteConfig.contact.phone)}
          className="tabular transition-colors hover:text-gold-ink"
        >
          {siteConfig.contact.phone}
        </a>
      ),
    },
    {
      icon: MailIcon,
      content: (
        <a
          href={`mailto:${siteConfig.contact.email}`}
          className="transition-colors hover:text-gold-ink"
        >
          {siteConfig.contact.email}
        </a>
      ),
    },
  ]

  return (
    <footer
      data-slot="site-footer"
      data-tone="dark"
      className="bg-foreground text-background"
    >
      {/* Hairline gold rule across the full width — the single strongest
          brand cue in the footer, and cheaper visually than a gold block. */}
      <div aria-hidden="true" className="h-px w-full bg-gradient-to-r from-transparent via-gold/45 to-transparent" />

      <Container size="wide" className="py-16 md:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Brand + contact */}
          <div className="lg:col-span-5">
            <Link
              href="/"
              aria-label={`${siteConfig.name} — home`}
              className="inline-block transition-opacity duration-fast hover:opacity-80"
            >
              <BrandMark size="lg" />
            </Link>

            <p className="mt-5 max-w-sm text-body text-background/65">{siteConfig.description}</p>

            <ul className="mt-7 space-y-3.5 text-small text-background/80">
              {contactItems.map(({ icon: Icon, content }, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-gold-ink" aria-hidden="true" />
                  <span>{content}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Link groups */}
          {footerLinkGroups.map((group) => (
            <div key={group.title} className="lg:col-span-2">
              <h2 className="eyebrow text-gold-ink">{group.title}</h2>
              <ul className="mt-5 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    {isNavLinkAvailable(link) ? (
                      <Link
                        href={link.href}
                        className="text-small text-background/70 transition-colors duration-fast hover:text-background"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 text-small text-background/35">
                        {link.label}
                        <span className="rounded-4xl border border-white/15 px-1.5 py-px text-[0.625rem] font-semibold tracking-[0.08em] uppercase">
                          Soon
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Direct contact */}
          <div className="lg:col-span-3">
            <h2 className="eyebrow text-gold-ink">Talk to us</h2>
            <p className="mt-5 text-small text-background/65">
              Questions about a vehicle, a quote, or an order already on its way? We reply fast.
            </p>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "mt-5 inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5",
                  "text-small font-medium text-background",
                  "transition-colors duration-fast",
                  "hover:border-gold/60 hover:bg-white/5 hover:text-gold-ink"
                )}
              >
                <span aria-hidden="true" className="size-2 rounded-full bg-[#25D366]" />
                Message on WhatsApp
              </a>
            )}

            <div className="mt-7 flex items-center gap-2.5">
              {socialLinks.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-full border border-white/15 text-background/70 transition-colors duration-fast hover:border-gold/60 hover:text-gold-ink"
                >
                  <SocialIcon name={icon} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-background/50">
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p className="text-small text-background/50">
            Vehicles sourced from Japan &amp; South Korea · Delivered across South Sudan
          </p>
        </div>
      </Container>
    </footer>
  )
}
