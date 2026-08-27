import Link from "next/link"
import {
  ClockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from "lucide-react"

import { Container } from "@/components/layout/container"
import { siteConfig } from "@/config/site"
import { footerLinkGroups } from "@/lib/constants/nav-links"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

const socialLinks = [
  { label: "Facebook", href: siteConfig.social.facebook, icon: "facebook" },
  { label: "Instagram", href: siteConfig.social.instagram, icon: "instagram" },
  { label: "LinkedIn", href: siteConfig.social.linkedin, icon: "linkedin" },
] as const

/** Sanitizes a display phone number down to a dialable tel: URI. Not a
 *  security boundary (tel: links aren't executable) — just correctness,
 *  since the display string contains spaces/formatting. */
function toTelHref(displayNumber: string): string {
  return `tel:${displayNumber.replace(/[^\d+]/g, "")}`
}

export function SiteFooter() {
  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: siteConfig.whatsappNumber,
    message: buildGeneralWhatsAppMessage(siteConfig.name),
  })

  return (
    <footer data-slot="site-footer" className="border-t border-background/10 bg-foreground text-background">
      <Container size="wide" className="py-16 md:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          {/* Brand + contact block */}
          <div className="md:col-span-2">
            <Link href="/" className="font-heading text-xl font-semibold tracking-wide text-background">
              {siteConfig.shortName.toUpperCase()}
            </Link>
            <p className="mt-4 max-w-sm text-sm text-background/70">{siteConfig.description}</p>

            <ul className="mt-6 space-y-3 text-sm text-background/80">
              <li className="flex items-center gap-2.5">
                <MapPinIcon className="size-4 shrink-0 text-gold" aria-hidden="true" />
                <span>{siteConfig.contact.address}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <ClockIcon className="size-4 shrink-0 text-gold" aria-hidden="true" />
                <span>{siteConfig.contact.hours}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <PhoneIcon className="size-4 shrink-0 text-gold" aria-hidden="true" />
                <a href={toTelHref(siteConfig.contact.phone)} className="hover:text-background">
                  {siteConfig.contact.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MailIcon className="size-4 shrink-0 text-gold" aria-hidden="true" />
                <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-background">
                  {siteConfig.contact.email}
                </a>
              </li>
            </ul>

            <div className="mt-6 flex items-center gap-3">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-full border border-background/20 text-background/80 transition-colors duration-[var(--duration-fast)] hover:border-gold hover:text-gold"
                >
                  {Icon === "facebook" && (
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
                      <path d="M14 8h3V4h-3c-3.3 0-5 1.7-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9c0-.7.3-1 1-1Z" />
                    </svg>
                  )}
                  {Icon === "instagram" && (
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                    </svg>
                  )}
                  {Icon === "linkedin" && (
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
                      <path d="M5 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.6h.1c.5-.9 1.7-2 3.6-2 3.9 0 4.5 2.6 4.5 6V21h-4v-5.7c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V21H9V9Z" />
                    </svg>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {footerLinkGroups.map((group) => (
            <div key={group.title}>
              <h3 className="font-heading text-sm font-semibold tracking-wide text-gold">{group.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-background/75 transition-colors duration-[var(--duration-fast)] hover:text-background"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-background/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-background/60">
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-background/70 underline-offset-4 hover:text-gold hover:underline"
            >
              Message us on WhatsApp
            </a>
          )}
        </div>
      </Container>
    </footer>
  )
}