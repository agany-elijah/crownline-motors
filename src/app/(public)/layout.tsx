import type React from "react"

import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { SkipLink } from "@/components/layout/skip-link"
import { WhatsAppFloatButton } from "@/components/layout/whatsapp-float-button"

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex flex-1 flex-col">
      {/* First element in the tab order, so keyboard users can jump the
          eight-item nav on every page rather than tabbing through it. */}
      <SkipLink />

      <SiteHeader />

      {/*
        The padding reserves space equal to SiteHeader's height (h-16 /
        md:h-20) so content never renders underneath the fixed header.

        The homepage hero is the one deliberate exception: it sits beneath
        the header's transparent variant by cancelling this padding with a
        matching negative top margin (`-mt-16 md:-mt-20`) on its own
        full-bleed section. Every other page renders normally inside this
        padded flow — do not repeat that trick elsewhere, or the header
        will overlap real content.

        `id` is the skip link's target; `tabIndex={-1}` makes the element
        programmatically focusable so the skip actually moves focus rather
        than only moving the scroll position.
      */}
      <main id="main-content" tabIndex={-1} className="flex-1 pt-16 outline-none md:pt-20">
        {children}
      </main>

      <SiteFooter />
      <WhatsAppFloatButton />
    </div>
  )
}
