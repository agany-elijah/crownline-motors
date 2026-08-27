"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Container } from "@/components/layout/container"
import { MobileNav } from "@/components/layout/mobile-nav"
import { siteConfig } from "@/config/site"

/** Scroll distance (px) after which the header switches from its
 *  transparent hero variant to the solid, blurred variant. */
const SCROLL_THRESHOLD_PX = 8

function useIsScrolled(threshold: number) {
  const [isScrolled, setIsScrolled] = React.useState(false)

  React.useEffect(() => {
    let ticking = false

    function handleScroll() {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > threshold)
        ticking = false
      })
    }

    // Correct state immediately in case the page loaded already scrolled
    // (anchor link, back/forward cache) rather than waiting on the first
    // scroll event.
    handleScroll()

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [threshold])

  return isScrolled
}

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SiteHeader() {
  const pathname = usePathname()
  const isScrolled = useIsScrolled(SCROLL_THRESHOLD_PX)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Transparent-over-hero only makes sense on the homepage — the only page
  // designed with a full-bleed dark hero directly beneath the header.
  // Every other page starts with light content, so a transparent header
  // there would break text contrast; those pages get the solid variant
  // immediately.
  const isHome = pathname === "/"
  const isTransparent = isHome && !isScrolled

  return (
    <header
      data-slot="site-header"
      data-transparent={isTransparent ? "" : undefined}
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-[var(--duration-base)] ease-[var(--ease-crownline)]",
        isTransparent
          ? "border-b border-background/10 bg-transparent text-background"
          : "border-b border-border bg-background/95 text-foreground shadow-sm backdrop-blur-md"
      )}
    >
      <Container size="wide">
        <nav aria-label="Main" className="flex h-16 items-center justify-between gap-4 md:h-18">
          <Link href="/" className="font-heading text-lg font-semibold tracking-wide">
            {siteConfig.shortName.toUpperCase()}
          </Link>

          <ul className="hidden items-center gap-6 lg:flex">
            {siteConfig.nav.map((link) => {
              const active = isLinkActive(pathname, link.href)

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "border-b-2 border-transparent pb-1 text-sm font-medium transition-colors duration-[var(--duration-fast)]",
                      active
                        ? "border-gold text-gold"
                        : isTransparent
                          ? "text-background/85 hover:text-background"
                          : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="hidden items-center gap-2 lg:flex">
            {/* Secondary action — ghost/outline per the brief's rule that
                solid gold is reserved for exactly one CTA in the header. */}
            <Link
              href="/track-my-order"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                isTransparent &&
                  "border-background/40 bg-transparent text-background hover:bg-background/10"
              )}
            >
              Track My Order
            </Link>
            {/* The single gold CTA in the header. */}
            <Link href="/get-a-quote" className={buttonVariants({ variant: "default", size: "sm" })}>
              Get a Quote
            </Link>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className={cn("lg:hidden", isTransparent && "text-background hover:bg-background/10")}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <XIcon /> : <MenuIcon />}
          </Button>
        </nav>
      </Container>

      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
    </header>
  )
}