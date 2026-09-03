import { describe, expect, it } from "vitest"

import type { Prisma } from "@/generated/prisma/client"
import {
  isSamePhotoSet,
  reconcilePrimary,
} from "@/lib/storage/vehicle-photo-gallery"

/**
 * The gallery invariants.
 *
 * `reconcilePrimary` is the one piece of Phase 5 that has already failed
 * against real data: migration `20260829093000_repair_vehicle_photo_primary`
 * exists because a vehicle was found with a live photograph and no main
 * image, which the dashboard rendered with an arbitrary cover and the public
 * card would have rendered with none. It had no test at the time. It does
 * now.
 *
 * These run against a fake transaction client rather than a database. That
 * is not a compromise: the function's whole job is deciding *which* writes
 * to issue given a set of rows, so asserting on the resulting rows tests
 * exactly the logic that broke, and does it in milliseconds with no
 * Supabase project involved.
 */

interface FakePhoto {
  id: string
  vehicleId: string
  isPrimary: boolean
  displayOrder: number
  createdAt: Date
  deletedAt: Date | null
}

/**
 * Just enough of `Prisma.TransactionClient` to serve the three calls
 * `reconcilePrimary` makes.
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
    vehiclePhoto: {
      findMany: async ({
        where,
      }: {
        where: { vehicleId: string; deletedAt: null }
      }) =>
        live()
          .filter((row) => row.vehicleId === where.vehicleId)
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
          vehicleId: string
          deletedAt: null
          isPrimary: boolean
          id: { not: string }
        }
        data: { isPrimary: boolean }
      }) => {
        let count = 0

        for (const row of live()) {
          if (
            row.vehicleId === where.vehicleId &&
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

function photo(
  id: string,
  overrides: Partial<FakePhoto> = {}
): FakePhoto {
  return {
    id,
    vehicleId: "vehicle-1",
    isPrimary: false,
    displayOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  }
}

/** The ids of every live photograph currently marked as the main image. */
function primaries(rows: FakePhoto[]): string[] {
  return rows.filter((row) => row.deletedAt === null && row.isPrimary).map((r) => r.id)
}

describe("reconcilePrimary", () => {
  it("promotes the first photograph when the gallery has no main image", async () => {
    // The exact state the repair migration was written for.
    const rows = [
      photo("a", { displayOrder: 0 }),
      photo("b", { displayOrder: 1 }),
      photo("c", { displayOrder: 2 }),
    ]

    await reconcilePrimary(fakeTx(rows), "vehicle-1")

    expect(primaries(rows)).toEqual(["a"])
  })

  it("collapses several main images down to the earliest", async () => {
    // The state a concurrent write could leave behind. Keeping the earliest
    // rather than the latest means the cover an operator chose first wins,
    // instead of the gallery appearing to change on its own.
    const rows = [
      photo("a", { displayOrder: 0, isPrimary: true }),
      photo("b", { displayOrder: 1, isPrimary: true }),
      photo("c", { displayOrder: 2, isPrimary: true }),
    ]

    await reconcilePrimary(fakeTx(rows), "vehicle-1")

    expect(primaries(rows)).toEqual(["a"])
  })

  it("leaves a correct gallery completely untouched", async () => {
    // Idempotence matters: this runs after every upload and every removal,
    // so a version that "fixed" a healthy gallery would reassign the cover
    // on ordinary operations.
    const rows = [
      photo("a", { displayOrder: 0 }),
      photo("b", { displayOrder: 1, isPrimary: true }),
      photo("c", { displayOrder: 2 }),
    ]

    await reconcilePrimary(fakeTx(rows), "vehicle-1")

    expect(primaries(rows)).toEqual(["b"])
  })

  it("is idempotent when run repeatedly", async () => {
    const rows = [photo("a", { displayOrder: 0 }), photo("b", { displayOrder: 1 })]
    const tx = fakeTx(rows)

    await reconcilePrimary(tx, "vehicle-1")
    await reconcilePrimary(tx, "vehicle-1")
    await reconcilePrimary(tx, "vehicle-1")

    expect(primaries(rows)).toEqual(["a"])
  })

  it("ignores soft-deleted photographs when choosing a main image", async () => {
    // A removed photograph must never be promoted back onto the website to
    // satisfy a counting rule.
    const rows = [
      photo("removed", {
        displayOrder: 0,
        deletedAt: new Date("2026-02-01T00:00:00.000Z"),
      }),
      photo("live", { displayOrder: 1 }),
    ]

    await reconcilePrimary(fakeTx(rows), "vehicle-1")

    expect(primaries(rows)).toEqual(["live"])
    expect(rows[0].isPrimary).toBe(false)
  })

  it("leaves an empty gallery with no main image", async () => {
    // Zero primaries is correct for a vehicle whose photographs have all
    // been removed — there is nothing to promote.
    const rows = [
      photo("gone", { deletedAt: new Date("2026-02-01T00:00:00.000Z") }),
    ]

    await reconcilePrimary(fakeTx(rows), "vehicle-1")

    expect(primaries(rows)).toEqual([])
  })

  it("never touches another vehicle's photographs", async () => {
    // The vehicleId filter is an ownership boundary, not a convenience.
    const rows = [
      photo("mine", { vehicleId: "vehicle-1", displayOrder: 0 }),
      photo("theirs", { vehicleId: "vehicle-2", displayOrder: 0, isPrimary: true }),
    ]

    await reconcilePrimary(fakeTx(rows), "vehicle-1")

    expect(rows.find((r) => r.id === "mine")?.isPrimary).toBe(true)
    expect(rows.find((r) => r.id === "theirs")?.isPrimary).toBe(true)
  })

  it("breaks ties on insertion time when display order collides", async () => {
    // Every photograph defaults to displayOrder 0, so a gallery that has
    // never been arranged is entirely ties. Without the createdAt tiebreak
    // the chosen cover would depend on row order from the database, and a
    // gallery whose main image changes between page loads reads as a bug.
    const rows = [
      photo("later", {
        displayOrder: 0,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
      photo("earlier", {
        displayOrder: 0,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ]

    await reconcilePrimary(fakeTx(rows), "vehicle-1")

    expect(primaries(rows)).toEqual(["earlier"])
  })
})

describe("isSamePhotoSet", () => {
  it("accepts a genuine rearrangement", () => {
    expect(isSamePhotoSet(["c", "a", "b"], ["a", "b", "c"])).toBe(true)
  })

  it("accepts an unchanged order", () => {
    expect(isSamePhotoSet(["a", "b"], ["a", "b"])).toBe(true)
  })

  it("refuses a photograph belonging to another listing", () => {
    // Without this the reorder action would renumber a stranger's row
    // against this vehicle — the classic insecure direct object reference.
    expect(isSamePhotoSet(["a", "b", "intruder"], ["a", "b", "c"])).toBe(false)
  })

  it("refuses an order that drops a photograph", () => {
    // A missing id would leave that photograph stranded at a stale position
    // while everything around it renumbered.
    expect(isSamePhotoSet(["a", "b"], ["a", "b", "c"])).toBe(false)
  })

  it("refuses an order that repeats a photograph", () => {
    // Same length as the stored set, but one id twice and another missing —
    // the case a naive length-plus-membership check waves through.
    expect(isSamePhotoSet(["a", "a", "b"], ["a", "b", "c"])).toBe(false)
  })

  it("refuses extra ids even when all of them are real", () => {
    expect(isSamePhotoSet(["a", "b", "c"], ["a", "b"])).toBe(false)
  })

  it("treats two empty galleries as equal", () => {
    expect(isSamePhotoSet([], [])).toBe(true)
  })
})
