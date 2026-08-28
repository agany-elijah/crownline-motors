import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Container } from "@/components/layout/container"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"

export const metadata = {
  title: "Page not found",
  // A 404 must never be indexed, or it competes with real pages in search
  // results for the very queries the site is trying to rank for.
  robots: { index: false, follow: true },
}

/**
 * Global 404.
 *
 * Lives at the app root rather than inside the (public) route group,
 * because an unmatched URL belongs to no group and so would never reach a
 * group-scoped not-found. It therefore composes the header and footer
 * itself to stay inside the same shell as the rest of the site.
 *
 * Note this is currently a real destination, not a hypothetical one:
 * "Spare Parts" is in the main navigation but its catalogue does not ship
 * until Wave B, so this page is what a visitor gets when they follow it.
 * It is written to be a useful redirect rather than a dead end.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="flex flex-1 items-center pt-16 md:pt-20">
        <Container className="py-20 md:py-32">
          <div className="flex max-w-2xl flex-col gap-6">
            <span className="eyebrow text-gold-ink">Error 404</span>

            <h1 className="text-h1">This page isn&apos;t here</h1>

            <p className="max-w-xl text-body-lg text-muted-foreground">
              The page you&apos;re looking for may have moved, or isn&apos;t available yet. Our
              spare-parts catalogue, for one, is still on its way.
            </p>

            <div className="mt-2 flex flex-wrap gap-3">
              <Link href="/cars" className={buttonVariants({ variant: "default", size: "lg" })}>
                Browse Vehicles
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
                <Link href="/get-a-quote" className="text-foreground underline underline-offset-4 hover:text-gold-ink">
                  Request a vehicle
                </Link>{" "}
                or{" "}
                <Link href="/contact" className="text-foreground underline underline-offset-4 hover:text-gold-ink">
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
  )
}
