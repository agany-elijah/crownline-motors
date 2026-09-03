import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, MessageCircle } from "lucide-react"

import { Section } from "@/components/layout/section"
import { Reveal } from "@/components/shared/reveal"
import { Button } from "@/components/ui/button"
import { RelatedVehicles } from "@/components/vehicles/related-vehicles"
import { VehicleConditionTag } from "@/components/vehicles/vehicle-condition-tag"
import { VehicleDetailTabs } from "@/components/vehicles/vehicle-detail-tabs"
import { VehicleGallery } from "@/components/vehicles/vehicle-gallery"
import { VehicleMobileActionBar } from "@/components/vehicles/vehicle-mobile-action-bar"
import { siteConfig } from "@/config/site"
import {
  COUNTRY_LABELS,
  DRIVE_TYPE_LABELS,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
} from "@/lib/constants/vehicle-options"
import { getWhatsAppNumber } from "@/lib/queries/settings.queries"
import {
  getPublishedVehicleBySlug,
  listRelatedVehicles,
  type PublicVehicleDetail,
} from "@/lib/queries/public-vehicle.queries"
import { formatCurrency, formatMileage } from "@/lib/utils/format-currency"
import { buildVehicleWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

/**
 * A single vehicle.
 *
 * ── Visibility ────────────────────────────────────────────────────────
 * `getPublishedVehicleBySlug` looks the slug up *with* the PUBLISHED
 * clause rather than by unique key, so a draft, a sold vehicle or an
 * archived one is indistinguishable from a slug that never existed — this
 * page cannot leak one by forgetting to check, because there is nothing
 * here to remember. The query is `cache()`d, so `generateMetadata` and the
 * page body share a single database round trip.
 *
 * ── Shape of the page ─────────────────────────────────────────────────
 * Photography, then the decision, then the detail:
 *
 *     back to listings
 *          →  gallery, full width
 *          →  condition · name · price · request / WhatsApp
 *          →  specifications | features   (one at a time)
 *          →  description
 *          →  you may also like
 *
 * Every band runs the full measure and stacks. The previous version put
 * the gallery in a seven-column well beside a five-column specification
 * card, then a short description beside a price panel — which meant that
 * on any listing whose description ran shorter than the panel beside it,
 * a third of the page was empty. Photography-first, as the design brief
 * asks, is also the layout with nothing to leave hanging.
 *
 * The summary band is the whole decision in one place: what the car is,
 * what it costs, and the two ways to act on it, with nothing between the
 * price and the buttons. Specifications and features follow *after* it,
 * because they are what someone reads to talk themselves into or out of a
 * car they have already priced.
 *
 * ── One price, and only one ───────────────────────────────────────────
 * The page states the vehicle price and nothing else. It used to carry a
 * breakdown adding shipping, clearing and other charges into an
 * "estimated delivered price", and that was removed on the dealership's
 * instruction: those figures move with freight rates, the port and the
 * destination, and the business is not in a position to stand behind them
 * on a public page before a specific vehicle has been quoted. A number a
 * customer can budget against and the dealership cannot honour is the
 * single most expensive thing this site could publish — worse than
 * publishing nothing, because it is quoted back at collection.
 *
 * So the page says what it knows, says plainly that the rest is confirmed
 * in the quotation, and routes the customer to the conversation where it
 * genuinely is confirmed. The `shippingEstimate`, `clearingEstimate` and
 * `otherChargesEst` columns still exist and are still editable by an
 * operator; they are simply no longer read by anything customer-facing,
 * which is why the public DTO no longer selects them.
 *
 * The price is stated exactly once, in the summary band, rather than once
 * beside the heading and again in a panel further down. Two copies of the
 * same figure on one page is how a listing ends up showing two different
 * ones after an edit touches only the surface someone remembered.
 *
 * ── What is deliberately not on this page ─────────────────────────────
 * The breadcrumb trail and the listing reference. The trail restated the
 * navigation that is already fixed to the top of every page and cost the
 * first line of the listing to do it; a single "Back to listings" control
 * is the one move a customer actually makes from here. The reference
 * number is an internal identifier — it stays in the metadata, in the
 * structured data as the SKU, and in the WhatsApp message this page
 * composes, all places where it does work. On the page itself it was a
 * code the customer was shown and given no reason to care about.
 *
 * The page closes on other vehicles from the same make rather than on a
 * third copy of the two actions that already sit in the summary band and
 * in the pinned mobile bar. See RelatedVehicles for why.
 *
 * On a phone the request action is additionally pinned to the bottom of
 * the screen for the whole page. See VehicleMobileActionBar.
 */

interface PageProps {
  params: Promise<{ slug: string }>
}

/** `2021 Toyota Harrier` — the name used in titles, alt text and messages. */
function vehicleName(vehicle: Pick<PublicVehicleDetail, "year" | "make" | "model">) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const vehicle = await getPublishedVehicleBySlug(slug)

  if (!vehicle) {
    // A withdrawn listing must not keep advertising itself in search
    // results, and `notFound()` cannot be called from here.
    return { title: "Vehicle not found", robots: { index: false, follow: false } }
  }

  const name = vehicleName(vehicle)

  /**
   * Written for the searches the brief names — "Japan cars South Sudan",
   * "used cars Juba" — while staying a truthful sentence about this car.
   * A description assembled purely from keywords reads as spam to a person
   * and is treated as such by a search engine.
   */
  const description = `${name} for sale in South Sudan. ${formatMileage(vehicle.mileageKm)}, ${
    TRANSMISSION_LABELS[vehicle.transmission as keyof typeof TRANSMISSION_LABELS] ??
    vehicle.transmission
  }, ${vehicle.engineSize}. Imported from ${
    COUNTRY_LABELS[vehicle.countryOfOrigin as keyof typeof COUNTRY_LABELS] ??
    vehicle.countryOfOrigin
  } and delivered to Juba. Reference ${vehicle.referenceNumber}.`

  const cover = vehicle.photos[0]

  return {
    title: name,
    description,
    alternates: { canonical: `/cars/${vehicle.slug}` },
    openGraph: {
      title: `${name} | ${siteConfig.name}`,
      description,
      url: `${siteConfig.url}/cars/${vehicle.slug}`,
      type: "website",
      images: cover ? [{ url: cover.url, alt: name }] : undefined,
    },
  }
}

export default async function VehiclePage({ params }: PageProps) {
  const { slug } = await params
  const vehicle = await getPublishedVehicleBySlug(slug)

  if (!vehicle) notFound()

  const name = `${vehicle.make} ${vehicle.model}`
  const fullName = vehicleName(vehicle)

  const fuel =
    FUEL_TYPE_LABELS[vehicle.fuelType as keyof typeof FUEL_TYPE_LABELS] ?? vehicle.fuelType
  const transmission =
    TRANSMISSION_LABELS[vehicle.transmission as keyof typeof TRANSMISSION_LABELS] ??
    vehicle.transmission
  const drive =
    DRIVE_TYPE_LABELS[vehicle.driveType as keyof typeof DRIVE_TYPE_LABELS] ?? vehicle.driveType
  const country =
    COUNTRY_LABELS[vehicle.countryOfOrigin as keyof typeof COUNTRY_LABELS] ??
    vehicle.countryOfOrigin

  /**
   * The dealership's number comes from BusinessSettings, which is what the
   * admin can actually edit, and falls back to the build-time environment
   * variable. The brief requires this to be configurable rather than
   * hard-coded per page; reading the row means changing it does not need a
   * redeploy.
   */
  /**
   * Both reads are independent of each other, so they are issued together
   * rather than one after the other — a page that already waits on the
   * vehicle lookup should not then wait on two more round trips in series.
   */
  const [whatsappNumber, relatedVehicles] = await Promise.all([
    // `getWhatsAppNumber`, not `getBusinessSettings`: that one upserts the
    // singleton row, which is right for the admin screen and wrong on a page
    // anonymous traffic loads. It also already applies the env fallback, so
    // the `||` this used to carry lives in one place now.
    getWhatsAppNumber(),
    listRelatedVehicles({ make: vehicle.make, excludeSlug: vehicle.slug }),
  ])

  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: whatsappNumber,
    message: buildVehicleWhatsAppMessage({
      siteName: siteConfig.name,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      referenceNumber: vehicle.referenceNumber,
    }),
  })

  /** A quote pre-filled with this vehicle. Built once — two surfaces link
   *  to it (the summary band and the pinned mobile bar) and they must not
   *  drift apart. */
  const requestHref = `/get-a-quote?vehicle=${vehicle.slug}`

  const specifications = [
    { label: "Year", value: String(vehicle.year) },
    { label: "Mileage", value: formatMileage(vehicle.mileageKm) },
    { label: "Engine", value: vehicle.engineSize },
    { label: "Transmission", value: transmission },
    { label: "Fuel", value: fuel },
    { label: "Drive", value: drive },
    { label: "Exterior", value: vehicle.exteriorColor },
    { label: "Interior", value: vehicle.interiorColor },
    { label: "Country of origin", value: country },
    { label: "Currently in", value: vehicle.currentLocation },
  ]

  return (
    <>
      {/* ── Back, photography, and the decision ───────────────────── */}
      <Section spacing="compact">
        {/*
          The same 72rem measure the catalogue grid uses, so a customer
          arriving from /cars meets the vehicle at the width they were just
          reading at rather than a wider one.
        */}
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          {/*
            One way back, in place of the breadcrumb trail this replaced.
            A link rather than `history.back()`: it is a real destination
            that works on a page opened from a search result or a WhatsApp
            message, where there is no history to go back through.
          */}
          <Link
            href="/cars"
            className="group/back inline-flex w-fit items-center gap-2 text-small font-medium text-muted-foreground transition-colors duration-fast ease-crownline hover:text-foreground"
          >
            <ArrowLeftIcon
              aria-hidden="true"
              className="size-4 transition-transform duration-fast ease-crownline group-hover/back:-translate-x-0.5"
            />
            Back to listings
          </Link>

          <VehicleGallery photos={vehicle.photos} vehicle={vehicle} />

          {/*
            ── The summary band ──────────────────────────────────────
            Condition, then what the car is, then what it costs, then the
            two ways to act — in that order and with nothing between the
            price and the buttons.

            One panel rather than a two-column grid, because the content
            either side of a gap here would be a heading and a figure:
            unbalanced by nature, and the source of the empty third of a
            page this layout replaced.
          */}
          <section
            aria-labelledby="summary-heading"
            className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 sm:p-8"
          >
            <VehicleConditionTag condition={vehicle.condition} />

            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-12">
              {/* Make and model carry the heading; the year, origin and
                  mileage sit under it as metadata rather than being
                  repeated as a second labelled grid of the same facts. */}
              <div className="flex flex-col gap-2">
                <h1 id="summary-heading" className="text-h1">
                  {name}
                </h1>
                <p className="tabular text-body text-muted-foreground">
                  {vehicle.year} · {country} · {formatMileage(vehicle.mileageKm)}
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-0.5 md:items-end md:text-right">
                <h2 id="pricing-heading" className="eyebrow text-muted-foreground">
                  Vehicle price
                </h2>
                {/* Sans, and green, matching the treatment on a catalogue
                    card — a customer arriving here from the grid should
                    recognise the same figure rather than meet a second
                    house style for money. */}
                <span className="tabular font-sans text-h2 font-bold text-price">
                  {formatCurrency(vehicle.price)}
                </span>
              </div>
            </div>

            {/*
              The terms and the two actions share one row, divided from the
              identity above by a rule that runs the full width of the
              panel.

              Not a paragraph with the buttons beneath it: at this measure
              that leaves the whole right half of the panel empty under the
              price, which is the same hole this page was rebuilt to
              remove. Reading the terms and acting on them is one moment,
              and putting them on one line says so.
            */}
            <div className="flex flex-col gap-6 border-t border-border pt-6 md:flex-row md:items-center md:justify-between md:gap-10">
              {/*
                Stated rather than implied. The brief requires an estimate
                never to read as a confirmed figure, and the honest version
                of that — now that there are no estimates on this page — is
                to say which costs are still open and where they get closed.
              */}
              <p className="max-w-xl text-small text-muted-foreground">
                This is the price of the vehicle itself. Shipping, clearing
                and delivery depend on the vessel, the port and where in
                South Sudan you are collecting, so we confirm your full
                delivered cost on the quotation before you commit to
                anything.
              </p>

              {/*
                Stacked until `md`, because "WhatsApp about this car" is a
                long label in the uppercase, wide-tracked treatment `lg`
                buttons take — side by side on a narrow tablet it wraps and
                the pair stops looking like two equal actions.

                One gold CTA, per the design system's "one primary action
                per surface" rule — the palette enforces it, since
                `default` is the only filled-gold variant.

                Requesting lands on /get-a-quote with the vehicle named in
                the query string. There is no separate "request" route: a
                request for a specific vehicle *is* a quote whose
                `linkedVehicleId` is set, which is exactly how the Quote
                model represents it, and inventing a second path would mean
                two ways of creating the same record.
              */}
              <div className="flex shrink-0 flex-col gap-3 md:flex-row">
                <Button
                  render={<Link href={requestHref} />}
                  size="lg"
                  className="w-full md:w-auto"
                >
                  Request this vehicle
                </Button>

                {whatsappUrl ? (
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
                    variant="outline"
                    size="lg"
                    className="w-full md:w-auto"
                  >
                    <MessageCircle aria-hidden="true" />
                    WhatsApp about this car
                  </Button>
                ) : null}
              </div>
            </div>
          </section>
          {/*
            ── What the car is: specifications or features ──────────
            Part of this band rather than a section of its own. As a
            separate <Section> the two stacked paddings put ~145px of empty
            page between the summary panel and the tabs — on the same
            background, so it read as a hole rather than as a break. A
            section break has to be earned by a change of surface, which is
            what the muted description band below actually does.
          */}
          <Reveal className="mt-4">
            <VehicleDetailTabs
              specifications={specifications}
              features={vehicle.features}
            />
          </Reveal>
        </div>
      </Section>

      {/* ── The part a specification table cannot say ─────────────── */}
      <Section variant="muted" spacing="default" reveal>
        {/*
          A single column at a reading measure, not a text column with a
          panel beside it. A description is one or two paragraphs on most
          listings, and anything placed next to it is left hanging on the
          ones where it is short.
        */}
        <section
          aria-labelledby="description-heading"
          className="mx-auto flex w-full max-w-6xl flex-col gap-5"
        >
          <h2 id="description-heading" className="text-h2">
            About this vehicle
          </h2>
          {/*
            `whitespace-pre-line` so the paragraph breaks an operator typed
            in the dashboard survive to the page. The value is interpolated
            as text, never as HTML, so nothing in a description can inject
            markup.
          */}
          <p className="max-w-3xl text-body-lg whitespace-pre-line text-muted-foreground">
            {vehicle.description}
          </p>
        </section>
      </Section>

      {/* ── Other vehicles from the same make ─────────────────────── */}
      <RelatedVehicles vehicles={relatedVehicles} make={vehicle.make} />

      {/* Holds open the space the pinned bar covers, so the last section
          can still be scrolled clear of it. The footer gets its own
          clearance from globals.css, which can reach it and this page
          cannot. */}
      <div aria-hidden="true" className="action-bar-clearance lg:hidden" />

      <VehicleMobileActionBar requestHref={requestHref} />
      <VehicleStructuredData vehicle={vehicle} name={fullName} />
    </>
  )
}

/**
 * Structured data for the listing.
 *
 * A `Car` (a subtype of `Product`) with an `Offer`, which is what lets a
 * search engine show the price and availability against the result — the
 * brief asks for individually indexable vehicle pages, and this is the
 * difference between being indexed and being understood.
 *
 * Only fields the database actually holds are emitted. Padding this with a
 * made-up seller rating or review count is misrepresentation in a
 * machine-readable format, which search engines penalise and which would be
 * a lie about a real business.
 *
 * `itemCondition` is emitted now that the listing genuinely records it —
 * this used to be named here as an example of what *not* to invent, and the
 * rule has not changed: it is here because there is a column behind it, and
 * it maps to schema.org's vocabulary rather than sending our own enum name
 * out to a consumer that would not recognise it.
 *
 * The JSON is serialised with `JSON.stringify` and the one character that
 * could close the script element early is escaped. Every value here is
 * operator-entered, so it is not attacker-controlled, but a model name
 * containing `</script>` would break the page regardless of intent.
 */
function VehicleStructuredData({
  vehicle,
  name,
}: {
  vehicle: PublicVehicleDetail
  name: string
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Car",
    itemCondition:
      vehicle.condition === "NEW"
        ? "https://schema.org/NewCondition"
        : "https://schema.org/UsedCondition",
    name,
    description: vehicle.description,
    sku: vehicle.referenceNumber,
    brand: { "@type": "Brand", name: vehicle.make },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: vehicle.mileageKm,
      unitCode: "KMT",
    },
    fuelType: vehicle.fuelType,
    vehicleTransmission: vehicle.transmission,
    driveWheelConfiguration: vehicle.driveType,
    color: vehicle.exteriorColor,
    image: vehicle.photos.map((photo) => photo.url),
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: vehicle.price,
      availability: "https://schema.org/InStock",
      url: `${siteConfig.url}/cars/${vehicle.slug}`,
      seller: { "@type": "AutoDealer", name: siteConfig.name },
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  )
}
