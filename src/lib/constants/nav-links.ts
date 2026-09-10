// Main navigation link definitions

export interface NavLink {
  label: string
  href: string
  /**
   * False while the section has no page behind it yet.
   *
   * Stage 4 allows navigation entries to ship "disabled/marked unavailable
   * until their implementation stage". Spare Parts carried this flag until
   * its catalogue was built and no longer does — the route exists, so the
   * entry is a live link.
   *
   * The mechanism stays for the next section that needs it. Unavailable
   * entries render as non-interactive text with a "Soon" marker, which is
   * what keeps a customer from tapping through to a 404 — the one outcome
   * that makes a new business look broken rather than forthcoming.
   */
  available?: boolean
}

export const mainNavLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Cars", href: "/cars" },
  { label: "Spare Parts", href: "/spare-parts" },
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