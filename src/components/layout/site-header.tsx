"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, MenuIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { CartSummary } from "@/components/cart/cart-summary"
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

  const isTransparent = hasHeroBehind

  return (
    <header
      ref={headerRef}
      data-slot="site-header"
      // Marks the whole header as a dark surface while it is transparent
      // over the hero. globals.css keys the on-dark button treatments and
      // the --gold-ink re-point off this one attribute, so nothing below
      // needs a per-element conditional.
      data-tone={isTransparent ? "dark" : undefined}
      className={cn(
        "fixed inset-x-0 top-0 z-40",
        "transition-[background-color,border-color,box-shadow,backdrop-filter] duration-base ease-crownline",
        isTransparent
          ? "border-b border-white/10 bg-transparent text-white"
          : cn(
              "border-b border-border bg-background/85 text-foreground",
              "backdrop-blur-xl backdrop-saturate-150",
              isScrolled ? "shadow-[var(--shadow-header)]" : "shadow-none"
            )
      )}
    >
      <Container size="wide">
        <nav
          aria-label="Main"
          className="flex h-16 items-center justify-between gap-6 md:h-20"
        >
          {/*
            The left-hand cluster: the menu trigger, then the brand.

            The hamburger sits at the *start* of the row on every surface that
            has one — which is below `xl`, i.e. every phone and most tablets.
            That is where a drawer anchored to the left edge should be opened
            from: the panel slides out from under its own trigger rather than
            travelling the full width of the screen away from the thumb that
            asked for it. It also leaves the right-hand side to the basket,
            which is the one control on this header whose position customers
            already expect from every other shop they use.

            `-ml-2` pulls the icon button's own padding back so the glyph
            optically aligns with the container gutter instead of sitting an
            extra 8px inside it.
          */}
          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 xl:hidden"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon className="size-5" />
            </Button>

            <Link
              href="/"
              aria-label={`${businessName} — home`}
              className="shrink-0 transition-opacity duration-fast hover:opacity-80"
            >
              <BrandMark tone={isTransparent ? "dark" : "light"} />
            </Link>
          </div>

          {/* Inline nav starts at xl, not lg: eight items plus a CTA
              measure past 1100px, so at lg they would crush together.
              Below xl the hamburger takes over. */}
          <ul className="hidden items-center gap-6 xl:flex 2xl:gap-7">
            {headerNavItems.map((item) =>
              isNavGroup(item) ? (
                <li key={item.label}>
                  <ServicesMenu group={item} pathname={pathname} tone={isTransparent ? "dark" : "light"} />
                </li>
              ) : (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    label={item.label}
                    active={isLinkActive(pathname, item.href)}
                    available={isNavLinkAvailable(item)}
                    tone={isTransparent ? "dark" : "light"}
                  />
                </li>
              )
            )}
          </ul>

          {/* One call to action. Track My Order and Get a Quote live under
              Services in the nav; the header's button sends a visitor to what
              the business sells. The solid gold fill is reserved for exactly
              this one button, per the brief. */}
          <div className="hidden shrink-0 items-center xl:flex">
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

          {/*
            The right-hand cluster: the basket.

            ── Why the basket is in the header at all ──────────────────
            It used to sit in the spare-parts section's own utility bar, which
            meant it existed on two routes and vanished the moment a customer
            wandered onto How It Works. A basket is persistent state, not a
            property of one page, and top-right of the header is where every
            shop a customer has ever used puts it.

            The obvious objection — that a cart glyph on a page about cars
            implies cars go in one — is answered by `CartSummary` itself: it
            renders nothing at all until the basket holds something. A visitor
            who has not added a part never sees it, and one who has is being
            shown their own list on whatever page they wandered to.

            ── Why it sits alone on the right ──────────────────────────
            The menu trigger used to share this cluster, which put navigation
            and the basket in the same corner and left the top-left of a phone
            screen — the corner every drawer-based site puts its menu in —
            empty. The trigger has moved to the start of the row, beside the
            brand and above the edge its panel slides out from, so the basket
            now owns the end of the row on its own. `shrink-0` keeps it there
            whatever the rest of the row is carrying.
          */}
          <div className="flex shrink-0 items-center gap-1 xl:gap-2">
            <CartSummary tone={isTransparent ? "dark" : "light"} />
          </div>
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
