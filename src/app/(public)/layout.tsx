import type React from "react"

import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { WhatsAppFloatButton } from "@/components/layout/whatsapp-float-button"

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      {/*
        Reserves space equal to SiteHeader's height (h-16 / md:h-18) so
        content never renders underneath the fixed header. The homepage
        hero is the one deliberate exception: it sits under the header's
        transparent variant by canceling this padding with a matching
        negative top margin (e.g. `-mt-16 md:-mt-18`) on its own full-bleed
        hero section. Every other page should render normally within this
        padded flow — do not repeat the negative-margin trick elsewhere.
      */}
      <main className="flex-1 pt-16 md:pt-18">{children}</main>
      <SiteFooter />
      <WhatsAppFloatButton />
    </div>
  )
}