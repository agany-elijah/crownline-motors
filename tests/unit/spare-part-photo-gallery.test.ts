import { describe, expect, it } from "vitest"

import type { Prisma } from "@/generated/prisma/client"
import { reconcileSparePartPrimary } from "@/lib/storage/spare-part-photo-gallery"

/**
 * The parts gallery invariant: a part with at least one live photograph has
 * exactly one primary.
 *
 * ── Why this is tested rather than trusted ────────────────────────────
 * Its vehicle counterpart is the one piece of the media pipeline that has
 * already failed against real data — migration
 * `20260829093000_repair_vehicle_photo_primary` exists because a vehicle was
 * found with a live photograph and no main image, which the catalogue card
 * would have rendered with none. This function is a deliberate mirror of that
 * one (see the note in the module for why it is a mirror and not a generic),
 * and a mirror with no test of its own is how the two quietly diverge.
 *
 * These run against a fake transaction client rather than a database. That is
 * not a compromise: the function's whole job is deciding *which* writes to
 * issue given a set of rows, so asserting on the resulting rows tests exactly
 * the logic that matters, in milliseconds, with no Supabase project involved.
 */

interface FakePhoto {
  id: string
  sparePartId: string
  isPrimary: boolean
  displayOrder: number
  createdAt: Date
  deletedAt: Date | null
}

/**
 * Just enough of `Prisma.TransactionClient` to serve the three calls
 * `reconcileSparePartPrimary` makes.
 *
 * Deliberately strict about the query shapes it understands: if the function
 * is changed to filter or order differently, this fake stops modelling it
 * faithfully and the tests should be updated alongside — a permissive fake
 * that silently ignored a new `where` clause would keep passing while the
 * real query changed meaning.
 */
function fakeTx(rows: FakePhoto[]) {
  const live = () => rows.filter((row) => row.deletedAt === null)

  const tx = {
    sparePartPhoto: {
      findMany: async ({
        where,
      }: {
        where: { sparePartId: string; deletedAt: null }
      }) =>
        live()
          .filter((row) => row.sparePartId === where.sparePartId)
          .sort(
            (a, b) =>
              a.displayOrder - b.displayOrder ||
              a.createdAt.getTime() - b.createdAt.getTime()
          )
          .map((row) => ({ id: row.id, isPrimary: row.isPrimary })),

      updateMany: async ({
        where,
        data,
      }: {
        where: {
          sparePartId: string
          deletedAt: null
          isPrimary: boolean
          id: { not: string }
        }
        data: { isPrimary: boolean }
      }) => {
        let count = 0

        for (const row of live()) {
          if (
            row.sparePartId === where.sparePartId &&
            row.isPrimary === where.isPrimary &&
            row.id !== where.id.not
          ) {
            row.isPrimary = data.isPrimary
            count += 1
          }
        }

        return { count }
      },

      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: { isPrimary: boolean }
      }) => {
        const row = rows.find((candidate) => candidate.id === where.id)
        if (row) row.isPrimary = data.isPrimary
        return row
      },
    },
  }

  return tx as unknown as Prisma.TransactionClient
}

function photo(id: string, overrides: Partial<FakePhoto> = {}): FakePhoto {
  return {
    id,
    sparePartId: "part-1",
    isPrimary: false,
    displayOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  }
}

/** The ids of every live photograph currently marked as the main image. */
function primaries(rows: FakePhoto[]): string[] {
  return rows
    .filter((row) => row.deletedAt === null && row.isPrimary)
    .map((row) => row.id)
}

describe("reconcileSparePartPrimary", () => {
  it("promotes the first photograph when the gallery has no main image", async () => {
    const rows = [
      photo("a", { displayOrder: 0 }),
      photo("b", { displayOrder: 1 }),
    ]

    await reconcileSparePartPrimary(fakeTx(rows), "part-1")

    expect(primaries(rows)).toEqual(["a"])
  })

  it("leaves a correct gallery untouched", async () => {
    const rows = [
      photo("a", { displayOrder: 0 }),
      photo("b", { displayOrder: 1, isPrimary: true }),
    ]

    await reconcileSparePartPrimary(fakeTx(rows), "part-1")

    // Specifically does *not* re-promote the first photograph: the operator
    // chose "b", and a reconciler that overrode that would undo their choice
    // on every subsequent upload.
    expect(primaries(rows)).toEqual(["b"])
  })

  it("keeps the earliest primary when two are set", async () => {
    // The state a concurrent write can leave behind.
    const rows = [
      photo("a", { displayOrder: 0, isPrimary: true }),
      photo("b", { displayOrder: 1, isPrimary: true }),
    ]

    await reconcileSparePartPrimary(fakeTx(rows), "part-1")

    expect(primaries(rows)).toEqual(["a"])
  })

  it("promotes the first live photograph after the main one is removed", async () => {
    const rows = [
      photo("a", { displayOrder: 0, isPrimary: false, deletedAt: new Date() }),
      photo("b", { displayOrder: 1 }),
      photo("c", { displayOrder: 2 }),
    ]

    await reconcileSparePartPrimary(fakeTx(rows), "part-1")

    expect(primaries(rows)).toEqual(["b"])
  })

  it("never promotes a soft-deleted photograph", async () => {
    // Putting a removed photograph back on the website to satisfy a counting
    // rule is worse than a card with no image.
    const rows = [photo("a", { deletedAt: new Date() })]

    await reconcileSparePartPrimary(fakeTx(rows), "part-1")

    expect(rows[0].isPrimary).toBe(false)
  })

  it("leaves an empty gallery alone", async () => {
    // Zero primaries is the correct state for a part with no photographs.
    const rows: FakePhoto[] = []

    await expect(
      reconcileSparePartPrimary(fakeTx(rows), "part-1")
    ).resolves.toBeUndefined()
  })

  it("ignores photographs belonging to another part", async () => {
    const rows = [
      photo("other", { sparePartId: "part-2", isPrimary: true }),
      photo("a", { sparePartId: "part-1" }),
    ]

    await reconcileSparePartPrimary(fakeTx(rows), "part-1")

    expect(primaries(rows).sort()).toEqual(["a", "other"])
  })
})
