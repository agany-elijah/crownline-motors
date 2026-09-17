"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, MenuIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Container } from "@/components/layout/container"
import { BrandMark } from "@/components/layout/brand-mark"
import { MobileNav } from "@/components/layout/mobile-nav"
import { NavLink } from "@/components/layout/nav-link"
import { ServicesMenu } from "@/components/layout/services-menu"
import { HERO_ANCHOR_ATTRIBUTE } from "@/components/layout/hero-anchor"
import { useSiteSettings } from "@/components/shared/site-settings-provider"
import { INVENTORY_CTA, headerNavItems, isNavGroup, isNavLinkAvailable } from "@/lib/constants/nav-links"

/** Fallback header height used for the observer's top inset if the header
 *  cannot be measured for any reason. Matches the `h-16` mobile height. */
const FALLBACK_HEADER_HEIGHT_PX = 64

/**
 * Reports whether a dark hero is currently sitting underneath the header.
 *
 * Replaces an earlier `pathname === "/"` check, which assumed the homepage
 * always had a dark hero to sit on. While the homepage was still a
 * placeholder that assumption was false, and the header rendered its
 * white-text transparent variant over a white page — the navigation and
 * the menu trigger disappeared completely. Route-based styling cannot
 * detect that; asking the DOM can.
 *
 * The observer's root is inset from the top by the header's own height, so
 * "intersecting" means precisely "some of the hero is still behind the
 * header". Scrolling the hero away therefore restores the solid variant
 * without a second scroll listener.
 *
 * Returns false until proven otherwise. The solid header is legible on
 * every background, so the safe state is also the initial one — and the
 * only cost when a hero *is* present is that the header resolves to
 * transparent on the first frame after mount, which the background
 * transition absorbs.
 */
function useHeroBehindHeader(headerRef: React.RefObject<HTMLElement | null>) {
  const pathname = usePathname()
  const [hasHeroBehind, setHasHeroBehind] = React.useState(false)

  React.useEffect(() => {
    const hero = document.querySelector(`[${HERO_ANCHOR_ATTRIBUTE}]`)

    if (!hero || typeof IntersectionObserver === "undefined") {
      // Deferred to a microtask rather than called straight from the
      // effect body: a synchronous setState here runs during commit and
      // forces an immediate cascading re-render. Same deferral, for the
      // same reason, as the fallback path in use-reveal.ts.
      //
      // This reset is not redundant with the initial state — it is what
      // clears a stale `true` when a client-side navigation moves from a
      // page that has a hero to one that does not.
      queueMicrotask(() => setHasHeroBehind(false))
      return
    }

    const headerHeight = headerRef.current?.offsetHeight ?? FALLBACK_HEADER_HEIGHT_PX

    const observer = new IntersectionObserver(
      ([entry]) => setHasHeroBehind(entry.isIntersecting),
      { rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: 0 }
    )

    observer.observe(hero)
    return () => observer.disconnect()
    // Re-runs on navigation: the hero belongs to the page, not the layout,
    // so a client-side route change swaps it out from under this effect.
  }, [pathname, headerRef])

  return hasHeroBehind
}

/** True once the page has moved at all. Used only to fade the solid
 *  header's shadow in, so a page sitting at the top has a flat header
 *  rather than one casting a shadow onto nothing. */
function useIsScrolled() {
  const [isScrolled, setIsScrolled] = React.useState(false)

  React.useEffect(() => {
    let ticking = false

    function handleScroll() {
      if (ticking) return
      ticking = true
      // Coalesces bursts of scroll events into one state update per frame.
      // Without this the header re-renders dozens of times a second on a
      // low-end Android, which is exactly where it can least afford to.
      window.requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 8)
        ticking = false
      })
    }

    // Correct the state immediately in case the page loaded already
    // scrolled (anchor link, restored position) rather than waiting for
    // the first scroll event.
    handleScroll()

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return isScrolled
}

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface SiteHeaderProps {
  /**
   * The pre-built wa.me link for the mobile drawer's "WhatsApp Us" action,
   * or null when no number is configured.
   *
   * Threaded from the public layout because the number comes from
   * BusinessSettings, and this component is a Client Component — see the
   * note on MobileNavProps.
   */
  whatsappUrl: string | null
}

export function SiteHeader({ whatsappUrl }: SiteHeaderProps) {
  const pathname = usePathname()
  const headerRef = React.useRef<HTMLElement>(null)
  const hasHeroBehind = useHeroBehindHeader(headerRef)
  const isScrolled = useIsScrolled()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const { businessName } = useSiteSettings()

  /**
   * Clear only while the page sits at the very top of a dark hero. The moment
   * the visitor scrolls — over the hero or anywhere else — the header becomes
   * dark glass, so the video or photograph keeps moving behind the navigation
   * rather than being covered by a solid bar.
   *
   * The header is dark on every page, light ones included: the brand's black
   * is its frame, and one treatment everywhere means the navigation never
   * changes colour between pages.
   */
  const isTransparent = hasHeroBehind && !isScrolled
  const tone = "dark"

  return (
    <header
      ref={headerRef}
      data-slot="site-header"
      // Marks the whole header as a dark surface. globals.css keys the
      // on-dark button treatments and the --gold-ink re-point off this one
      // attribute, so nothing below needs a per-element conditional.
      data-tone={tone}
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b text-white",
        "transition-[background-color,border-color,box-shadow,backdrop-filter] duration-base ease-crownline",
        isTransparent
          ? "border-transparent bg-transparent"
          : cn(
              // Translucent enough that what scrolls beneath reads as depth,
              // opaque enough that the navigation stays legible over a white
              // page. The saturate lifts colour through the blur so the glass
              // does not turn everything behind it grey.
              "border-white/10 bg-night/75 backdrop-blur-xl backdrop-saturate-150",
              "shadow-[0_8px_32px_-12px_oklch(0_0_0/0.55)]"
            )
      )}
    >
      <Container size="wide">
        <nav
          aria-label="Main"
          className="flex h-16 items-center justify-between gap-6 md:h-20"
        >
          {/* The brand: the logo, then the name with its last word in gold. */}
          <Link
            href="/"
            aria-label={`${businessName} — home`}
            className="min-w-0 shrink transition-opacity duration-fast hover:opacity-80"
          >
            <BrandMark tone={tone} layout="lockup" />
          </Link>

          {/* Inline nav starts at xl, not lg: eight items plus a CTA
              measure past 1100px, so at lg they would crush together.
              Below xl the hamburger takes over. */}
          <div className="hidden items-center gap-9 xl:flex 2xl:gap-11">
          <ul className="flex items-center gap-6 2xl:gap-7">
            {headerNavItems.map((item) =>
              isNavGroup(item) ? (
                <li key={item.label}>
                  <ServicesMenu group={item} pathname={pathname} tone={tone} />
                </li>
              ) : (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    label={item.label}
                    active={isLinkActive(pathname, item.href)}
                    available={isNavLinkAvailable(item)}
                    tone={tone}
                  />
                </li>
              )
            )}
          </ul>

          {/* One call to action, grouped with the navigation so it sits a
              short step after Contact rather than out at the far edge. Track
              My Order and Get a Quote live under Services; this button sends a
              visitor to what the business sells. The solid gold fill is
              reserved for exactly this one button, per the brief. */}
          <div className="flex shrink-0 items-center">
            <Link
              href={INVENTORY_CTA.href}
              className={cn(buttonVariants({ variant: "default", size: "default" }), "group/cta gap-1.5")}
            >
              {INVENTORY_CTA.label}
              <ArrowRight
                aria-hidden="true"
                className="size-3.5 transition-transform duration-fast ease-crownline group-hover/cta:translate-x-0.5"
              />
            </Link>
          </div>
          </div>

          {/*
            The menu trigger, below `xl`, at the end of the row — where a thumb
            holding a phone reaches it. The drawer still slides in from the
            left edge, the side the brand sits on, so opening the menu brings
            the site's name and its navigation together.

            The spare-parts basket is not here: it lives in the spare-parts
            section's own bar, beside the parts it holds.

            `-mr-2` pulls the icon button's padding back so the glyph aligns
            with the container gutter instead of sitting 8px inside it.
          */}
          <Button
            variant="ghost"
            size="icon-lg"
            className="-mr-2 shrink-0 text-white xl:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="size-6" />
          </Button>
        </nav>
      </Container>

      <MobileNav
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        whatsappUrl={whatsappUrl}
      />
    </header>
  )
}
