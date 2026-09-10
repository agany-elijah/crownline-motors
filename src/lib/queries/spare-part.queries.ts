import "server-only"

import { cache } from "react"

import type { Prisma } from "@/generated/prisma/client"
import type {
  CountryOfOrigin,
  SparePartAvailability,
  SparePartCondition,
  SparePartPricingMode,
  SparePartStatus,
} from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { describeFitment } from "@/lib/utils/spare-part-compatibility"
import type { SparePartListFilters } from "@/lib/validations/spare-part.schema"

/**
 * Reads for the spare-parts inventory — **the admin dashboard only**.
 *
 * Nothing customer-facing may import this module, for the same reason
 * nothing customer-facing may import vehicle.queries.ts: `listSpareParts`
 * applies no status filter unless one is asked for, so behind a public
 * catalogue it would publish drafts and withdrawn listings complete with
 * prices nobody intended to show. It also selects `supplierName` and
 * `supplierNotes`, which are internal sourcing records and are nobody's
 * business outside this dashboard.
 *
 * When the public catalogue is built (Stage 16) it gets its own module with
 * the PUBLISHED filter pinned and the supplier columns absent, mirroring
 * public-vehicle.queries.ts.
 *
 * Everything returns a DTO with Decimals converted to numbers. Prisma's
 * Decimal is not serialisable across the server/client boundary and throws
 * if handed to a client component — converting once here means no page has
 * to remember. Decimal(12,2) tops out below 2^53, so nothing is lost.
 */

export const SPARE_PARTS_PER_PAGE = 20

export interface SparePartListItem {
  id: string
  referenceNumber: string
  name: string
  oemPartNumber: string | null
  categoryName: string
  pricingMode: SparePartPricingMode
  price: number | null
  stockQuantity: number
  availability: SparePartAvailability
  status: SparePartStatus
  isFeatured: boolean
  photoCount: number
  fitmentCount: number
  updatedAt: Date
}

export interface SparePartListResult {
  parts: SparePartListItem[]
  total: number
  page: number
  pageCount: number
}

/**
 * Builds the `where` clause for the admin list.
 *
 * Note what is absent: any status filter by default. The admin list shows
 * every part including ARCHIVED, because an operator looking for something
 * they archived last month needs to find it — hiding archived rows would be
 * the public site's behaviour leaking into the tool used to manage it.
 */
function buildWhere(filters: SparePartListFilters): Prisma.SparePartWhereInput {
  const where: Prisma.SparePartWhereInput = {}

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.availability) {
    where.availability = filters.availability
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId
  }

  if (filters.outOfStock) {
    where.stockQuantity = 0
  }

  if (filters.search) {
    const search = filters.search

    /**
     * Searched across the three things an operator actually has to hand:
     * what the part is called, the number a customer read off the old one,
     * and our own reference from an email. All three are trigram-indexed
     * (`SparePart_*_idx`), which is what makes an infix `contains` an index
     * lookup rather than a table scan on every keystroke.
     *
     * `mode: "insensitive"` matters because nobody types a part number with
     * consistent capitalisation when they are in a hurry.
     *
     * The value reaches Prisma as a bound parameter, never string
     * concatenation — this is a structured filter object, not raw SQL, so
     * there is no injection surface here. The Zod schema is what guarantees
     * `search` is a string and not an attacker-supplied filter object (see
     * Security-files/data-access.md on operator injection).
     */
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { oemPartNumber: { contains: search, mode: "insensitive" } },
      { referenceNumber: { contains: search, mode: "insensitive" } },
    ]
  }

  return where
}

/**
 * `id` breaks ties. Without it, two parts saved in the same second have no
 * defined order between them, and Postgres is free to return them
 * differently on each query — so one could appear on both page one and page
 * two while another appeared on neither.
 */
const LIST_ORDER_BY = [
  { updatedAt: "desc" },
  { id: "asc" },
] satisfies Prisma.SparePartOrderByWithRelationInput[]

/** Everything a list row needs, and nothing else. */
const LIST_SELECT = {
  id: true,
  referenceNumber: true,
  name: true,
  oemPartNumber: true,
  pricingMode: true,
  price: true,
  stockQuantity: true,
  availability: true,
  status: true,
  isFeatured: true,
  updatedAt: true,
  category: { select: { name: true } },
  _count: {
    select: {
      // Soft-deleted photographs must not be counted, or the list would
      // claim a part has images the gallery will not show.
      photos: { where: { deletedAt: null } },
      compatibility: true,
    },
  },
} as const

export async function listSpareParts(
  filters: SparePartListFilters
): Promise<SparePartListResult> {
  const where = buildWhere(filters)
  const page = Math.max(1, filters.page)

  // Count and page fetched in one round trip. Two awaits would be two round
  // trips to Supabase for data rendered together.
  const [total, rows] = await prisma.$transaction([
    prisma.sparePart.count({ where }),
    prisma.sparePart.findMany({
      where,
      orderBy: LIST_ORDER_BY,
      skip: (page - 1) * SPARE_PARTS_PER_PAGE,
      take: SPARE_PARTS_PER_PAGE,
      select: LIST_SELECT,
    }),
  ])

  const pageCount = Math.max(1, Math.ceil(total / SPARE_PARTS_PER_PAGE))

  /**
   * A page past the end of the list returns the last real page.
   *
   * Reachable by archiving the last parts on page three while page three is
   * open, and by any stale bookmark. Clamped rather than redirected, matching
   * the vehicle list — one mechanism for the same problem, and one that
   * cannot be broken later by a Suspense boundary added above the page.
   */
  if (page > pageCount) {
    const lastPage = await prisma.sparePart.findMany({
      where,
      orderBy: LIST_ORDER_BY,
      skip: (pageCount - 1) * SPARE_PARTS_PER_PAGE,
      take: SPARE_PARTS_PER_PAGE,
      select: LIST_SELECT,
    })

    return { parts: lastPage.map(toListItem), total, page: pageCount, pageCount }
  }

  return { parts: rows.map(toListItem), total, page, pageCount }
}

/** The row shape both reads above select, mapped to the list DTO. */
function toListItem(row: {
  id: string
  referenceNumber: string
  name: string
  oemPartNumber: string | null
  pricingMode: SparePartPricingMode
  price: Prisma.Decimal | null
  stockQuantity: number
  availability: SparePartAvailability
  status: SparePartStatus
  isFeatured: boolean
  updatedAt: Date
  category: { name: string }
  _count: { photos: number; compatibility: number }
}): SparePartListItem {
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    name: row.name,
    oemPartNumber: row.oemPartNumber,
    categoryName: row.category.name,
    pricingMode: row.pricingMode,
    // Null is meaningful and must survive: it is how a QUOTE_ONLY part says
    // it has no price, which is different from a price of zero.
    price: row.price?.toNumber() ?? null,
    stockQuantity: row.stockQuantity,
    availability: row.availability,
    status: row.status,
    isFeatured: row.isFeatured,
    photoCount: row._count.photos,
    fitmentCount: row._count.compatibility,
    updatedAt: row.updatedAt,
  }
}

export interface SparePartDetail {
  id: string
  referenceNumber: string
  slug: string
  name: string
  categoryId: string
  categoryName: string
  oemPartNumber: string | null
  brand: string | null
  condition: SparePartCondition
  countryOfOrigin: CountryOfOrigin | null
  pricingMode: SparePartPricingMode
  price: number | null
  stockQuantity: number
  availability: SparePartAvailability
  description: string
  status: SparePartStatus
  isFeatured: boolean
  supplierName: string | null
  supplierNotes: string | null
  photoCount: number
  fitmentCount: number
  createdAt: Date
  updatedAt: Date
}

/**
 * One part by id, or null.
 *
 * `cache()`d so a page and its metadata can both ask without a second query.
 * Returns null rather than throwing so the caller decides between
 * `notFound()` and something else.
 */
export const getSparePartById = cache(
  async (id: string): Promise<SparePartDetail | null> => {
    const part = await prisma.sparePart.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
        _count: {
          select: {
            photos: { where: { deletedAt: null } },
            compatibility: true,
          },
        },
      },
    })

    if (!part) return null

    return {
      id: part.id,
      referenceNumber: part.referenceNumber,
      slug: part.slug,
      name: part.name,
      categoryId: part.categoryId,
      categoryName: part.category.name,
      oemPartNumber: part.oemPartNumber,
      brand: part.brand,
      condition: part.condition,
      countryOfOrigin: part.countryOfOrigin,
      pricingMode: part.pricingMode,
      price: part.price?.toNumber() ?? null,
      stockQuantity: part.stockQuantity,
      availability: part.availability,
      description: part.description,
      status: part.status,
      isFeatured: part.isFeatured,
      supplierName: part.supplierName,
      supplierNotes: part.supplierNotes,
      photoCount: part._count.photos,
      fitmentCount: part._count.compatibility,
      createdAt: part.createdAt,
      updatedAt: part.updatedAt,
    }
  }
)

/** Counts by status, for the list's filter chips. */
export const getSparePartStatusCounts = cache(
  async (): Promise<Record<string, number>> => {
    const rows = await prisma.sparePart.groupBy({
      by: ["status"],
      _count: { _all: true },
    })

    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]))
  }
)

export interface SparePartCategoryOption {
  id: string
  name: string
  /** False when the category has been retired. See `listCategoryOptions`. */
  isActive: boolean
}

/**
 * The categories the part form may offer.
 *
 * ── Why `currentCategoryId` exists ────────────────────────────────────
 * Categories are retired with `isActive = false`, and a retired one must not
 * be offered for new parts — that is the whole point of retiring it. But
 * parts already filed under it keep their `categoryId`, and a select that
 * silently omitted the value it was supposed to be showing would fall back
 * to whichever option happens to be first. The operator opens a part to fix
 * a typo in its description, saves, and has quietly recategorised it.
 *
 * So the part's own category is always included, whatever its state, and
 * flagged so the form can mark it as retired. An operator who then chooses a
 * different one cannot go back — which is correct, because that is what
 * retiring a category means.
 */
export async function listCategoryOptions(
  currentCategoryId?: string
): Promise<SparePartCategoryOption[]> {
  const categories = await prisma.sparePartCategory.findMany({
    where: currentCategoryId
      ? { OR: [{ isActive: true }, { id: currentCategoryId }] }
      : { isActive: true },
    // The curated order, with name breaking ties so two categories left at
    // the same displayOrder still render predictably.
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true },
  })

  return categories
}

/**
 * Every category with a count of the parts filed under it, for the list's
 * category filter.
 *
 * Includes inactive categories that still hold parts, for the same reason
 * `listCategoryOptions` does: an operator has to be able to find them in
 * order to move them somewhere current.
 */
export const getCategoryFilterOptions = cache(
  async (): Promise<Array<SparePartCategoryOption & { partCount: number }>> => {
    const categories = await prisma.sparePartCategory.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: { select: { parts: true } },
      },
    })

    return categories
      .filter((category) => category.isActive || category._count.parts > 0)
      .map(({ _count, ...category }) => ({ ...category, partCount: _count.parts }))
  }
)

/* ── Fitment ─────────────────────────────────────────────────────── */

export interface SparePartFitmentRow {
  id: string
  /** Null means the rule fits every make — see the model. */
  make: string | null
  model: string | null
  yearFrom: number | null
  yearTo: number | null
  engine: string | null
  notes: string | null
  /** The rule as the customer reads it, rendered from the columns rather than
   *  stored — so the dashboard, the card and the matcher cannot describe the
   *  same rule three ways. */
  description: string
}

/**
 * Every fitment rule on a part, for the dashboard's fitment board.
 *
 * Ordered so the widest rules read first — a "fits any vehicle" row at the
 * top of the list, then makes alphabetically. Postgres sorts NULLs last on an
 * ascending order by default, which would bury the broadest claim at the
 * bottom, so `nulls: "first"` is set explicitly. `id` breaks ties, or two
 * rules written in the same second could swap places between page loads.
 */
export async function listSparePartFitment(
  sparePartId: string
): Promise<SparePartFitmentRow[]> {
  const rows = await prisma.sparePartCompatibility.findMany({
    where: { sparePartId },
    orderBy: [
      { make: { sort: "asc", nulls: "first" } },
      { model: { sort: "asc", nulls: "first" } },
      { yearFrom: { sort: "asc", nulls: "first" } },
      { id: "asc" },
    ],
    select: {
      id: true,
      make: true,
      model: true,
      yearFrom: true,
      yearTo: true,
      engine: true,
      notes: true,
    },
  })

  return rows.map((row) => ({ ...row, description: describeFitment(row) }))
}
