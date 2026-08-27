"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Full-height slide-in navigation drawer for small screens.
 *
 * Built directly on the Base UI Dialog primitive — the same primitive
 * `components/ui/dialog.tsx` wraps — rather than reusing that component,
 * because a nav drawer needs a full-height edge panel, not the centered
 * confirmation-style modal `DialogContent` is styled for.
 *
 * Base UI's Dialog handles the accessibility-sensitive parts: focus
 * trapping while open, returning focus to the trigger on close, closing on
 * Escape, and locking background scroll. None of that is reimplemented
 * here — reimplementing focus management by hand is exactly the kind of
 * thing that quietly breaks keyboard/screen-reader access.
 */
export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname()

  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: siteConfig.whatsappNumber,
    message: buildGeneralWhatsAppMessage(siteConfig.name),
  })

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-sm",
            "duration-[var(--duration-fast)] data-open:animate-in data-open:fade-in-0",
            "data-closed:animate-out data-closed:fade-out-0"
          )}
        />
        <DialogPrimitive.Popup
          id="mobile-nav-panel"
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-xs flex-col",
            "bg-background text-foreground shadow-xl outline-none",
            "duration-[var(--duration-base)] ease-[var(--ease-crownline)]",
            "data-open:animate-in data-open:slide-in-from-right-full",
            "data-closed:animate-out data-closed:slide-out-to-right-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <DialogPrimitive.Title className="font-heading text-base font-semibold tracking-wide">
              {siteConfig.shortName.toUpperCase()}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Site navigation menu
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              aria-label="Close menu"
            >
              <XIcon />
            </DialogPrimitive.Close>
          </div>

          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-6">
            <ul className="flex flex-col gap-1">
              {siteConfig.nav.map((link) => {
                const active = isLinkActive(pathname, link.href)

                return (
                  <li key={link.href}>
                    <DialogPrimitive.Close
                      render={<Link href={link.href} aria-current={active ? "page" : undefined} />}
                      className={cn(
                        "block rounded-md px-2 py-2.5 text-base font-medium transition-colors",
                        active ? "text-gold" : "text-foreground hover:bg-muted"
                      )}
                    >
                      {link.label}
                    </DialogPrimitive.Close>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="flex flex-col gap-2 border-t border-border px-4 py-4">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
              >
                WhatsApp Us
              </a>
            )}
            <DialogPrimitive.Close
              render={<Link href="/get-a-quote" />}
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "w-full")}
            >
              Get a Quote
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}