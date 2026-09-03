import "server-only"

import { cache } from "react"

import type { Prisma } from "@/generated/prisma/client"
import type { VehicleCondition, VehicleStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import type { VehicleListFilters } from "@/lib/validations/vehicle.schema"

/**
 * Reads for the vehicle inventory — **the admin dashboard only**.
 *
 * Nothing customer-facing may import this module. `listVehicles` applies no
 * status filter unless one is asked for, deliberately (see `buildWhere`), so
 * behind /cars it would publish drafts, sold vehicles and withdrawn
 * listings. The public marketplace reads through
 * `@/lib/queries/public-vehicle.queries`, where the PUBLISHED filter is
 * pinned and cannot be overridden.
 *
 * Everything returns a DTO with Decimals converted to numbers. Prisma's
 * Decimal is not serialisable across the server/client boundary and throws
 * if handed to a client component — converting once here means no page has
 * to remember. Decimal(12,2) tops out below 2^53, so nothing is lost.
 */

export const VEHICLES_PER_PAGE = 20

export interface VehicleListItem {
  id: string
  referenceNumber: string
  make: string
  model: string
  year: number
  price: number
  mileageKm: number
  status: VehicleStatus
  isFeatured: boolean
  photoCount: number
  updatedAt: Date
}

export interface VehicleListResult {
  vehicles: VehicleListItem[]
  total: number
  page: number
  pageCount: number
}

/**
 * Builds the `where` clause for the admin list.
 *
 * Note what is absent: any status filter by default. The admin list shows
 * every vehicle including ARCHIVED, because an operator looking for a
 * vehicle they archived last month needs to find it — hiding archived rows
 * would be the public site's behaviour leaking into the tool used to
 * manage it.
 */
function buildWhere(filters: VehicleListFilters): Prisma.VehicleWhereInput {
  const where: Prisma.VehicleWhereInput = {}

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.search) {
    const search = filters.search

    /**
     * Searched across the fields an operator actually has to hand: the
     * reference from an email, or the make and model a customer said on the
     * phone. `mode: "insensitive"` matters because nobody types "Toyota"
     * with a capital T when they are in a hurry.
     *
     * The value reaches Prisma as a bound parameter, never string
     * concatenation — this is a structured filter object, not raw SQL, so
     * there is no injection surface here (see Security-files/data-access.md
     * on operator injection: the Zod schema above is what guarantees
     * `search` is a string and not an attacker-supplied filter object).
     */
    where.OR = [
      { referenceNumber: { contains: search, mode: "insensitive" } },
      { make: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
    ]
  }

  return where
}

export async function listVehicles(
  filters: VehicleListFilters
): Promise<VehicleListResult> {
  const where = buildWhere(filters)
  const page = Math.max(1, filters.page)

  // Count and page fetched in one round trip. Two awaits would be two
  // round trips to Supabase for data rendered together.
  const [total, rows] = await prisma.$transaction([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * VEHICLES_PER_PAGE,
      take: VEHICLES_PER_PAGE,
      select: {
        id: true,
        referenceNumber: true,
        make: true,
        model: true,
        year: true,
        price: true,
        mileageKm: true,
        status: true,
        isFeatured: true,
        updatedAt: true,
        // Soft-deleted photos must not be counted, or the list would claim
        // a vehicle has images the gallery will not show.
        _count: { select: { photos: { where: { deletedAt: null } } } },
      },
    }),
  ])

  return {
    vehicles: rows.map((row) => ({
      id: row.id,
      referenceNumber: row.referenceNumber,
      make: row.make,
      model: row.model,
      year: row.year,
      price: row.price.toNumber(),
      mileageKm: row.mileageKm,
      status: row.status,
      isFeatured: row.isFeatured,
      photoCount: row._count.photos,
      updatedAt: row.updatedAt,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / VEHICLES_PER_PAGE)),
  }
}

export interface VehicleDetail {
  id: string
  referenceNumber: string
  slug: string
  make: string
  model: string
  year: number
  price: number
  mileageKm: number
  fuelType: string
  transmission: string
  engineSize: string
  driveType: string
  exteriorColor: string
  interiorColor: string
  countryOfOrigin: string
  currentLocation: string
  condition: VehicleCondition
  shippingEstimate: number | null
  clearingEstimate: number | null
  otherChargesEst: number | null
  description: string
  features: string[]
  status: VehicleStatus
  isFeatured: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * One vehicle by id, or null.
 *
 * `cache()`d so a page and its metadata can both ask without a second
 * query. Returns null rather than throwing so the caller decides between
 * `notFound()` and something else.
 */
export const getVehicleById = cache(
  async (id: string): Promise<VehicleDetail | null> => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } })

    if (!vehicle) return null

    return {
      ...vehicle,
      price: vehicle.price.toNumber(),
      shippingEstimate: vehicle.shippingEstimate?.toNumber() ?? null,
      clearingEstimate: vehicle.clearingEstimate?.toNumber() ?? null,
      otherChargesEst: vehicle.otherChargesEst?.toNumber() ?? null,
    }
  }
)

/** Counts by status, for the list's filter chips. */
export const getVehicleStatusCounts = cache(
  async (): Promise<Record<string, number>> => {
    const rows = await prisma.vehicle.groupBy({
      by: ["status"],
      _count: { _all: true },
    })

    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]))
  }
)
