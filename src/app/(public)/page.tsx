import type { Metadata } from "next"
import { connection } from "next/server"

import { FeaturedVehicles } from "@/components/home/featured-vehicles"
import { FinalCta } from "@/components/home/final-cta"
import { HomeHero } from "@/components/home/home-hero"
import { HomeFaq, buildHomeFaqs } from "@/components/home/home-faq"
import { JourneyOverview } from "@/components/home/journey-overview"
import { SparePartsTeaser } from "@/components/home/spare-parts-teaser"
import { WhyCrownline } from "@/components/home/why-crownline"
import { siteConfig } from "@/config/site"
import { getInventorySummary, listHomepageVehicles } from "@/lib/queries/public-vehicle.queries"
import {
  listFeaturedSpareParts,
  listPublicSparePartCategories,
} from "@/lib/queries/public-spare-part.queries"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { serializeJsonLd } from "@/lib/utils/json-ld"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

export const metadata: Metadata = {
  // The root layout supplies the configured SEO title and description; the
  // homepage keeps them rather than prefixing its own.
  alternates: { canonical: "/" },
}

/**
 * The homepage.
 *
 * Built around three things a visitor comes to do — browse vehicles, ask for
 * a quote, understand how importing works — in the order the brief sets out:
 * who Crownline is, the vehicles the dealership has chosen to feature, why
 * buy here, how importing works, spare parts, the questions buyers ask, and a
 * last invitation to ask for the car they did not find.
 *
 * Every product and count on it is read from the published inventory and
 * the dashboard's "Feature on the homepage" switches, and every contact
 * action from Settings, so the page changes when
 * the business does without anyone editing it.
 */
export default async function HomePage() {
  /**
   * Rendered per request, like the catalogue and every listing page.
   *
   * A prerendered homepage would be a snapshot of the inventory at build time,
   * and the listings on it change from places that do not revalidate `/` — an
   * order completing marks its car sold, a cancellation puts it back on sale.
   * The reads are a handful of small, indexed queries, and the settings among
   * them are already cached under their tag.
   */
  await connection()

  const [settings, vehicles, inventory, parts, partCategories] = await Promise.all([
    getPublicSiteSettings(),
    listHomepageVehicles(),
    getInventorySummary(),
    listFeaturedSpareParts(),
    listPublicSparePartCategories(),
  ])

  const showQuote = settings.catalogDisplay.actions.getQuote

  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: settings.contact.whatsappNumber,
    message: buildGeneralWhatsAppMessage(settings.businessName),
  })

  return (
    /*
      The homepage is a dark showroom from top to bottom. `dark` re-points the
      theme tokens for everything inside, so shared components — vehicle
      cards, spare-part cards, the tracking form, buttons — render in their
      dark treatment without a variant of their own.
    */
    <div className="dark bg-background text-foreground">
      <HomeJsonLd settings={settings} />

      <HomeHero
        businessName={settings.businessName}
        vehicleCount={inventory.vehicleCount}
        makeCount={inventory.makeCount}
        showQuote={showQuote}
      />
      <FeaturedVehicles vehicles={vehicles} totalVehicles={inventory.vehicleCount} />
      <WhyCrownline businessName={settings.businessName} />
      <JourneyOverview />
      <SparePartsTeaser parts={parts} categories={partCategories} />
      <HomeFaq
        faqs={buildHomeFaqs({ businessName: settings.businessName, paymentSchedule: settings.paymentSchedule })}
      />
      <FinalCta whatsappUrl={whatsappUrl} showQuote={showQuote} />
    </div>
  )
}

/**
 * The dealership as structured data, for search results (brief §18).
 *
 * Only facts that are configured are emitted — an empty telephone or address
 * would be worse for the listing than none.
 */
function HomeJsonLd({ settings }: { settings: Awaited<ReturnType<typeof getPublicSiteSettings>> }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: settings.businessName,
    description: settings.businessDescription,
    url: siteConfig.url,
    areaServed: { "@type": "Country", name: "South Sudan" },
    ...(settings.contact.phone ? { telephone: settings.contact.phone } : {}),
    ...(settings.contact.email ? { email: settings.contact.email } : {}),
    ...(settings.contact.address ? { address: settings.contact.address } : {}),
    ...(settings.branding.logoLightUrl ? { logo: settings.branding.logoLightUrl } : {}),
    ...(settings.social.length > 0 ? { sameAs: settings.social.map((link) => link.url) } : {}),
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
