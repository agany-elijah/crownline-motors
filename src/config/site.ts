// Static site configuration and the fallbacks behind BusinessSettings
import { mainNavLinks, type NavLink } from "@/lib/constants/nav-links"

/**
 * Reads NEXT_PUBLIC_WHATSAPP_NUMBER at module load.
 *
 * NEXT_PUBLIC_-prefixed vars are inlined into the client bundle by Next.js,
 * so this value is visible to anyone viewing page source — fine, since
 * it's a public contact number, not a secret. Never store anything
 * sensitive under a NEXT_PUBLIC_ variable.
 */
function readWhatsAppNumber(): string {
  const value = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER

  if (!value || value.trim().length === 0) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[config/site] NEXT_PUBLIC_WHATSAPP_NUMBER is not set — WhatsApp CTAs will not render a link."
      )
    }
    return ""
  }

  return value.trim()
}

function readSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL
  return value && value.trim().length > 0 ? value.trim() : "https://crownlinemotors.com"
}

export const siteConfig = {
  name: "Crownline Motors",
  shortName: "Crownline",
  tagline: "Quality Cars. Global Standards. Local Commitment.",
  description: "Quality vehicles sourced from Japan and Korea and delivered to South Sudan.",
  url: readSiteUrl(),
  whatsappNumber: readWhatsAppNumber(),
  nav: mainNavLinks,

  // Contact details, business hours and social links are not here: they are
  // edited in Settings → Business information and read through
  // getPublicSiteSettings(). The name, tagline and description below are the
  // fallbacks used only when the settings row cannot be read.
} as const

export type { NavLink }