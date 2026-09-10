import type React from "react"

import { CartProvider } from "@/components/cart/cart-provider"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { SkipLink } from "@/components/layout/skip-link"
import { WhatsAppFloatButton } from "@/components/layout/whatsapp-float-button"
import { SiteContactProvider } from "@/components/shared/site-contact-provider"
import { siteConfig } from "@/config/site"
import { getWhatsAppNumber } from "@/lib/queries/settings.queries"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  /**
   * Built here, once, for the header's mobile drawer.
   *
   * SiteHeader is a Client Component — it needs scroll and IntersectionObserver
   * state — so it cannot read BusinessSettings itself. The footer and the
   * floating button are server components and read the number directly; all
   * three go through `getWhatsAppNumber`, which is cached per tag, so this is
   * one database read shared across the request rather than three.
   */
  const whatsappNumber = await getWhatsAppNumber()
  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: whatsappNumber,
    message: buildGeneralWhatsAppMessage(siteConfig.name),
  })

  return (
    /**
     * The spare-parts basket is provided for the whole public site, not just
     * for /spare-parts.
     *
     * It has to outlive a navigation between the catalogue and a part page —
     * a provider mounted inside either segment would be torn down and
     * remounted on every move between them, and the basket would rebuild
     * itself from storage on each one. Here it is mounted once, and the toast
     * it renders can appear over whichever page the customer is on when they
     * add something.
     *
     * The cost is one small client component on pages that never use it. It
     * holds no state until storage is read and renders nothing but an empty
     * live region, which is the price of the basket surviving the one
     * navigation customers make most.
     */
    <SiteContactProvider whatsappNumber={whatsappNumber}>
    <CartProvider>
      <div className="flex flex-1 flex-col">
        {/* First element in the tab order, so keyboard users can jump the
            eight-item nav on every page rather than tabbing through it. */}
        <SkipLink />

        <SiteHeader whatsappUrl={whatsappUrl} />

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
    </CartProvider>
    </SiteContactProvider>
  )
}
