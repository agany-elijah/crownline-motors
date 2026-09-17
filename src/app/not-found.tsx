import Link from "next/link";

import { CartProvider } from "@/components/cart/cart-provider";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getPublicSiteSettings } from "@/lib/queries/settings.queries";
import {
  buildGeneralWhatsAppMessage,
  buildWhatsAppUrl,
} from "@/lib/utils/whatsapp";

export const metadata = {
  title: "Page not found",
  // A 404 must never be indexed, or it competes with real pages in search
  // results for the very queries the site is trying to rank for.
  robots: { index: false, follow: true },
};

/**
 * Global 404.
 *
 * Lives at the app root rather than inside the (public) route group,
 * because an unmatched URL belongs to no group and so would never reach a
 * group-scoped not-found. It therefore composes the header and footer
 * itself to stay inside the same shell as the rest of the site.
 *
 * It is written to be a useful redirect rather than a dead end: every route
 * in the main navigation now resolves, so anyone landing here has followed a
 * stale link or mistyped an address, and what they need is a way back into
 * the two things the business sells.
 *
 * ── Why the cart provider is here ─────────────────────────────────────
 * The basket is read by the add-to-cart controls and the spare-parts bar,
 * and this page composes the shell itself rather than inheriting the public
 * layout — so it supplies the provider the same way the layout does, and a
 * shortlist survives a detour through a dead link.
 */
export default async function NotFound() {
  // Same reason as the public layout: SiteHeader is a Client Component and
  // the number lives in BusinessSettings, so the link is built here and
  // passed down. This page composes the shell itself, so it has to supply it
  // itself too.
  const settings = await getPublicSiteSettings();
  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: settings.contact.whatsappNumber,
    message: buildGeneralWhatsAppMessage(settings.businessName),
  });

  return (
    <CartProvider>
      <div className="flex flex-1 flex-col">
        <SiteHeader whatsappUrl={whatsappUrl} />

        <main className="flex flex-1 items-center pt-16 md:pt-20">
          <Container className="py-20 md:py-32">
            <div className="flex max-w-2xl flex-col gap-6">
              <span className="eyebrow text-gold-ink">Error 404</span>

              <h1 className="text-h1">This page isn&apos;t here</h1>

              <p className="max-w-xl text-body-lg text-muted-foreground">
                The page you&apos;re looking for may have moved, or the address
                may have been mistyped. Our vehicles and our spare parts are
                both below.
              </p>

              <div className="mt-2 flex flex-wrap gap-3">
                <Link
                  href="/cars"
                  className={buttonVariants({ variant: "default", size: "lg" })}
                >
                  Browse Vehicles
                </Link>
                {/* The parts catalogue is live, so it belongs among the ways
                    out of a 404 rather than in an apology above it. */}
                <Link
                  href="/spare-parts"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  Spare Parts
                </Link>
                <Link
                  href="/track-my-order"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  Track My Order
                </Link>
              </div>

              <div className="mt-6 border-t border-border pt-6">
                <p className="text-small text-muted-foreground">
                  Looking for something specific?{" "}
                  {settings.catalogDisplay.actions.getQuote ? (
                    <>
                      <Link
                        href="/get-a-quote"
                        className="text-foreground underline underline-offset-4 hover:text-gold-ink"
                      >
                        Request a vehicle
                      </Link>{" "}
                      or{" "}
                    </>
                  ) : null}
                  <Link
                    href="/contact"
                    className="text-foreground underline underline-offset-4 hover:text-gold-ink"
                  >
                    contact our team
                  </Link>
                  .
                </p>
              </div>
            </div>
          </Container>
        </main>

        <SiteFooter />
      </div>
    </CartProvider>
  );
}
