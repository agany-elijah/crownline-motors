import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Section } from "@/components/layout/section"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { Button } from "@/components/ui/button"
import { AddToCart } from "@/components/spare-parts/add-to-cart"
import {
  RecentlyViewedParts,
  RecordRecentlyViewed,
} from "@/components/spare-parts/recently-viewed-parts"
import { RelatedSpareParts } from "@/components/spare-parts/related-spare-parts"
import { SparePartAvailabilityTag } from "@/components/spare-parts/spare-part-availability-tag"
import { SparePartDeliverySteps } from "@/components/spare-parts/spare-part-delivery-steps"
import { SparePartGallery } from "@/components/spare-parts/spare-part-gallery"
import { SparePartMobileActionBar } from "@/components/spare-parts/spare-part-mobile-action-bar"
import { SparePartsBar } from "@/components/spare-parts/spare-parts-bar"
import {
  PriceEstimateNote,
  PriceEstimateTag,
  SparePartPrice,
} from "@/components/spare-parts/spare-part-price"
import { siteConfig } from "@/config/site"
import {
  getPublishedSparePartBySlug,
  listRelatedSpareParts,
  type PublicSparePartDetail,
} from "@/lib/queries/public-spare-part.queries"
import {
  getSparePartDeliverySteps,
  getPublicSiteSettings,
} from "@/lib/queries/settings.queries"
import { getPublishedSparePartStock } from "@/lib/queries/public-spare-part-stock.queries"
import { serializeJsonLd } from "@/lib/utils/json-ld"
import { buildSparePartWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

/**
 * A single spare part.
 *
 * ── Visibility ────────────────────────────────────────────────────────
 * `getPublishedSparePartBySlug` looks the slug up *with* the PUBLISHED clause
 * rather than by unique key, so a draft or an archived part is
 * indistinguishable from a slug that never existed — this page cannot leak
 * one by forgetting to check, because there is nothing here to remember. The
 * query is `cache()`d, so `generateMetadata` and the page body share a single
 * database round trip.
 *
 * ── Shape of the page ─────────────────────────────────────────────────
 *
 *     ← Back to spare parts                          [ 🛒 3 ]
 *     ───────────────────────────────────────────────────────
 *                      │  brand · category
 *                      │  Front brake pad set
 *       gallery        │  04465-48150
 *       (sticky)       │  $120 est.
 *                      │  fits …
 *                      │  [ add to cart ] [ whatsapp ]
 *                      │  ─────────────────────────────
 *                      │  about this part
 *     ───────────────────────────────────────────────────────
 *     you may also like
 *
 * The gallery sits beside the decision rather than above it, which is the
 * opposite of the vehicle page — and deliberately. A car is bought on how it
 * looks and the photograph deserves the full measure; a part is bought on
 * whether it fits, and the fitment list has to be visible at the same moment
 * as the photograph confirming it is the right shape.
 *
 * ── Why the description is in that column and not its own band ────────
 * It used to be a full-width section of its own below the fold, and that put
 * the two halves of one answer — what the part looks like, and what it is —
 * a scroll apart. Reading the description then meant scrolling back up to
 * check it against the photograph, on a phone, repeatedly. Keeping it in the
 * decision column means the gallery is still on screen while it is read; the
 * gallery is `sticky` from `lg` for exactly that reason, so a long
 * description scrolls past a photograph that stays put.
 *
 * ── What this page does not show ──────────────────────────────────────
 * Condition, country of origin, stock, whether the price is fixed or quoted,
 * and anything about sourcing — at the dealership's instruction. The DTO does
 * not carry any of them, so there is nothing here to render by accident.
 *
 * Our own `CLM-SP-…` listing reference is not shown either, at the same
 * instruction: a customer identifies a part by the manufacturer's number
 * stamped on the one they are replacing, and a second internal-looking code
 * beside it is noise. It is still what the WhatsApp message quotes, because
 * an OEM number legitimately appears on several listings and the operator
 * receiving that message has to be able to open exactly one.
 */

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const part = await getPublishedSparePartBySlug(slug)

  if (!part) {
    // A withdrawn listing must not keep advertising itself in search results,
    // and `notFound()` cannot be called from here.
    return { title: "Part not found", robots: { index: false, follow: false } }
  }

  /**
   * Written for the searches the brief names — "Toyota spare parts South
   * Sudan", "Toyota parts Juba" — while staying a truthful sentence about
   * this part. A description assembled purely from keywords reads as spam to
   * a person and is treated as such by a search engine.
   */
  const fits =
    part.fitment.length > 0 ? ` Fits ${part.fitment.slice(0, 2).join(", ")}.` : ""

  const description = `${part.name} for sale in South Sudan.${fits} Imported from Japan and Korea and delivered to Juba. Reference ${part.referenceNumber}.`

  const cover = part.photos[0]

  return {
    title: part.name,
    description,
    alternates: { canonical: `/spare-parts/${part.slug}` },
    openGraph: {
      title: `${part.name} | ${(await getPublicSiteSettings()).siteTitle}`,
      description,
      url: `${siteConfig.url}/spare-parts/${part.slug}`,
      type: "website",
      images: cover ? [{ url: cover.url, alt: part.name }] : undefined,
    },
  }
}

export default async function SparePartPage({ params }: PageProps) {
  const { slug } = await params
  const part = await getPublishedSparePartBySlug(slug)

  if (!part) notFound()

  /**
   * Both reads are independent of each other, so they are issued together
   * rather than one after the other — a page that already waits on the part
   * lookup should not then wait on two more round trips in series.
   *
   * `getWhatsAppNumber`, not `getBusinessSettings`: that one upserts the
   * singleton row, which is right for the admin screen and wrong on a page
   * anonymous traffic loads. It also already applies the env fallback.
   */
  const [siteSettings, relatedParts, deliverySteps] = await Promise.all([
    getPublicSiteSettings(),
    listRelatedSpareParts({ excludeSlug: part.slug }),
    // Cached under the business-settings tag, so this is not a database round
    // trip on most requests — and an operator's edit still appears
    // immediately rather than at the next deploy.
    getSparePartDeliverySteps(),
  ])

  // Units in hand for this part and the strip — empty unless Settings
  // publishes counts and neither listing has hidden its own.
  const stock = await getPublishedSparePartStock([part.slug, ...relatedParts.map((related) => related.slug)])
  const stockQuantity = stock[part.slug]

  /**
   * Built once and handed to both Add controls — the one in the action row
   * and the one in the pinned mobile bar. Two literals would be two places to
   * forget a field, and a basket line that disagreed with itself depending on
   * which button the customer pressed.
   */
  const cartItem = {
    slug: part.slug,
    name: part.name,
    referenceNumber: part.referenceNumber,
    price: part.price,
    imageUrl: part.photos[0]?.url ?? null,
  }

  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: siteSettings.contact.whatsappNumber,
    message: buildSparePartWhatsAppMessage({
      siteName: siteSettings.businessName,
      partName: part.name,
      // Our own reference, not the manufacturer's. It is the one identifier
      // guaranteed to name exactly this listing — an OEM number legitimately
      // appears on several — so it is what an operator can look up.
      partNumber: part.referenceNumber,
    }),
  })

  return (
    <>
      {/* ── The one utility row ────────────────────────────────────
          The same bar the catalogue carries, so the basket and the way back
          are in the same place on every page of the section. */}
      <SparePartsBar backHref="/spare-parts" backLabel="Back to spare parts" />

      {/*
        The trail, rendered for machines only — the visible way back is the
        bar above. `Breadcrumbs` emits its BreadcrumbList JSON-LD as a sibling
        of the nav, so hiding the nav keeps the structured data that puts a
        trail under this page's search result.
      */}
      <Breadcrumbs
        items={[
          { label: "Spare Parts", href: "/spare-parts" },
          { label: part.name },
        ]}
        className="hidden"
      />

      <Section spacing="compact" className="pb-4">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-14">
          {/* ── Gallery ──────────────────────────────────────────
              Sticky from `lg`, so the description in the column beside it
              scrolls past a photograph that stays on screen. `top-24` clears
              the fixed header (5rem) with a rem of air. */}
          <div className="lg:sticky lg:top-24 lg:w-[46%] lg:shrink-0">
            <SparePartGallery photos={part.photos} partName={part.name} />
          </div>

          {/* ── The decision, and everything it needs ───────────── */}
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h1 className="text-h1">{part.name}</h1>

              {/*
                ── Who made it, what it is filed under, and its number ──
                A labelled list rather than the gold eyebrow that used to sit
                above the name.

                The eyebrow read "DENSO · Brakes" in gold at the top of the
                page, which made the *brand* the first thing seen on a page
                about a specific part, and left "Brakes" looking like part of
                the brand's name. Naming each value — "By:", "Category:" —
                costs one word and removes the guess. It also moves the brand
                below the name, which is the order a customer actually reads
                in: what is this, then who made it.

                A description list, because that is exactly what this is: a
                set of term/value pairs. A screen reader announces "By: Denso"
                as one associated pair; three loose spans would be six
                unrelated fragments.
              */}
              <dl className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-small">
                {part.brand ? (
                  <div className="flex items-center gap-1.5">
                    <dt className="text-muted-foreground">By:</dt>
                    <dd className="font-semibold text-foreground">{part.brand}</dd>
                  </div>
                ) : null}

                {part.categoryName && part.categorySlug ? (
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">Category:</dt>
                  <dd className="font-medium text-foreground">
                    {/* Linked, because it is the one value here a customer
                        might want to act on — "show me the rest of the
                        brakes" is a real next step from a part that turned
                        out to be the wrong one. */}
                    <Link
                      href={`/spare-parts?category=${part.categorySlug}`}
                      className="underline-offset-4 transition-colors duration-fast hover:text-gold-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {part.categoryName}
                    </Link>
                  </dd>
                </div>
                ) : null}

                {/*
                  The manufacturer's number, and only that. It is what a
                  customer reads off the old part and matches against; our own
                  `CLM-SP-…` reference is deliberately not printed beside it
                  (see the page note).
                */}
                {part.oemPartNumber ? (
                  <div className="flex items-center gap-1.5">
                    <dt className="text-muted-foreground">Part no:</dt>
                    <dd className="font-mono font-medium text-foreground">
                      {part.oemPartNumber}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="flex flex-col gap-2">
              {/*
                The price and what the customer can expect to happen next, on
                one line. They are the two halves of "can I have this, and for
                how much" — separating them would put the availability below
                the fold on a phone, which is where it stops being read.
              */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <SparePartPrice price={part.price} size="detail" />
                {/* Only where there is a figure to qualify. "Price on enquiry"
                    is already its own answer and needs no caution beside it. */}
                {part.price !== null ? <PriceEstimateTag /> : null}
                {part.availability ? (
                  <SparePartAvailabilityTag availability={part.availability} size="detail" />
                ) : null}
                {stockQuantity ? (
                  <span className="tabular text-small text-muted-foreground">{stockQuantity} in stock</span>
                ) : null}
              </div>
              {part.price !== null ? (
                <PriceEstimateNote className="max-w-md" />
              ) : null}
            </div>

            {/* ── Fitment ──────────────────────────────────────────
                Above the buy control on purpose: it is the question a
                parts buyer answers before the price, and burying it below
                the fold would mean someone can add a part to their list
                without ever having seen what it fits. */}
            {part.fitment.length > 0 ? (
              <section
                aria-labelledby="fitment-heading"
                className="flex flex-col gap-2.5 rounded-[4px] border border-border bg-card p-4 sm:p-5"
              >
                <h2 id="fitment-heading" className="eyebrow text-muted-foreground">
                  Fits these vehicles
                </h2>
                <ul className="flex flex-wrap gap-1.5">
                  {part.fitment.map((line) => (
                    <li
                      key={line}
                      className="rounded-[4px] border border-border bg-secondary px-2.5 py-1 text-small text-secondary-foreground"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
                {/*
                  Said plainly rather than implied. Fitment here is matched
                  exactly on make, model, year and engine (see
                  spare-part-compatibility.ts) — deliberately strict,
                  because a false positive costs a customer an import of a
                  part that does not fit. Inviting the check is how that
                  strictness stays helpful rather than merely narrow.
                */}
                <p className="text-small text-muted-foreground">
                  Not sure it matches your car? Send us your chassis number on
                  WhatsApp and we will confirm before you order.
                </p>
              </section>
            ) : null}

            {/* ── The two ways to act ─────────────────────────────
                Side by side from `sm`, stacked on a phone. They are genuine
                alternatives rather than a primary and an afterthought: some
                customers shortlist and some want to talk to a person, and in
                this market the second is at least as common as the first. */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <AddToCart item={cartItem} label={part.name} />

              {whatsappUrl ? (
                /**
                 * WhatsApp's own green, filled — not an outlined "lesser"
                 * button. The brief is explicit that WhatsApp is how this
                 * business actually talks to customers, and for a customer
                 * unsure whether a part fits their car it is the *more*
                 * useful of the two controls on this row. Green rather than
                 * gold because gold is Crownline's accent and is already
                 * spent on Add to cart beside it.
                 *
                 * The shared `whatsapp` variant, rather than classes written
                 * here: this used to paint white on `#25D366`, which fails
                 * WCAG contrast for a label this size. See the variant's note
                 * in ui/button.tsx.
                 */
                <Button
                  render={
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      // `noopener` is the security-relevant half — without
                      // it the opened tab can reach back through
                      // `window.opener`.
                      rel="noopener noreferrer"
                    />
                  }
                  variant="whatsapp"
                  size="lg"
                  className="w-full sm:w-auto sm:flex-1"
                >
                  <WhatsAppGlyph />
                  WhatsApp about this part
                </Button>
              ) : null}
            </div>

            {/* ── The part a fitment list cannot say ──────────────
                In this column rather than in a band of its own below, so the
                gallery is still on screen while it is read. */}
            {part.description ? (
            <section
              aria-labelledby="description-heading"
              className="flex flex-col gap-3 border-t border-border pt-6"
            >
              <h2 id="description-heading" className="text-h3">
                About this part
              </h2>
              {/*
                `whitespace-pre-line` so the paragraph breaks an operator typed
                in the dashboard survive to the page. The value is interpolated
                as text, never as HTML, so nothing in a description can inject
                markup.
              */}
              <p className="text-body whitespace-pre-line text-muted-foreground">
                {part.description}
              </p>
            </section>
            ) : null}

            {/* ── How it gets here ────────────────────────────────
                Last in the column, because it is reassurance rather than
                information about the part — someone still deciding whether
                this is the right component has not reached the question it
                answers. Renders nothing when an operator has deliberately
                cleared the steps in Settings. */}
            <SparePartDeliverySteps steps={deliverySteps} />
          </div>
        </div>
      </Section>

      {/* Renders nothing when the category holds only this part. Its own
          section supplies the reveal, so it is not wrapped in another one —
          a nested Reveal would animate an empty div on exactly the listings
          that have no strip to show. */}
      <RelatedSpareParts parts={relatedParts} categoryName={part.categoryName} stock={stock} />

      {/*
        The customer's own trail back, below the suggestions.

        That order is deliberate: the strip above is the business suggesting
        something, this is the customer returning to something they were
        already comparing. It renders nothing on a first visit and nothing
        when the only thing it holds is the part being read.

        The history lives in this browser and never reaches us, so this costs
        no query — see `recently-viewed-storage.ts`.
      */}
      <RecentlyViewedParts excludeSlug={part.slug} />

      {/*
        Records this visit. Renders nothing, and must come after the strip so
        the part being read is added to the history *behind* the row that
        excludes it, rather than appearing in it for a frame.
      */}
      <RecordRecentlyViewed
        slug={part.slug}
        name={part.name}
        price={part.price}
        imageUrl={part.photos[0]?.url ?? null}
      />

      <SparePartStructuredData part={part} sellerName={siteSettings.businessName} />

      {/*
        The pinned phone action, last in the tree and outside every Section so
        nothing above can establish a stacking context it would be trapped in.
        Hidden from `lg`, where the gallery column keeps the in-page Add
        control on screen on its own.
      */}
      <SparePartMobileActionBar item={cartItem} label={part.name} />
    </>
  )
}

/**
 * Structured data for the listing.
 *
 * A `Product` with an `Offer`, which is what lets a search engine show the
 * price against the result — the brief asks for individually indexable part
 * pages, and this is the difference between being indexed and being
 * understood.
 *
 * Only fields the database actually holds are emitted. Padding this with a
 * made-up rating or review count is misrepresentation in a machine-readable
 * format, which search engines penalise and which would be a lie about a real
 * business.
 *
 * ── Two deliberate omissions ──────────────────────────────────────────
 * `availability` is absent. schema.org's vocabulary here is `InStock` /
 * `OutOfStock`, and the catalogue does not publish stock levels — emitting
 * either would put a claim in front of a crawler that the page itself does
 * not make.
 *
 * A part priced on enquiry emits no `offers` block at all rather than a price
 * of zero, which a search engine would happily render as "$0.00".
 *
 * Serialised through `serializeJsonLd`, which escapes everything that could
 * close the script element early. Every value here is operator-entered, but
 * a part name containing `</script>` would otherwise break out of it.
 */
function SparePartStructuredData({ part, sellerName }: { part: PublicSparePartDetail; sellerName: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: part.name,
    ...(part.description ? { description: part.description } : {}),
    sku: part.referenceNumber,
    ...(part.oemPartNumber ? { mpn: part.oemPartNumber } : {}),
    ...(part.brand ? { brand: { "@type": "Brand", name: part.brand } } : {}),
    ...(part.categoryName ? { category: part.categoryName } : {}),
    image: part.photos.map((photo) => photo.url),
    ...(part.price === null
      ? {}
      : {
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            price: part.price,
            url: `${siteConfig.url}/spare-parts/${part.slug}`,
            seller: { "@type": "AutoDealer", name: sellerName },
          },
        }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(data),
      }}
    />
  )
}
