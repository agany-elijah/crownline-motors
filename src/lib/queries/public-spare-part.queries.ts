import "server-only"

import { cache } from "react"

import type { Prisma } from "@/generated/prisma/client"
import type { SparePartAvailability } from "@/generated/prisma/enums"
import { SparePartStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { sparePartPhotoPublicUrl } from "@/lib/storage/spare-part-media"
import { escapeLikePattern } from "@/lib/utils/like-pattern"
import { describeFitment } from "@/lib/utils/spare-part-compatibility"
import type { SparePartSearchCriteria } from "@/lib/validations/spare-part-search.schema"
import type { SparePartPhotoDTO } from "@/types/spare-part-photo"
import {
  DEFAULT_SPARE_PART_VISIBILITY,
  SPARE_PART_INFO_FIELDS,
  resolveVisibility,
  shown,
  type SparePartInfoField,
  type Visibility,
} from "@/lib/visibility/product-visibility"

/**
 * Reads for the public spare-parts catalogue.
 *
 * ── Why this is a separate module from spare-part.queries.ts ──────────
 * That module serves the admin dashboard, and its list query deliberately
 * applies *no* status filter by default — an operator looking for a part they
 * archived last month has to be able to find it. That is correct there and
 * catastrophic here. It also selects `supplierName` and `supplierNotes`,
 * which are internal sourcing records: what a part cost us, who to ask for,
 * and how long they take. Publishing those would hand every customer the
 * dealership's margin.
 *
 * Keeping the two in separate modules is not tidiness. It means the public
 * side never inherits a default written for the dashboard, and a filter added
 * for an operator cannot silently widen what a customer sees. Every read
 * below goes through `publicSparePartWhere`, which pins the status and cannot
 * be talked out of it.
 *
 * ── What the DTOs deliberately omit ───────────────────────────────────
 * At the dealership's instruction the catalogue does not show a part's
 * condition, its country of origin, whether it is priced or quoted, how many
 * are in stock, or anything about where it was sourced. Those columns all
 * still exist and the dashboard still shows them — they are operational
 * facts, not listing copy.
 *
 * The way that instruction is honoured here is by *not selecting the
 * columns*, rather than by leaving them out of a component. A DTO that
 * carried `stockQuantity` would be one careless `{part.stockQuantity}` away
 * from publishing it, and nothing would fail. A DTO that never held it cannot
 * leak it, and adding it back is a deliberate edit in this file.
 *
 * `pricingMode` is the one that needs saying out loud: it is not in any DTO,
 * and a quoted part is represented by `price: null`. The customer sees "Price
 * on enquiry" — which is a fact about *this listing*, not the name of an
 * internal pricing strategy. There is nothing for a component to branch on
 * beyond the price it was given.
 *
 * ── Facts an operator has hidden ──────────────────────────────────────
 * Settings → Catalogue display hides a fact for every part, and a part's own
 * `hiddenFields` hides it for that one (see
 * `@/lib/visibility/product-visibility`). Both are applied while the DTO is
 * built, so a hidden value is null in the payload and nothing downstream can
 * publish it. Search and the category filter honour the same rule, because
 * narrowing results by a fact reveals it as surely as printing it. A hidden
 * price is represented exactly like a quoted one: `price: null`.
 *
 * Decimals are converted to numbers here, as in every other query module:
 * Prisma's Decimal is not serialisable across the server/client boundary, and
 * Decimal(12,2) tops out well below 2^53.
 */

/** Parts per page in the public catalogue. Cards are small and the grid runs
 *  to four columns, so a page is six full rows on a desktop and twelve on a
 *  phone — enough to browse, short enough to load on a slow connection. */
export const PUBLIC_SPARE_PARTS_PER_PAGE = 24

/**
 * The only status a customer may ever see.
 *
 * DRAFT is unfinished and ARCHIVED was withdrawn on purpose. PUBLISHED is the
 * single status that means "this listing is live", which is exactly what
 * `updateSparePartStatusAction` treats as a separately-permissioned decision.
 */
export const PUBLIC_SPARE_PART_STATUS = SparePartStatus.PUBLISHED

/**
 * Filters a public read may add on top of the visibility rule.
 *
 * `status` is excluded at the type level, so a caller cannot pass one even by
 * accident.
 */
export type PublicSparePartFilters = Omit<Prisma.SparePartWhereInput, "status">

/**
 * The where-clause every public read must use.
 *
 * The status is applied *after* the caller's filters are spread, so it wins
 * even if an untyped caller manages to smuggle one in. The type-level `Omit`
 * above is the first guard; this ordering is the one that still holds at
 * runtime.
 */
export function publicSparePartWhere(
  filters: PublicSparePartFilters = {}
): Prisma.SparePartWhereInput {
  return { ...filters, status: PUBLIC_SPARE_PART_STATUS }
}

/* ── What a card carries beyond its headline ─────────────────────── */

/**
 * How many photographs travel with a catalogue card.
 *
 * The card itself shows one. The other three are for the preview panel that
 * opens from the card's Add button, which lets someone confirm a part and add
 * it without losing their place in the grid.
 *
 * ── Why the preview ships with the card instead of being fetched ──────
 * The alternative is an endpoint the panel calls when it opens: a new public
 * read surface to secure, a loading state, and — on the connections this
 * business actually runs on — a spinner between the tap and the answer, for
 * data measured in hundreds of bytes.
 *
 * Four photograph URLs, one excerpt and a few fitment lines is roughly half a
 * kilobyte per card. Across a full page that is around 12KB of extra HTML,
 * once, on a page already fetching two dozen images. The panel then opens
 * instantly and works for someone whose connection dropped after the page
 * loaded.
 */
const PREVIEW_PHOTO_LIMIT = 4

/**
 * How many fitment lines the preview carries.
 *
 * The card prints only the first and summarises the rest; the panel shows the
 * set. `PREVIEW_FITMENT_LIMIT + 1` rows are fetched so "and others" can be
 * said truthfully without a second count query.
 */
const PREVIEW_FITMENT_LIMIT = 6

/** How long the preview's description excerpt runs before it is cut. */
const EXCERPT_MAX_LENGTH = 180

/**
 * The first sentence or two of a description, cut at a word boundary.
 *
 * Truncated on the server rather than with CSS line-clamping, because the
 * full description of a part can run to several paragraphs and shipping all
 * of it twenty-four times over to display three lines of it is exactly the
 * mobile-data waste the brief's §19 is about.
 *
 * The ellipsis is a real character rather than three dots: it is one glyph,
 * it cannot be broken across a line, and a screen reader announces it
 * correctly.
 */
export function buildExcerpt(
  description: string,
  maxLength = EXCERPT_MAX_LENGTH
): string {
  const collapsed = description.replace(/\s+/g, " ").trim()

  if (collapsed.length <= maxLength) return collapsed

  const cut = collapsed.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(" ")

  // A description with no spaces in its first 180 characters is not a
  // sentence; cutting mid-word is the honest fallback rather than returning
  // the whole thing.
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export interface SparePartPreview {
  /** The manufacturer's number, when the listing carries one and shows it. */
  oemPartNumber: string | null
  /** A short opening of the description — never the whole of it. Null when hidden. */
  excerpt: string | null
  /** Fitment, already rendered as the customer reads it. Empty when hidden. */
  fitment: string[]
  /** Whether the part has fitment rules beyond the ones carried here. */
  hasMoreFitment: boolean
  photos: SparePartPhotoDTO[]
}

/** A part as the catalogue card shows it. */
export interface PublicSparePartCard {
  slug: string
  /**
   * Our own listing reference.
   *
   * Carried, but **not rendered anywhere a customer can see it** — at the
   * dealership's instruction, because a buyer identifies a part by the
   * manufacturer's number stamped on the one they are replacing, and a second
   * internal-looking code beside it is noise. It travels with the card because
   * it is what the basket stores and what the WhatsApp message quotes, so an
   * operator receiving that message can find the exact listing. See the note
   * on `oemPartNumber` below.
   */
  referenceNumber: string
  name: string
  /** "Denso", "Genuine Toyota" — the second question every parts buyer asks,
   *  and the card's eyebrow. Null when the listing does not name one. */
  brand: string | null
  /** The category's display name, or null when hidden. */
  categoryName: string | null
  /** Null means the part is quoted on enquiry — see the module note. */
  price: number | null
  /**
   * What the listing says about getting hold of it.
   *
   * Deliberately *not* the stock figure. `stockQuantity` stays internal — the
   * catalogue publishes a promise the business has chosen to make, not a
   * count it happens to hold, and the two are separate columns for exactly
   * that reason. See `SparePartAvailability`. Null when hidden.
   */
  availability: SparePartAvailability | null
  photoUrl: string | null
  photoAltText: string | null
  preview: SparePartPreview
}

export interface PublicSparePartListResult {
  parts: PublicSparePartCard[]
  total: number
  page: number
  pageCount: number
}

/**
 * How the catalogue and every related strip order themselves.
 *
 * Featured first, then most recently published — which for a listing means
 * `updatedAt`, since publishing is itself an update. Ordering is stable
 * because `id` breaks ties; without it, two parts saved in the same second
 * could swap places between page loads and appear twice or not at all across
 * a paginated crawl.
 */
const CARD_ORDER_BY = [
  { isFeatured: "desc" },
  { updatedAt: "desc" },
  { id: "asc" },
] satisfies Prisma.SparePartOrderByWithRelationInput[]

/**
 * Photographs for a card.
 *
 * The main image sorts first — it is the card's cover — then the supporting
 * images in the operator's order. Soft-deleted rows are excluded, which is
 * the whole point of the soft delete.
 */
/**
 * Declared as a mutable, explicitly-typed array rather than inline.
 *
 * `as const` on the object below would otherwise make this a readonly tuple,
 * which Prisma's `orderBy` will not accept — and the object does need
 * `as const`, because `SparePartGetPayload<{ select: typeof CARD_SELECT }>` is
 * what types every row this module maps. Naming the arrays separately keeps
 * the literal `true`s const-asserted and the arrays assignable.
 */
const PART_PHOTO_ORDER: Prisma.SparePartPhotoOrderByWithRelationInput[] = [
  { isPrimary: "desc" },
  { displayOrder: "asc" },
  { createdAt: "asc" },
]

/** Alphabetical, so a fitment list reads the same way twice. */
const FITMENT_ORDER: Prisma.SparePartCompatibilityOrderByWithRelationInput[] = [
  { make: "asc" },
  { model: "asc" },
  { yearFrom: "asc" },
]

const CARD_PHOTOS = {
  where: { deletedAt: null },
  orderBy: PART_PHOTO_ORDER,
  select: { id: true, storagePath: true, altText: true, isPrimary: true },
  take: PREVIEW_PHOTO_LIMIT,
} as const

/**
 * Everything a card needs, and nothing else.
 *
 * Note what is absent: `status`, `stockQuantity`, `pricingMode`, `condition`,
 * `countryOfOrigin`, `supplierName`, `supplierNotes`. See the module note.
 *
 * `PREVIEW_FITMENT_LIMIT + 1` rows are taken rather than the limit itself, so
 * the preview can say "and others" truthfully without a second count query.
 */
const CARD_SELECT = {
  slug: true,
  referenceNumber: true,
  name: true,
  brand: true,
  category: { select: { name: true } },
  price: true,
  availability: true,
  oemPartNumber: true,
  description: true,
  hiddenFields: true,
  photos: CARD_PHOTOS,
  compatibility: {
    orderBy: FITMENT_ORDER,
    select: {
      id: true,
      make: true,
      model: true,
      yearFrom: true,
      yearTo: true,
      engine: true,
    },
    take: PREVIEW_FITMENT_LIMIT + 1,
  },
} as const

type CardRow = Prisma.SparePartGetPayload<{ select: typeof CARD_SELECT }>

function toPhotoDto(photo: {
  id: string
  storagePath: string
  altText: string | null
  isPrimary: boolean
}): SparePartPhotoDTO {
  return {
    id: photo.id,
    url: sparePartPhotoPublicUrl(photo.storagePath),
    altText: photo.altText,
    isPrimary: photo.isPrimary,
  }
}

function toCard(row: CardRow, siteWide: Visibility<SparePartInfoField>): PublicSparePartCard {
  const photos = row.photos.map(toPhotoDto)
  const cover = photos[0] ?? null
  const visible = resolveVisibility(SPARE_PART_INFO_FIELDS, siteWide, row.hiddenFields)

  const fitmentRows = visible.compatibility ? row.compatibility.slice(0, PREVIEW_FITMENT_LIMIT) : []

  return {
    slug: row.slug,
    referenceNumber: row.referenceNumber,
    name: row.name,
    brand: shown(visible.brand, row.brand),
    categoryName: shown(visible.category, row.category.name),
    // Null is meaningful and must survive: it is how a quoted part says it has
    // no listed price, which is different from a price of zero.
    price: visible.price ? (row.price?.toNumber() ?? null) : null,
    availability: shown(visible.availability, row.availability),
    photoUrl: cover?.url ?? null,
    photoAltText: cover?.altText ?? null,
    preview: {
      oemPartNumber: shown(visible.partNumber, row.oemPartNumber),
      excerpt: shown(visible.description, buildExcerpt(row.description)),
      fitment: fitmentRows.map(describeFitment),
      hasMoreFitment: visible.compatibility && row.compatibility.length > PREVIEW_FITMENT_LIMIT,
      photos,
    },
  }
}

/** Settings → Catalogue display → Spare parts. Cached with the rest of the settings. */
async function siteWideVisibility(): Promise<Visibility<SparePartInfoField>> {
  return (await getPublicSiteSettings()).catalogDisplay.sparePart
}

/** Parts that have not hidden `field` themselves. */
function notHidden(field: SparePartInfoField): PublicSparePartFilters {
  return { NOT: { hiddenFields: { has: field } } }
}

/**
 * How many words of a free-text query are actually used.
 *
 * Each word becomes its own set of `ILIKE` comparisons, so the cost of a
 * query is linear in the number of words. Six is past anything a real search
 * needs and stops a hand-edited URL turning one page load into eighty index
 * scans.
 */
const SEARCH_TERM_LIMIT = 6

/**
 * Turns the parsed search criteria into a `where` fragment.
 *
 * ── The search box: every word must match something ───────────────────
 * `q` is one field standing in for three, so each word is matched against the
 * part name, the manufacturer's number *or* our reference (an OR), and the
 * words are then ANDed together. That is what makes "harrier pads" mean "a
 * Harrier pad" rather than "anything Harrier-ish or any pad" — the second
 * reading returns half the catalogue and looks like a search that ignored the
 * query.
 *
 * `contains` rather than `equals`, because a customer typing into a box is
 * working from memory or reading a worn stamping off an old part, and half a
 * number ("33471") is a legitimate query. All three columns carry `pg_trgm`
 * GIN indexes (see schema.prisma), which is what makes an infix, insensitive
 * `contains` an index lookup rather than a table scan.
 *
 * ── The category chip: an exact slug, not a search ────────────────────
 * The rail only offers slugs that exist, so this is equality on a relation
 * field. A slug that no longer exists simply matches nothing, and the page
 * says so — which is the right answer for a link shared before a category was
 * retired.
 */
export function sparePartSearchWhere(
  criteria: SparePartSearchCriteria,
  /** Settings → Catalogue display. A hidden part number is never searched. */
  siteWide: Visibility<SparePartInfoField> = DEFAULT_SPARE_PART_VISIBILITY
): PublicSparePartFilters {
  const where: PublicSparePartFilters = {}

  const words = criteria.q
    ? criteria.q
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .slice(0, SEARCH_TERM_LIMIT)
    : []

  if (words.length > 0) {
    where.AND = words.map((word) => {
      const pattern = escapeLikePattern(word)

      return {
        OR: [
          { name: { contains: pattern, mode: "insensitive" as const } },
          // Matching a hidden number would confirm it to whoever typed it.
          ...(siteWide.partNumber
            ? [{ oemPartNumber: { contains: pattern, mode: "insensitive" as const }, ...notHidden("partNumber") }]
            : []),
          { referenceNumber: { contains: pattern, mode: "insensitive" as const } },
        ],
      }
    })
  }

  // A part whose category is hidden is not filed under it for the customer,
  // and while categories are hidden site-wide the filter is not offered at all.
  if (criteria.category && siteWide.category) {
    where.category = { slug: criteria.category }
    where.NOT = notHidden("category").NOT
  }

  return where
}

/** A page of live listings, in `CARD_ORDER_BY` order. */
export async function listPublishedSpareParts(options?: {
  page?: number
  /**
   * Customer-supplied narrowing. Kept separate from any internal filter so a
   * caller cannot hand a raw query string straight through as a Prisma
   * fragment — everything here has been through `sparePartSearchSchema`.
   */
  criteria?: SparePartSearchCriteria
}): Promise<PublicSparePartListResult> {
  const page = Math.max(1, options?.page ?? 1)
  const siteWide = await siteWideVisibility()

  const where = publicSparePartWhere(
    options?.criteria ? sparePartSearchWhere(options.criteria, siteWide) : {}
  )

  // Count and page fetched in one round trip. Two awaits would be two round
  // trips to Supabase for data rendered together.
  const [total, rows] = await prisma.$transaction([
    prisma.sparePart.count({ where }),
    prisma.sparePart.findMany({
      where,
      orderBy: CARD_ORDER_BY,
      skip: (page - 1) * PUBLIC_SPARE_PARTS_PER_PAGE,
      take: PUBLIC_SPARE_PARTS_PER_PAGE,
      select: CARD_SELECT,
    }),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PUBLIC_SPARE_PARTS_PER_PAGE))

  /**
   * A page past the end of the result set returns the last real page.
   *
   * `?page=99` on a three-page catalogue otherwise returns nothing, and the
   * page renders "no parts match" over an empty grid — telling a customer
   * their search failed when it matched three pages. Reachable from a stale
   * bookmark, a crawler following an old link, and anyone editing the address.
   *
   * Clamped in the query rather than redirected from the page, for the reason
   * spelled out in `listPublishedVehicles`: `loading.tsx` opens a Suspense
   * boundary over this segment, so a `redirect()` would surface as a caught
   * error inside a committed 200.
   */
  if (page > pageCount) {
    const lastPage = await prisma.sparePart.findMany({
      where,
      orderBy: CARD_ORDER_BY,
      skip: (pageCount - 1) * PUBLIC_SPARE_PARTS_PER_PAGE,
      take: PUBLIC_SPARE_PARTS_PER_PAGE,
      select: CARD_SELECT,
    })

    return { parts: lastPage.map((row) => toCard(row, siteWide)), total, page: pageCount, pageCount }
  }

  return { parts: rows.map((row) => toCard(row, siteWide)), total, page, pageCount }
}

/* ── The category rail ───────────────────────────────────────────── */

export interface PublicSparePartCategory {
  slug: string
  name: string
  /** Published parts filed under it. Used to drop empty categories. */
  partCount: number
}

/**
 * The categories the rail offers.
 *
 * ── Why empty categories are dropped ──────────────────────────────────
 * A chip that leads to "no parts in this category" is a promise the
 * catalogue cannot keep, and with twelve seeded categories and a young
 * inventory most of them would be exactly that. The rail shows what the
 * dealership actually stocks; the taxonomy behind it stays complete for the
 * operator.
 *
 * ── Why the count is of *published* parts specifically ────────────────
 * `_count` on the relation counts every part, drafts and archived listings
 * included, which is the one number that must not decide what a customer
 * sees: an operator with three drafts under "Cooling" would put a chip on the
 * rail leading to an empty grid. `groupBy` over the published rows answers
 * the question actually being asked.
 *
 * Inactive categories are excluded even if they hold published parts. A
 * retired category is one the dealership has stopped organising around; the
 * parts under it stay live and findable by search and by their own URLs.
 */
export const listPublicSparePartCategories = cache(
  async (): Promise<PublicSparePartCategory[]> => {
    // No rail at all while categories are hidden site-wide.
    if (!(await siteWideVisibility()).category) return []

    const [categories, counts] = await Promise.all([
      prisma.sparePartCategory.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { id: true, slug: true, name: true },
      }),
      prisma.sparePart.groupBy({
        by: ["categoryId"],
        where: publicSparePartWhere(notHidden("category")),
        _count: { _all: true },
      }),
    ])

    const countById = new Map(
      counts.map((row) => [row.categoryId, row._count._all])
    )

    return categories
      .map((category) => ({
        slug: category.slug,
        name: category.name,
        partCount: countById.get(category.id) ?? 0,
      }))
      .filter((category) => category.partCount > 0)
  }
)

/* ── One part ────────────────────────────────────────────────────── */

export interface PublicSparePartDetail {
  slug: string
  referenceNumber: string
  name: string
  oemPartNumber: string | null
  brand: string | null
  price: number | null
  /** See the note on the card DTO — a published promise, not a stock count. */
  availability: SparePartAvailability | null
  description: string | null
  /** Null, with the slug, when the category is hidden. */
  categoryName: string | null
  categorySlug: string | null
  /** Fitment, already rendered as the customer reads it. The whole list; empty when hidden. */
  fitment: string[]
  photos: SparePartPhotoDTO[]
}

/**
 * A live listing by its public slug, or null.
 *
 * `findFirst` with the visibility clause, not `findUnique` on the slug. The
 * slug is unique, so `findUnique` would be the natural choice — and would
 * return a draft or an archived part to anyone holding the URL. Putting the
 * status in the where-clause makes an unpublished part indistinguishable from
 * a slug that never existed, which is what the page's `notFound()` then
 * reports.
 *
 * `cache()`d so `generateMetadata` and the page body share one round trip.
 */
export const getPublishedSparePartBySlug = cache(
  async (slug: string): Promise<PublicSparePartDetail | null> => {
    const [part, siteWide] = await Promise.all([prisma.sparePart.findFirst({
      where: publicSparePartWhere({ slug }),
      select: {
        slug: true,
        referenceNumber: true,
        name: true,
        oemPartNumber: true,
        brand: true,
        price: true,
        availability: true,
        description: true,
        hiddenFields: true,
        category: { select: { name: true, slug: true } },
        photos: {
          where: { deletedAt: null },
          orderBy: PART_PHOTO_ORDER,
          select: { id: true, storagePath: true, altText: true, isPrimary: true },
        },
        compatibility: {
          orderBy: FITMENT_ORDER,
          select: {
            id: true,
            make: true,
            model: true,
            yearFrom: true,
            yearTo: true,
            engine: true,
          },
        },
      },
    }), siteWideVisibility()])

    if (!part) return null

    const visible = resolveVisibility(SPARE_PART_INFO_FIELDS, siteWide, part.hiddenFields)

    return {
      slug: part.slug,
      referenceNumber: part.referenceNumber,
      name: part.name,
      oemPartNumber: shown(visible.partNumber, part.oemPartNumber),
      brand: shown(visible.brand, part.brand),
      price: visible.price ? (part.price?.toNumber() ?? null) : null,
      availability: shown(visible.availability, part.availability),
      description: shown(visible.description, part.description),
      categoryName: shown(visible.category, part.category.name),
      categorySlug: shown(visible.category, part.category.slug),
      fitment: visible.compatibility ? part.compatibility.map(describeFitment) : [],
      photos: part.photos.map(toPhotoDto),
    }
  }
)

/**
 * How many parts the "You may also like" strip shows.
 *
 * Twelve rather than the vehicle strip's eight. A parts strip scrolls at a
 * card a third the width, so twelve is a comparable amount of swiping — and
 * someone shopping for a consumable is far more likely to want the next four
 * things in the same category than someone looking at a specific car is to
 * want another car.
 */
export const RELATED_SPARE_PARTS_LIMIT = 12

/**
 * Other live parts in the same category.
 *
 * "Similar" is the category, and only the category. It is the crudest
 * possible definition and deliberately so: a narrower rule (same fitment,
 * say) would return nothing on a young inventory, and a strip that is usually
 * empty is worse than one that is occasionally loose.
 *
 * The visibility clause comes from `publicSparePartWhere`, exactly as every
 * other public read does — a related strip is as capable of leaking a draft as
 * a catalogue page is, and it would be leaking it onto a page the customer is
 * already reading.
 *
 * `excludeSlug` keeps the part out of its own suggestions.
 */
export async function listRelatedSpareParts({
  excludeSlug,
  limit = RELATED_SPARE_PARTS_LIMIT,
}: {
  /** The part whose page this strip sits on; its category decides the strip. */
  excludeSlug: string
  limit?: number
}): Promise<PublicSparePartCard[]> {
  /**
   * Looked up by the part's own slug rather than handed a category, so the
   * strip still works — invisibly — on a part whose category is hidden and
   * therefore absent from its public DTO. The grouping is ours; it names
   * nothing on the page.
   */
  const [rows, siteWide] = await Promise.all([
    prisma.sparePart.findMany({
      where: publicSparePartWhere({
        category: { parts: { some: { slug: excludeSlug, status: PUBLIC_SPARE_PART_STATUS } } },
        slug: { not: excludeSlug },
      }),
      orderBy: CARD_ORDER_BY,
      take: Math.max(0, limit),
      select: CARD_SELECT,
    }),
    siteWideVisibility(),
  ])

  return rows.map((row) => toCard(row, siteWide))
}
