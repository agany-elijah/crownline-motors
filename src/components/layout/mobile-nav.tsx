"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { ArrowUpRightIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { BrandMark } from "@/components/layout/brand-mark"
import { isNavLinkAvailable } from "@/lib/constants/nav-links"
import { siteConfig } from "@/config/site"

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * The pre-built wa.me link, or null when no number is configured.
   *
   * Passed in rather than built here. The number lives in BusinessSettings
   * so an operator can change it without a deploy, and reading the database
   * is a server concern — this drawer is a Client Component and could only
   * have got the value from a NEXT_PUBLIC_ env var, which is exactly the
   * hard-coding the brief asks us to avoid. The chain is:
   * layout (server) → SiteHeader → here.
   */
  whatsappUrl: string | null
}

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Full-height slide-in navigation drawer for everything below the xl
 * breakpoint.
 *
 * Built directly on the Base UI Dialog primitive — the same primitive
 * `components/ui/dialog.tsx` wraps — rather than reusing that component,
 * because a nav drawer needs a full-height edge panel, not the centred
 * confirmation-style modal DialogContent is styled for.
 *
 * Base UI handles the accessibility-critical parts: focus trapping while
 * open, restoring focus to the trigger on close, Escape to dismiss, and
 * locking background scroll. None of that is reimplemented here —
 * hand-rolled focus management is exactly the kind of thing that quietly
 * breaks keyboard and screen-reader access.
 *
 * The panel takes the dark surface rather than the page background: it
 * reads as a deliberate piece of the brand on a phone, where this drawer
 * is the primary way most customers will navigate the site.
 */
export function MobileNav({ open, onOpenChange, whatsappUrl }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-charcoal/50 backdrop-blur-sm",
            "duration-fast data-open:animate-in data-open:fade-in-0",
            "data-closed:animate-out data-closed:fade-out-0"
          )}
        />
        <DialogPrimitive.Popup
          id="mobile-nav-panel"
          data-tone="dark"
          className={cn(
            // Anchored to the left edge, directly under the menu trigger,
            // and it enters from there.
            //
            // ── Why it no longer fills the screen ──────────────────────
            // It was `w-full max-w-sm`, which on any phone narrower than
            // 384px — most of them — meant a panel covering the display
            // edge to edge. A drawer that takes the whole screen is
            // indistinguishable from a page navigation: the page the
            // customer was reading disappears, so opening the menu to check
            // something and closing it again feels like a round trip rather
            // than a glance.
            //
            // Leaving roughly a third of the page visible behind the
            // backdrop keeps it legible as a panel *over* the page, and
            // gives a thumb somewhere to press to dismiss it that is not the
            // close button.
            //
            // The floor matters as much as the ceiling: `min-w-64` (256px)
            // is what the longest entry needs — "Track My Order" at the
            // drawer's type size, plus the left rail, the trailing arrow and
            // the "Soon" marker an unavailable link can carry. Below that
            // the labels start wrapping. 70% of a 360px phone is 252px, so
            // without the floor the smallest phones would be exactly the
            // ones that broke.
            "fixed inset-y-0 left-0 z-50 flex h-full w-[70%] min-w-64 max-w-xs flex-col",
            "bg-foreground text-background outline-none",
            "shadow-[0_0_60px_oklch(0_0_0/0.4)]",
            "duration-base ease-crownline",
            "data-open:animate-in data-open:slide-in-from-left-full",
            "data-closed:animate-out data-closed:slide-out-to-left-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
            <DialogPrimitive.Title render={<BrandMark size="sm" />} />
            <DialogPrimitive.Description className="sr-only">
              Site navigation
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              aria-label="Close menu"
              className="flex size-9 items-center justify-center rounded-lg text-background/70 transition-colors duration-fast hover:bg-white/10 hover:text-background"
            >
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-5 py-6">
            <ul className="flex flex-col">
              {siteConfig.nav.map((link, index) => {
                const active = isLinkActive(pathname, link.href)
                const entranceDelay = { animationDelay: `${60 + index * 35}ms` }

                // Not yet routable — shown as plain text with a "Soon"
                // marker rather than a link into a 404. Same reasoning as
                // the desktop NavLink; see nav-links.ts.
                if (!isNavLinkAvailable(link)) {
                  return (
                    <li key={link.href}>
                      <span
                        style={entranceDelay}
                        className={cn(
                          "flex items-center justify-between gap-4",
                          "border-b border-white/5 py-4 pl-4",
                          "font-heading text-lg font-semibold tracking-tight text-background/35",
                          "animate-in fade-in-0 slide-in-from-left-4 fill-mode-backwards"
                        )}
                      >
                        {link.label}
                        <span className="rounded-4xl border border-white/20 px-2 py-0.5 text-[0.625rem] font-semibold tracking-[0.08em] text-background/50 uppercase">
                          Soon
                        </span>
                      </span>
                    </li>
                  )
                }

                return (
                  <li key={link.href}>
                    {/*
                      A plain Link that closes the drawer on click, rather
                      than a Dialog.Close rendering a Link. These items
                      navigate, so they must keep link semantics — screen
                      readers should announce "link", and cmd/ctrl-click
                      and "open in new tab" must keep working. Routing a
                      Link through Dialog.Close gives it button semantics
                      and loses all of that.
                    */}
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => onOpenChange(false)}
                      style={entranceDelay}
                      className={cn(
                        "group/item relative flex items-center justify-between gap-4",
                        "border-b border-white/5 py-4 pl-4",
                        "font-heading text-lg font-semibold tracking-tight",
                        "transition-colors duration-fast ease-crownline",
                        // Gold edge marker that grows out from the left rail.
                        // The desktop nav answers a hover with a gold rule
                        // underneath the label; on a stacked drawer the
                        // equivalent gesture runs down the side, so the two
                        // read as the same idea at two orientations rather
                        // than as two unrelated effects.
                        "before:absolute before:top-1/2 before:left-0 before:w-0.5",
                        "before:-translate-y-1/2 before:rounded-full before:bg-gold",
                        "before:transition-[height] before:duration-fast before:ease-crownline",
                        active ? "before:h-7" : "before:h-0 hover:before:h-7",
                        // Staggered entrance. The global reduced-motion
                        // rule collapses these to ~0ms, so the delays
                        // above never strand content for anyone who has
                        // asked for less movement.
                        "animate-in fade-in-0 slide-in-from-left-4 fill-mode-backwards",
                        active ? "text-gold" : "text-background/80 hover:text-background"
                      )}
                    >
                      <span className="transition-transform duration-fast ease-crownline group-hover/item:translate-x-1">
                        {link.label}
                      </span>
                      <ArrowUpRightIcon
                        aria-hidden="true"
                        className={cn(
                          "size-4 transition-all duration-fast ease-crownline",
                          active
                            ? "text-gold opacity-100"
                            : "opacity-0 group-hover/item:translate-x-0.5 group-hover/item:text-gold group-hover/item:opacity-100"
                        )}
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="flex flex-col gap-2.5 border-t border-white/10 px-5 py-5">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onOpenChange(false)}
                /**
                 * The two markers the dark-surface rules in globals.css
                 * actually key off.
                 *
                 * They are set by hand here because this is a plain anchor
                 * styled with `buttonVariants`, not the `Button` component
                 * — which is deliberate, for the link-semantics reason
                 * given on the nav items above, but it means the
                 * attributes `Button` would have emitted have to be
                 * supplied. Without them the selector
                 * `[data-tone="dark"] [data-slot="button"][data-variant="outline"]`
                 * does not match, and this button fell back to the light
                 * treatment: a warm-white fill sitting on the drawer's
                 * black panel.
                 */
                data-slot="button"
                data-variant="outline"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
              >
                WhatsApp Us
              </a>
            )}
            {/* Same reasoning as the nav items above — a link, styled as a
                button, that also dismisses the drawer. */}
            <Link
              href="/get-a-quote"
              onClick={() => onOpenChange(false)}
              // Same markers, for the same reason. The gold fill needs no
              // dark-surface override, but tagging only one of the two
              // buttons is how the next person concludes the attributes
              // are optional.
              data-slot="button"
              data-variant="default"
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "w-full")}
            >
              Get a Quote
            </Link>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
