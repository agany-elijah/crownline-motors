// Single source of truth: site name, WhatsApp number, contact info
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

  // TODO(client): placeholder contact details — replace with Crownline
  // Motors' real information before launch (brief §14, Contact page).
  contact: {
    phone: "+211 900 000 000",
    email: "info@crownlinemotors.com",
    address: "Juba, South Sudan",
    hours: "Mon – Sat: 8:00 AM – 6:00 PM",
  },

  // TODO(client): placeholder social profiles — replace or remove entries
  // that don't apply once real accounts exist.
  social: {
    facebook: "https://facebook.com/crownlinemotors",
    instagram: "https://instagram.com/crownlinemotors",
    linkedin: "https://www.linkedin.com/company/crownlinemotors",
  },
} as const

export type { NavLink }