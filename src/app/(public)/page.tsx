import type { Metadata } from "next"
import { connection } from "next/server"

import { ShipmentType } from "@/generated/prisma/enums"
import { BrowseCategories, type CategoryTile } from "@/components/home/browse-categories"
import { CompanyIntro } from "@/components/home/company-intro"
import { FeaturedVehicles } from "@/components/home/featured-vehicles"
import { FinalCta } from "@/components/home/final-cta"
import { HomeHero } from "@/components/home/home-hero"
import { HomeFaq, buildHomeFaqs } from "@/components/home/home-faq"
import { ImportDelivery } from "@/components/home/import-delivery"
import { JourneyOverview } from "@/components/home/journey-overview"
import { SparePartsTeaser } from "@/components/home/spare-parts-teaser"
import { WhyCrownline } from "@/components/home/why-crownline"
import { siteConfig } from "@/config/site"
import { VEHICLE_BODY_TYPE_PLURAL_LABELS } from "@/lib/constants/vehicle-options"
import {
  listBodyTypeShowcase,
  listHomepageVehicles,
  listMakeShowcase,
} from "@/lib/queries/public-vehicle.queries"
import {
  listFeaturedSpareParts,
  listPublicSparePartCategories,
} from "@/lib/queries/public-spare-part.queries"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { customerTimelineStages } from "@/lib/settings/tracking-stages"
import { serializeJsonLd } from "@/lib/utils/json-ld"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"
import { catalogueHref } from "@/lib/validations/vehicle-search.schema"

/** Category tiles before the closing "All vehicles" tile — two rows of four. */
const CATEGORY_TILE_LIMIT = 7

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
 * who Crownline is, what is for sale, why buy here, how it works, ways into
 * the stock, the import service and its tracking, spare parts, the company,
 * the questions buyers ask, and a last invitation to ask for the car they
 * did not find.
 *
 * Every product, count, category and make on it is read from the published
 * inventory, and every contact action from Settings, so the page changes when
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

  const [settings, vehicles, bodyTypeGroups, makeGroups, parts, partCategories] =
    await Promise.all([
      getPublicSiteSettings(),
      listHomepageVehicles(),
      listBodyTypeShowcase(),
      listMakeShowcase(),
      listFeaturedSpareParts(),
      listPublicSparePartCategories(),
    ])

  const totalVehicles = makeGroups.reduce((sum, group) => sum + group.count, 0)
  const showQuote = settings.catalogDisplay.actions.getQuote

  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: settings.contact.whatsappNumber,
    message: buildGeneralWhatsAppMessage(settings.businessName),
  })

  // Body types once any listing has one; makes until then.
  const categoryMode = bodyTypeGroups.length > 0 ? "bodyType" : "make"
  const categoryTiles: CategoryTile[] = (
    categoryMode === "bodyType"
      ? bodyTypeGroups.map((group) => ({
          key: group.value,
          label: VEHICLE_BODY_TYPE_PLURAL_LABELS[group.value],
          href: catalogueHref({ bodyType: group.value }),
          count: group.count,
          photoUrl: group.photoUrl,
        }))
      : makeGroups.map((group) => ({
          key: group.value,
          label: group.value,
          href: catalogueHref({ make: group.value }),
          count: group.count,
          photoUrl: group.photoUrl,
        }))
  ).slice(0, CATEGORY_TILE_LIMIT)

  const stageLabels = customerTimelineStages(settings.trackingStages, ShipmentType.VEHICLE, new Set()).map(
    (stage) => stage.label
  )

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
        vehicleCount={totalVehicles}
        makeCount={makeGroups.length}
        showQuote={showQuote}
      />
      <FeaturedVehicles vehicles={vehicles} totalVehicles={totalVehicles} showQuote={showQuote} />
      <WhyCrownline businessName={settings.businessName} />
      <JourneyOverview />
      <BrowseCategories mode={categoryMode} tiles={categoryTiles} totalVehicles={totalVehicles} />
      <ImportDelivery businessName={settings.businessName} stageLabels={stageLabels} />
      <SparePartsTeaser parts={parts} categories={partCategories} />
      <CompanyIntro
        businessName={settings.businessName}
        description={settings.businessDescription}
        address={settings.contact.address}
        hours={settings.hours}
        makes={makeGroups.map((group) => group.value)}
      />
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
