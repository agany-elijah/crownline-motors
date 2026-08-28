// Main navigation link definitions

export interface NavLink {
  label: string
  href: string
  /**
   * False while the section has no page behind it yet.
   *
   * Stage 4 allows navigation entries to ship "disabled/marked
   * unavailable until their implementation stage", which is the right
   * treatment for Spare Parts: the brief wants it visible in the
   * navigation from launch so customers know it is coming, but the
   * catalogue itself is Wave B. Rendering it as a live link in the
   * meantime sends anyone who taps it to a 404 — the one outcome that
   * makes a new business look broken rather than forthcoming.
   *
   * Unavailable entries render as non-interactive text with a "Soon"
   * marker. Flip this to true (or delete the flag) the moment the route
   * exists; nothing else needs to change.
   */
  available?: boolean
}

export const mainNavLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Cars", href: "/cars" },
  { label: "Spare Parts", href: "/spare-parts", available: false },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Track My Order", href: "/track-my-order" },
  { label: "Get a Quote", href: "/get-a-quote" },
  { label: "About Us", href: "/about-us" },
  { label: "Contact", href: "/contact" },
]

/** True unless a link has been explicitly marked unavailable. Centralised so
 *  the header, drawer and footer all answer the question the same way. */
export function isNavLinkAvailable(link: NavLink): boolean {
  return link.available !== false
}

function findNavLink(href: string): NavLink {
  const link = mainNavLinks.find((item) => item.href === href)

  if (!link) {
    // Fails fast at module load rather than silently rendering a broken
    // footer link — this only fires if a developer edits mainNavLinks
    // without updating the group below, so surfacing it immediately
    // (dev/build startup) beats a quiet dead link shipping to production.
    throw new Error(`footerLinkGroups references unknown nav href: "${href}"`)
  }

  return link
}

export interface FooterLinkGroup {
  title: string
  links: NavLink[]
}

/** Footer navigation, grouped for the multi-column layout. Derived from
 *  mainNavLinks rather than duplicated, so the two can never drift apart —
 *  edit labels/hrefs in mainNavLinks only. */
export const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: "Explore",
    links: [findNavLink("/cars"), findNavLink("/spare-parts"), findNavLink("/how-it-works")],
  },
  {
    title: "Support",
    links: [findNavLink("/track-my-order"), findNavLink("/get-a-quote"), findNavLink("/contact")],
  },
]