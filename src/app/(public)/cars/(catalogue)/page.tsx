import type { Metadata } from "next"
import Link from "next/link"

import { Container } from "@/components/layout/container"
import { Pagination } from "@/components/shared/pagination"
import { Section } from "@/components/layout/section"
import { Button } from "@/components/ui/button"
import { VehicleCatalogueQuoteButton } from "@/components/quotes/quote-request-triggers"
import { CatalogueMasthead } from "@/components/vehicles/catalogue-masthead"
import { VehicleSearch } from "@/components/vehicles/vehicle-search"
import { VehicleGrid } from "@/components/vehicles/vehicle-grid"
import { siteConfig } from "@/config/site"
import {
  listPublishedVehicles,
  listVehicleFacets,
  PUBLIC_VEHICLES_PER_PAGE,
} from "@/lib/queries/public-vehicle.queries"
import { formatNumber } from "@/lib/utils/format-currency"
import {
  catalogueHref,
  hasActiveSearch,
  parseVehicleSearchParams,
} from "@/lib/validations/vehicle-search.schema"

/**
 * The public vehicle catalogue.
 *
 * ── Where the vehicles come from ──────────────────────────────────────
 * `listPublishedVehicles`, never the admin `listVehicles`. That module
 * applies no status filter by default — correct for a dashboard, where an
 * operator has to be able to find a vehicle they archived last month, and
 * catastrophic here, where it would put unfinished drafts and vehicles
 * already sold in front of customers at prices nobody meant to publish.
 * Nothing on this page is hard-coded: an operator publishes a listing and
 * it appears, which is the brief's central technical requirement.
 *
 * ── Searching and filtering (Stage 12) ────────────────────────────────
 * A free-text box matched against make, model and year at once, above
 * dropdowns for the same three fields. The two combine rather than compete.
 * The whole search lives in the query string: it is parsed by
 * `vehicleSearchSchema` on every request, so a filtered catalogue is a real
 * address a customer can bookmark or send over WhatsApp, and the back button
 * works. Nothing about the search state is held in a component.
 *
 * The brief's wider list — price, mileage, fuel, transmission, drive,
 * location — is scoped out of Wave A at the client's request. It is not
 * designed around: `PublicVehicleFilters` still accepts any of them, so each
 * is a field on the schema plus a control on the bar, not a rewrite.
 */

const TITLE = "Cars for sale in South Sudan"
const DESCRIPTION =
  "Browse quality vehicles imported from Japan and South Korea, delivered to Juba and across South Sudan. Full specifications, photographs and delivered-price estimates on every listing."

/**
 * Metadata that knows whether a filter is applied.
 *
 * ── Why the canonical always points at /cars ──────────────────────────
 * Three filters produce a large number of URLs over the same inventory, and
 * a search engine that indexes them all sees near-duplicate pages competing
 * with each other for the terms the business actually wants to rank for
 * ("Cars for sale in South Sudan", "Japan cars South Sudan"). Pointing every
 * filtered view at the unfiltered catalogue consolidates that signal on one
 * page. Individual vehicle pages remain separately indexable, which is where
 * the long-tail search value genuinely lives.
 *
 * The *title* still reflects the filter, because it is what a customer sees
 * in a browser tab and in a WhatsApp link preview — and "Toyota Harrier 2021
 * for sale in South Sudan" is a far more useful thing to receive than
 * "Cars".
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { page: _page, ...criteria } = parseVehicleSearchParams(await searchParams)

  // The dropdown selections describe the page more reliably than the
  // free-text box does — they are whole values drawn from the inventory,
  // where `q` may be a fragment, a misspelling, or something with no
  // matches at all. A title is a promise about the page, so it is built
  // from the former and falls back to the catalogue's own name.
  const described = [criteria.make, criteria.model, criteria.year]
    .filter(Boolean)
    .join(" ")

  const title = described ? `${described} for sale in South Sudan` : TITLE

  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/cars" },
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description: DESCRIPTION,
      url: `${siteConfig.url}/cars`,
      type: "website",
    },
  }
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  /**
   * Parsed forgivingly, in one place: `?page=banana` shows page one and
   * `?year=banana` shows every year, rather than either producing an error
   * page. A query string is user-editable, and a malformed one is an
   * ordinary event — see vehicle-search.schema.ts.
   */
  const { page: requestedPage, ...criteria } = parseVehicleSearchParams(params)
  const isFiltered = hasActiveSearch(criteria)

  /**
   * The facets are fetched regardless of whether a filter is applied — they
   * are what populates the dropdowns, so an unfiltered first visit needs
   * them as much as a filtered one. Both reads go out together rather than
   * in sequence: they are independent, and on a mobile connection the
   * round trip is the expensive part, not the query.
   */
  const [{ vehicles, total, page, pageCount }, facets] = await Promise.all([
    listPublishedVehicles({ page: requestedPage, criteria }),
    listVehicleFacets(),
  ])

  /**
   * `page` is what the query actually served, not what the URL asked for.
   *
   * `listPublishedVehicles` clamps a request past the end of the result set
   * back to the last real page — see the note there for why that is done in
   * the query rather than with a redirect here. Reading the clamped value
   * back is what keeps the range line ("Showing 1,177–36" on a page holding
   * twelve vehicles) and the pager honest.
   */
  const first = (page - 1) * PUBLIC_VEHICLES_PER_PAGE + 1
  const last = Math.min(page * PUBLIC_VEHICLES_PER_PAGE, total)

  return (
    <>
      <CatalogueMasthead />

      {/*
        Compact at the top, standard at the bottom.

        The masthead above is deliberately short, and the search bar is the
        next thing a customer needs — a full `py-16` between them would put
        the control they came to use below the fold on a phone for no
        reason. The closing padding stays at the standard step so the grid
        does not run into the section beneath it.
      */}
      <Section spacing="compact" containerSize="wide" className="pb-16 md:pb-24">
        {/*
          The catalogue runs to the wide measure, and the grid is four
          columns from `xl`.

          It used to be three columns inside a 72rem cap, which gave a 371px
          card — the width the card's specification band was measured
          against. Four columns at that cap would be 273px each, well under
          the 328px at which the band gives up and drops the Explore cue onto
          its own line, so the width has to come from somewhere. `Container
          size="wide"` is 100rem, which at four columns and a 20px gutter
          gives roughly 385px on a 1920px display and 361px at 1600px — the
          same measure the three-column layout had, at one more car per row.

          The floor is the `xl` breakpoint itself: 1280px yields a 281px
          card, which is the tightest arrangement here and still a supported
          one (the card's container queries close its gaps up and, below
          328px, stack the cue — the same thing the "You may also like" strip
          does at phone widths, so a row of them stays uniform). Do not move
          the fourth column below `xl` without re-measuring: at `lg` the
          cards fall under 240px and the band has nowhere left to go.

          The container sits on the whole block — count, grid and pagination
          — rather than on the grid alone, so the three stay aligned with
          each other instead of the grid floating inside a narrower header.
          The masthead above is centred text, so it needs no matching change.
        */}
        <div className="mx-auto flex w-full flex-col gap-6 sm:gap-8">
          {/*
            Rendered only when there is something to search. An empty
            dealership would otherwise show a search box and three dropdowns
            offering "Any make / Any model / Any year" above an empty grid,
            which looks broken rather than new.
          */}
          {facets.length > 0 ? (
            <VehicleSearch facets={facets} criteria={criteria} />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-4">
            {/*
              The one place the result count is stated.

              Phrased differently depending on whether the customer asked a
              question: unfiltered it is a fact about the inventory — "12
              vehicles available" — while filtered it is the answer to a
              search, and saying "available" there would imply the whole
              floor holds two cars.

              `aria-live="polite"` earns its place now that the filters can
              change this without a navigation a screen reader would
              otherwise announce. It was deliberately absent before they
              existed, when it could only ever have fired on load. There is
              exactly one such region on the page: the filter bar states no
              count of its own, so nothing is announced twice.

              Zero is rendered as a count rather than as a sentence, so it
              does not repeat the empty state sitting directly beneath it.
            */}
            <p aria-live="polite" className="text-small text-muted-foreground">
              {isFiltered
                ? `${formatNumber(total)} matching vehicle${total === 1 ? "" : "s"}`
                : total === 0
                  ? "No vehicles listed right now"
                  : `${formatNumber(total)} vehicle${total === 1 ? "" : "s"} available`}
              {total > PUBLIC_VEHICLES_PER_PAGE ? (
                <>
                  {" · "}
                  <span className="tabular">
                    Showing {formatNumber(first)}–{formatNumber(last)}
                  </span>
                </>
              ) : null}
            </p>

            {/* Opens the request panel in place, so a customer who has
                scrolled a long way down the results does not lose them. */}
            <VehicleCatalogueQuoteButton variant="outline" size="sm">
              Can&rsquo;t find it? Get a quote
            </VehicleCatalogueQuoteButton>
          </div>

          <VehicleGrid vehicles={vehicles} filtered={isFiltered} />

          {/*
            `criteria` is carried into every page link. Without it, stepping
            to page two would silently drop the customer's search and show
            them the whole floor — the classic paginated-search bug, and one
            that is invisible until someone has enough inventory for a
            second page.
          */}
          <Pagination
            page={page}
            pageCount={pageCount}
            hrefFor={(target) => catalogueHref(criteria, target)}
            label="Catalogue pages"
          />
        </div>
      </Section>

      {/*
        ── Closing prompt ─────────────────────────────────────────
        Reached by everyone who scrolled the whole catalogue without finding
        their car — exactly the customer worth asking. The button opens the
        request panel here rather than sending them to another page: all it
        needs is a message, and the catalogue they were reading stays put.
      */}
      <Section variant="dark" spacing="default" reveal>
        <Container size="narrow" className="flex flex-col items-center gap-6 px-0 text-center">
          <h2 className="text-h2">Haven&rsquo;t found what you&rsquo;re looking for?</h2>
          <p className="max-w-xl text-body text-background/75">
            Tell us the make, model and budget you have in mind. We source to
            order from auction houses in Japan and Korea, and confirm the
            delivered price before you commit to anything.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <VehicleCatalogueQuoteButton />
            <Button render={<Link href="/how-it-works" />} variant="outline" size="lg">
              How it works
            </Button>
          </div>
        </Container>
      </Section>
    </>
  )
}
