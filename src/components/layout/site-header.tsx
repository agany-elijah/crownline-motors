"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Container } from "@/components/layout/container"
import { BrandMark } from "@/components/layout/brand-mark"
import { MobileNav } from "@/components/layout/mobile-nav"
import { NavLink } from "@/components/layout/nav-link"
import { HERO_ANCHOR_ATTRIBUTE } from "@/components/layout/hero-anchor"
import { isNavLinkAvailable } from "@/lib/constants/nav-links"
import { siteConfig } from "@/config/site"

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

export function SiteHeader() {
  const pathname = usePathname()
  const headerRef = React.useRef<HTMLElement>(null)
  const hasHeroBehind = useHeroBehindHeader(headerRef)
  const isScrolled = useIsScrolled()
  const [mobileOpen, setMobileOpen] = React.useState(false)

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
          <Link
            href="/"
            aria-label={`${siteConfig.name} — home`}
            className="shrink-0 transition-opacity duration-fast hover:opacity-80"
          >
            <BrandMark />
          </Link>

          {/* Inline nav starts at xl, not lg: eight items plus a CTA
              measure past 1100px, so at lg they would crush together.
              Below xl the hamburger takes over. */}
          <ul className="hidden items-center gap-6 xl:flex 2xl:gap-7">
            {siteConfig.nav.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  label={link.label}
                  active={isLinkActive(pathname, link.href)}
                  available={isNavLinkAvailable(link)}
                  tone={isTransparent ? "dark" : "light"}
                />
              </li>
            ))}
          </ul>

          <div className="hidden shrink-0 items-center gap-2.5 xl:flex">
            {/* Secondary action stays outlined — the brief reserves the
                solid gold fill for exactly one button in the header. Its
                dark-surface treatment comes from the [data-tone="dark"]
                rules in globals.css, not from classes threaded through
                here.

                Hidden below 2xl because eight nav items plus two buttons
                genuinely do not fit at 1280px. Tracking is not lost at
                those widths: "Track My Order" remains a main nav item, and
                this button is a shortcut to it, not the only route. */}
            <Link
              href="/track-my-order"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "hidden 2xl:inline-flex"
              )}
            >
              Track Order
            </Link>
            <Link
              href="/get-a-quote"
              className={buttonVariants({ variant: "default", size: "default" })}
            >
              Get a Quote
            </Link>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="size-5" />
          </Button>
        </nav>
      </Container>

      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
    </header>
  )
}
