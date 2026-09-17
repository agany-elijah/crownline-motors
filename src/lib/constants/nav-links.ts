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

/** A header entry that opens a small menu of related pages. */
export interface NavGroup {
  label: string
  children: NavLink[]
}

export type HeaderNavItem = NavLink | NavGroup

export function isNavGroup(item: HeaderNavItem): item is NavGroup {
  return "children" in item
}

/**
 * The header's own arrangement of `mainNavLinks`.
 *
 * Track My Order and Get a Quote are services a customer uses once they know
 * what they want, not places they browse, so they sit together under
 * "Services" — which is also what lets the header carry one clear call to
 * action (Browse inventory) instead of three competing buttons. The hrefs and
 * labels still come from `mainNavLinks`, so the footer and the header cannot
 * disagree about either.
 */
export const headerNavItems: HeaderNavItem[] = [
  findNavLink("/"),
  findNavLink("/cars"),
  findNavLink("/spare-parts"),
  findNavLink("/how-it-works"),
  {
    label: "Services",
    children: [findNavLink("/track-my-order"), findNavLink("/get-a-quote")],
  },
  findNavLink("/about-us"),
  findNavLink("/contact"),
]

/** The header's primary call to action. */
export const INVENTORY_CTA = { label: "Browse Inventory", href: "/cars" } as const

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