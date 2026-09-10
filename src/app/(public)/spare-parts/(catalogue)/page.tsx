import type { Metadata } from "next"
import Link from "next/link"

import { Container } from "@/components/layout/container"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Section } from "@/components/layout/section"
import { Pagination } from "@/components/shared/pagination"
import { Button } from "@/components/ui/button"
import { PartsCatalogueQuoteButton } from "@/components/quotes/quote-request-triggers"
import { RecentlyViewedParts } from "@/components/spare-parts/recently-viewed-parts"
import { SparePartGrid } from "@/components/spare-parts/spare-part-grid"
import { SparePartsBar } from "@/components/spare-parts/spare-parts-bar"
import { SparePartsCatalogueBar } from "@/components/spare-parts/spare-parts-catalogue-bar"
import { PriceEstimateNote } from "@/components/spare-parts/spare-part-price"
import { siteConfig } from "@/config/site"
import {
  listPublicSparePartCategories,
  listPublishedSpareParts,
  PUBLIC_SPARE_PARTS_PER_PAGE,
} from "@/lib/queries/public-spare-part.queries"
import { formatNumber } from "@/lib/utils/format-currency"
import {
  hasActivePartSearch,
  parseSparePartSearchParams,
  partCatalogueHref,
} from "@/lib/validations/spare-part-search.schema"

/**
 * The public spare-parts catalogue.
 *
 * ── Where the parts come from ─────────────────────────────────────────
 * `listPublishedSpareParts`, never the admin `listSpareParts`. That module
 * applies no status filter by default — correct for a dashboard, where an
 * operator has to be able to find a part they archived last month, and
 * catastrophic here, where it would put unfinished drafts and withdrawn
 * listings in front of customers at prices nobody meant to publish. It also
 * selects the supplier fields, which are internal sourcing records.
 *
 * Nothing on this page is hard-coded: an operator publishes a part and it
 * appears, which is the brief's central technical requirement.
 *
 * ── The shape of the page ─────────────────────────────────────────────
 *
 *     ← Home │ Spare Parts
 *     ──────────────────────────────────────────────────────
 *          ╭─────────── search ───────────╮ ( → )        ← sticky
 *      All parts   Brakes   Suspension   …
 *     ──────────────────────────────────────────────────────
 *                                         48 parts available
 *     the grid
 *     pagination
 *     recently viewed
 *
 * One utility row, then one sticky toolbar holding both ways of narrowing the
 * grid, then products. The centred masthead that used to open this page — a
 * breadcrumb trail, a headline and a line of positioning copy — is gone: it
 * cost most of the first screen on a phone to say things a customer browsing
 * parts did not come for. The keywords it carried live in `generateMetadata`
 * and on the individual part pages, which is where the long-tail search value
 * actually is. The BreadcrumbList structured data is still emitted below,
 * with the visible trail suppressed.
 *
 * The search box used to sit in a bordered block above the grid, which meant
 * it scrolled away while the sticky category rail stayed — so a customer at
 * the bottom of a twenty-four card page could change category but not their
 * search term. Both now live in `SparePartsCatalogueBar` and both stay
 * reachable the whole way down.
 *
 * Categories and the search term live entirely in the query string, so a
 * filtered catalogue is a real address that can be bookmarked or sent over
 * WhatsApp, and the back button works.
 *
 * ── What the catalogue deliberately does not show ─────────────────────
 * Condition, country of origin, whether a part is priced or quoted, stock
 * levels, and anything about sourcing. Those are operational facts the
 * dashboard shows and a customer does not need; the public DTOs do not carry
 * them at all, so no component here could render one by accident. See the
 * module note in public-spare-part.queries.ts.
 */

const TITLE = "Spare parts for Japanese and Korean cars in South Sudan"
const DESCRIPTION =
  "Genuine and quality spare parts imported from Japan and South Korea, delivered across South Sudan. Search by part number or browse by category, with fitment listed on every part."

/**
 * Metadata that knows whether a filter is applied.
 *
 * ── Why the canonical always points at /spare-parts ───────────────────
 * A category and a search term produce a large number of URLs over the same
 * catalogue, and a search engine that indexes them all sees near-duplicate
 * pages competing with each other for the terms the business wants to rank
 * for ("Toyota spare parts South Sudan", "Japanese car spare parts Juba").
 * Pointing every filtered view at the unfiltered catalogue consolidates that
 * signal. Individual part pages remain separately indexable, which is where
 * the long-tail search value genuinely lives.
 *
 * The *title* still reflects the category, because it is what a customer sees
 * in a browser tab and in a WhatsApp link preview.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { category } = parseSparePartSearchParams(await searchParams)

  /**
   * Resolved to the category's real name rather than printed from the slug.
   *
   * A slug is lower-case and hyphenated ("wheels-and-tyres"), and a title
   * built by capitalising it would read as machine output in the one place a
   * customer meets the page before opening it. An unknown slug falls back to
   * the catalogue's own title, which is honest: the page below it is showing
   * everything.
   */
  const categories = category ? await listPublicSparePartCategories() : []
  const named = categories.find((entry) => entry.slug === category)

  const title = named
    ? `${named.name} spare parts in South Sudan`
    : TITLE

  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/spare-parts" },
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description: DESCRIPTION,
      url: `${siteConfig.url}/spare-parts`,
      type: "website",
    },
  }
}

export default async function SparePartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  /**
   * Parsed forgivingly, in one place: `?page=banana` shows page one and
   * `?category=nonsense` shows everything, rather than either producing an
   * error page. A query string is user-editable, and a malformed one is an
   * ordinary event.
   */
  const { page: requestedPage, ...criteria } = parseSparePartSearchParams(params)
  const isFiltered = hasActivePartSearch(criteria)

  /**
   * Both reads go out together. They are independent, and on a mobile
   * connection the round trip is the expensive part, not the query.
   */
  const [{ parts, total, page, pageCount }, categories] = await Promise.all([
    listPublishedSpareParts({ page: requestedPage, criteria }),
    listPublicSparePartCategories(),
  ])

  /**
   * `page` is what the query actually served, not what the URL asked for —
   * `listPublishedSpareParts` clamps a request past the end of the result set
   * back to the last real page. Reading the clamped value back is what keeps
   * the range line and the pager honest.
   */
  const first = (page - 1) * PUBLIC_SPARE_PARTS_PER_PAGE + 1
  const last = Math.min(page * PUBLIC_SPARE_PARTS_PER_PAGE, total)

  return (
    <>
      {/* ── The one utility row ──────────────────────────────────── */}
      <SparePartsBar backHref="/" backLabel="Home" title="Spare Parts" />

      {/*
        The trail, rendered for machines only.

        `hidden` rather than `sr-only`: with the visible bar above carrying the
        one way back, a screen-reader user gains nothing from a second
        navigation landmark saying the same thing, and `Breadcrumbs` emits its
        BreadcrumbList JSON-LD as a *sibling* of the nav — so hiding the nav
        costs none of the structured data that puts a trail under a search
        result.
      */}
      <Breadcrumbs items={[{ label: "Spare Parts" }]} className="hidden" />

      {/* ── Search and categories ────────────────────────────────────
          One sticky band directly under the utility row: this is the
          section's primary navigation rather than a filter buried in a panel,
          and both controls narrow the same result set.

          The search is suppressed only when the catalogue is genuinely empty
          *and* nothing was searched for — a box above an empty grid looks
          broken rather than new. A search that returned nothing keeps it, or
          there would be no way to change the term that failed. */}
      <SparePartsCatalogueBar
        categories={categories}
        criteria={criteria}
        showSearch={total > 0 || isFiltered}
      />

      <Section spacing="compact" className="pb-16 md:pb-24">
        {/* The catalogue runs to the container's full 80rem, which is what
            gives the grid three ~19rem cards at `lg` and four at `xl`. */}
        <div className="flex w-full flex-col gap-5 sm:gap-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            {/*
              The one place the result count is stated.

              Phrased differently depending on whether the customer asked a
              question: unfiltered it is a fact about the catalogue — "48
              parts available" — while filtered it is the answer to a search,
              and saying "available" there would imply the whole catalogue
              holds two.

              `aria-live="polite"` because the rail and the search box can
              both change this without a navigation a screen reader would
              otherwise announce. There is exactly one such region on the
              page.
            */}
            <p
              aria-live="polite"
              className="text-small text-muted-foreground sm:ml-auto"
            >
              {isFiltered
                ? `${formatNumber(total)} matching part${total === 1 ? "" : "s"}`
                : total === 0
                  ? "No parts listed right now"
                  : `${formatNumber(total)} part${total === 1 ? "" : "s"} available`}
              {total > PUBLIC_SPARE_PARTS_PER_PAGE ? (
                <>
                  {" · "}
                  <span className="tabular">
                    Showing {formatNumber(first)}–{formatNumber(last)}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <SparePartGrid parts={parts} filtered={isFiltered} />

          {parts.length > 0 ? <PriceEstimateNote className="max-w-2xl" /> : null}

          {/*
            `criteria` is carried into every page link. Without it, stepping to
            page two would silently drop the customer's category and search —
            the classic paginated-search bug, invisible until there is enough
            stock for a second page.
          */}
          <Pagination
            page={page}
            pageCount={pageCount}
            hrefFor={(target) => partCatalogueHref(criteria, target)}
            label="Catalogue pages"
          />
        </div>
      </Section>

      {/*
        The customer's own trail back into the catalogue.

        Renders nothing on a first visit. It sits below the grid rather than
        above it because a catalogue's first screen belongs to the catalogue —
        a returning customer scrolls past what is new to reach what they were
        looking at, not the other way round. No `excludeSlug`: on this page
        every remembered part is somewhere else.
      */}
      <RecentlyViewedParts />

      {/*
        ── Closing prompt ─────────────────────────────────────────
        The customer who scrolled the whole catalogue without finding their
        part. The button opens the request panel in place — a part number and
        the car it is for is all it needs.
      */}
      <Section variant="dark" spacing="default" reveal>
        <Container
          size="narrow"
          className="flex flex-col items-center gap-6 px-0 text-center"
        >
          <h2 className="text-h2">Haven&rsquo;t found the part you need?</h2>
          <p className="max-w-xl text-body text-background/75">
            Send us the part number, or the make, model and year of your car.
            We source from the same suppliers our vehicles come from and will
            confirm the price and the lead time before you commit to anything.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <PartsCatalogueQuoteButton />
            <Button
              render={<Link href="/how-it-works" />}
              variant="outline"
              size="lg"
            >
              How it works
            </Button>
          </div>
        </Container>
      </Section>
    </>
  )
}
