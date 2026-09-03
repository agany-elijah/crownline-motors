import type { Metadata } from "next"
import Link from "next/link"

import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
import { Section } from "@/components/layout/section"
import { Button } from "@/components/ui/button"
import { VehicleFilters } from "@/components/vehicles/vehicle-filters"
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
  type VehicleSearchCriteria,
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
 * ── Filtering (Stage 12) ──────────────────────────────────────────────
 * Make, model and year, each usable alone and all three combinable. The
 * whole search lives in the query string: it is parsed by
 * `vehicleSearchSchema` on every request, so a filtered catalogue is a real
 * address a customer can bookmark or send over WhatsApp, and the back button
 * works. Nothing about the filter state is held in a component.
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
  const { page, ...criteria } = parseVehicleSearchParams(params)
  const isFiltered = hasActiveSearch(criteria)

  /**
   * The facets are fetched regardless of whether a filter is applied — they
   * are what populates the dropdowns, so an unfiltered first visit needs
   * them as much as a filtered one. Both reads go out together rather than
   * in sequence: they are independent, and on a mobile connection the
   * round trip is the expensive part, not the query.
   */
  const [{ vehicles, total, pageCount }, facets] = await Promise.all([
    listPublishedVehicles({ page, criteria }),
    listVehicleFacets(),
  ])

  const first = (page - 1) * PUBLIC_VEHICLES_PER_PAGE + 1
  const last = Math.min(page * PUBLIC_VEHICLES_PER_PAGE, total)

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Cars"
        description="Sourced from Japan and South Korea, inspected before export, and tracked to your door in South Sudan."
        // No href on the final item — this is the page the visitor is on,
        // and Breadcrumbs renders the last entry as plain text.
        breadcrumbs={[{ label: "Cars" }]}
      />

      <Section spacing="default">
        {/*
          The catalogue runs to a narrower measure than the page container.

          `Container size="default"` is 80rem, which at three columns gives
          cards around 380px wide — big enough that a row of them reads as
          three posters rather than as a set of listings. Capping the
          column brings that down without touching the responsive grid or
          introducing a fourth column that would halve them instead.

          72rem, not the 64rem this started at. 64rem produced a 328px
          card, and the card's specification band — a 2×2 matrix beside the
          Explore cue — needs about 350px before a long transmission label
          and a six-figure mileage stop competing for the same row and one
          of them truncates. 72rem gives roughly 371px, which clears that
          with room to spare and still sits under the 380px that read as
          posters. Do not narrow it again without re-measuring the widest
          values the inventory can actually produce.

          The cap sits on the whole block — count, grid and pagination —
          rather than on the grid alone, so the three stay aligned with
          each other instead of the grid floating inside a wider header.
        */}
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          {/*
            Rendered only when there is something to filter. An empty
            dealership would otherwise show three dropdowns offering "Any
            make / Any model / Any year" above an empty grid, which looks
            broken rather than new.
          */}
          {facets.length > 0 ? (
            <VehicleFilters facets={facets} criteria={criteria} />
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

            <Button render={<Link href="/get-a-quote" />} variant="outline" size="sm">
              Can&rsquo;t find it? Request a vehicle
            </Button>
          </div>

          <VehicleGrid vehicles={vehicles} filtered={isFiltered} />

          {pageCount > 1 ? (
            <CataloguePagination
              page={page}
              pageCount={pageCount}
              criteria={criteria}
            />
          ) : null}
        </div>
      </Section>

      {/* ── Closing prompt ───────────────────────────────────────── */}
      <Section variant="dark" spacing="default" reveal>
        <Container size="narrow" className="flex flex-col items-center gap-6 px-0 text-center">
          <h2 className="text-h2">Looking for something specific?</h2>
          <p className="max-w-xl text-body text-background/75">
            Tell us the make, model and budget you have in mind. We source to
            order from auction houses in Japan and Korea, and confirm the
            delivered price before you commit to anything.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button render={<Link href="/get-a-quote" />} size="lg">
              Get a quote
            </Button>
            <Button render={<Link href="/how-it-works" />} variant="outline" size="lg">
              How it works
            </Button>
          </div>
        </Container>
      </Section>
    </>
  )
}

/**
 * Previous/next only, with the position stated in words beside it.
 *
 * Not a numbered page list: that is a lot of small tap targets on a phone,
 * and with twelve vehicles to a page the number of pages here is small
 * enough that stepping through them is no hardship. Both controls are real
 * links, so they work without JavaScript and can be opened in a new tab.
 */
function CataloguePagination({
  page,
  pageCount,
  criteria,
}: {
  page: number
  pageCount: number
  /**
   * Carried into every page link. Without it, stepping to page two would
   * silently drop the customer's filters and show them the whole floor —
   * the classic paginated-search bug, and one that is invisible until
   * someone has enough inventory for a second page.
   */
  criteria: VehicleSearchCriteria
}) {
  const hrefFor = (target: number) => catalogueHref(criteria, target)

  return (
    <nav
      aria-label="Catalogue pages"
      className="flex items-center justify-between gap-4 border-t border-border pt-6"
    >
      <div className="flex-1">
        {page > 1 ? (
          <Button render={<Link href={hrefFor(page - 1)} />} variant="outline" size="sm">
            Previous
          </Button>
        ) : null}
      </div>

      <p className="tabular text-small text-muted-foreground">
        Page {page} of {pageCount}
      </p>

      <div className="flex flex-1 justify-end">
        {page < pageCount ? (
          <Button render={<Link href={hrefFor(page + 1)} />} variant="outline" size="sm">
            Next
          </Button>
        ) : null}
      </div>
    </nav>
  )
}
