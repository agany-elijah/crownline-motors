import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Prisma } from "@/generated/prisma/client"
import { MAX_PHOTOS_PER_VEHICLE } from "@/lib/constants/vehicle-photo-options"

/**
 * The storing half of the photograph pipeline.
 *
 * `vehicle-photo-gallery.test.ts` covers the two pure invariants
 * (`reconcilePrimary`, `isSamePhotoSet`). This file covers the code around
 * them — the part that decides what gets uploaded, in what order the rows
 * land, which photograph ends up as the main image, and what is cleaned up
 * when something fails half way.
 *
 * ── Why mocks rather than a database ──────────────────────────────────
 * Every behaviour asserted here is a decision the function makes, not a
 * query the database answers: append after the highest existing position,
 * re-check the ceiling inside the transaction, promote the first of a batch
 * only when told to, remove every uploaded object when the write is refused.
 * A fake transaction client models exactly the statements the function
 * issues, so a change to those statements shows up as a failing test rather
 * than passing against a fake that quietly ignores it.
 *
 * `reconcilePrimary` is deliberately NOT mocked — the fake runs the real
 * one, so "exactly one main image per live gallery" is asserted end to end
 * through the same code the Server Actions call.
 */

/* ── The doubles ─────────────────────────────────────────────────── */

interface FakePhoto {
  id: string
  vehicleId: string
  storagePath: string
  isPrimary: boolean
  displayOrder: number
  createdAt: Date
  deletedAt: Date | null
}

/** Rows the fake transaction reads and writes. Reset before every test. */
let rows: FakePhoto[] = []
/** Object paths currently "in storage", in upload order. */
let stored: string[] = []
/** Paths handed to the cleanup call, if it was made. */
let removed: string[] = []
/** Audit entries written inside the transaction. */
let audit: { action: string; metadata?: unknown }[] = []

/** Fails the next N uploads instead of storing them. */
let uploadFailsAfter = Number.POSITIVE_INFINITY
/** Makes the transaction body's final statement throw, simulating a DB fault. */
let transactionFails = false

let nextId = 0

function live(vehicleId: string): FakePhoto[] {
  return rows.filter((row) => row.vehicleId === vehicleId && row.deletedAt === null)
}

/**
 * Just enough of `Prisma.TransactionClient` for `storeVehiclePhotos` and the
 * real `reconcilePrimary` it calls.
 *
 * Strict about the shapes it understands on purpose: a permissive fake that
 * ignored an unfamiliar `where` clause would keep passing while the real
 * query changed meaning.
 */
function fakeTx(): Prisma.TransactionClient {
  const tx = {
    vehiclePhoto: {
      count: async ({ where }: { where: { vehicleId: string; deletedAt: null } }) =>
        live(where.vehicleId).length,

      aggregate: async ({ where }: { where: { vehicleId: string; deletedAt: null } }) => ({
        _max: {
          displayOrder: live(where.vehicleId).reduce<number | null>(
            (max, row) => (max === null || row.displayOrder > max ? row.displayOrder : max),
            null
          ),
        },
      }),

      createMany: async ({
        data,
      }: {
        data: {
          vehicleId: string
          storagePath: string
          displayOrder: number
          isPrimary: boolean
        }[]
      }) => {
        for (const row of data) {
          rows.push({
            id: `photo-${(nextId += 1)}`,
            createdAt: new Date(2026, 0, 1, 0, 0, nextId),
            deletedAt: null,
            ...row,
          })
        }

        if (transactionFails) throw new Error("connection reset")

        return { count: data.length }
      },

      findFirst: async ({
        where,
      }: {
        where: { vehicleId: string; deletedAt: null; storagePath: string }
      }) => {
        const row = live(where.vehicleId).find(
          (candidate) => candidate.storagePath === where.storagePath
        )
        return row ? { id: row.id } : null
      },

      findMany: async ({ where }: { where: { vehicleId: string; deletedAt: null } }) =>
        live(where.vehicleId)
          .slice()
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
          id?: { not: string }
        }
        data: { isPrimary: boolean }
      }) => {
        let count = 0

        for (const row of live(where.vehicleId)) {
          if (row.isPrimary !== where.isPrimary) continue
          if (where.id && row.id === where.id.not) continue

          row.isPrimary = data.isPrimary
          count += 1
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
      fn(fakeTx()),
    vehiclePhoto: {
      count: async ({ where }: { where: { vehicleId: string; deletedAt: null } }) =>
        live(where.vehicleId).length,
    },
  },
}))

vi.mock("@/lib/audit", () => ({
  recordAuditLog: async (entry: { action: string; metadata?: unknown }) => {
    audit.push(entry)
  },
}))

/**
 * The storage layer is stubbed, but `sniffImageType` is re-exported from its
 * own dependency-free module rather than faked: content sniffing is the
 * check that decides what `prepareVehiclePhotos` accepts, and a stub of it
 * would leave the tests below asserting nothing about the real rule.
 */
vi.mock("@/lib/storage/vehicle-media", async () => {
  const { sniffImageType } = await import("@/lib/storage/image-signature")

  return {
    sniffImageType,
    uploadVehiclePhotoObject: async (vehicleId: string) => {
      if (stored.length >= uploadFailsAfter) {
        throw new Error("Vehicle photo upload failed: network")
      }

      const storagePath = `${vehicleId}/object-${stored.length + 1}.webp`
      stored.push(storagePath)
      return { storagePath, contentType: "image/webp", sizeBytes: 1024 }
    },
    removeVehiclePhotoObjects: async (paths: string[]) => {
      removed = [...paths]
      stored = stored.filter((path) => !paths.includes(path))
    },
  }
})

const {
  capacityRefusal,
  prepareVehiclePhotos,
  storeVehiclePhotos,
} = await import("@/lib/storage/vehicle-photo-service")

/* ── Fixtures ────────────────────────────────────────────────────── */

/** A minimal but genuine JPEG: SOI marker followed by padding. */
function jpegFile(name = "front.jpg"): File {
  const bytes = new Uint8Array(32)
  bytes.set([0xff, 0xd8, 0xff, 0xe0])
  return new File([bytes], name, { type: "image/jpeg" })
}

/** A genuine PNG signature. */
function pngFile(name = "rear.png"): File {
  const bytes = new Uint8Array(32)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return new File([bytes], name, { type: "image/png" })
}

/** An HTML document wearing a .jpg extension and a JPEG Content-Type. */
function disguisedFile(name = "not-a-car.jpg"): File {
  return new File(["<!doctype html><script>alert(1)</script>"], name, {
    type: "image/jpeg",
  })
}

function existingPhoto(overrides: Partial<FakePhoto> = {}): FakePhoto {
  const id = `existing-${(nextId += 1)}`

  return {
    id,
    vehicleId: "vehicle-1",
    storagePath: `vehicle-1/${id}.webp`,
    isPrimary: false,
    displayOrder: 0,
    createdAt: new Date(2026, 0, 1),
    deletedAt: null,
    ...overrides,
  }
}

const BATCH = {
  vehicleId: "vehicle-1",
  referenceNumber: "CLM-V-2026-000123",
  actorId: "admin-1",
}

/** One prepared photograph, as `prepareVehiclePhotos` would return it. */
const PREPARED = { bytes: new Uint8Array([0xff, 0xd8, 0xff]), type: "image/jpeg" } as const

function gallery(): { id: string; order: number; primary: boolean }[] {
  return live("vehicle-1")
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((row) => ({ id: row.id, order: row.displayOrder, primary: row.isPrimary }))
}

beforeEach(() => {
  rows = []
  stored = []
  removed = []
  audit = []
  uploadFailsAfter = Number.POSITIVE_INFINITY
  transactionFails = false
  nextId = 0
})

/* ── prepareVehiclePhotos ────────────────────────────────────────── */

describe("prepareVehiclePhotos", () => {
  it("reads each file's real type rather than trusting what it claims", async () => {
    const result = await prepareVehiclePhotos([jpegFile(), pngFile()])

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.photos.map((photo) => photo.type)).toEqual([
      "image/jpeg",
      "image/png",
    ])
  })

  it("refuses the whole batch when one file is not an image, and names it", async () => {
    const result = await prepareVehiclePhotos([jpegFile(), disguisedFile(), pngFile()])

    expect(result.ok).toBe(false)
    if (result.ok) return

    // All-or-nothing: an operator who selected eight photographs wants
    // eight, and silently dropping one is how a gallery ends up missing a
    // frame nobody notices until a customer asks.
    expect(result.message).toContain("not-a-car.jpg")
    expect(result.message).toContain("Nothing was uploaded")
  })

  it("accepts an empty selection, which the create form relies on", async () => {
    const result = await prepareVehiclePhotos([])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.photos).toEqual([])
  })
})

/* ── capacityRefusal ─────────────────────────────────────────────── */

describe("capacityRefusal", () => {
  it("allows a batch that lands exactly on the ceiling", () => {
    expect(capacityRefusal(MAX_PHOTOS_PER_VEHICLE - 3, 3)).toBeNull()
  })

  it("names how many more will fit when a batch overshoots", () => {
    const message = capacityRefusal(MAX_PHOTOS_PER_VEHICLE - 2, 5)

    expect(message).toContain("Only 2 more photographs")
  })

  it("says one photograph, singular, when a single slot is left", () => {
    const message = capacityRefusal(MAX_PHOTOS_PER_VEHICLE - 1, 4)

    expect(message).toContain("Only 1 more photograph can")
  })

  it("tells an operator to remove one when the vehicle is full", () => {
    const message = capacityRefusal(MAX_PHOTOS_PER_VEHICLE, 1)

    expect(message).toContain("maximum")
    expect(message).toContain("Remove one")
  })
})

/* ── storeVehiclePhotos ──────────────────────────────────────────── */

describe("storeVehiclePhotos", () => {
  it("does nothing at all for an empty batch", async () => {
    const result = await storeVehiclePhotos({
      ...BATCH,
      photos: [],
      firstBecomesPrimary: true,
    })

    expect(result).toEqual({ ok: true, count: 0 })
    expect(stored).toEqual([])
    expect(rows).toEqual([])
    expect(audit).toEqual([])
  })

  it("stores every object, then writes the rows in one transaction", async () => {
    const result = await storeVehiclePhotos({
      ...BATCH,
      photos: [PREPARED, PREPARED, PREPARED],
      firstBecomesPrimary: true,
    })

    expect(result).toEqual({ ok: true, count: 3 })
    expect(stored).toHaveLength(3)
    expect(live("vehicle-1")).toHaveLength(3)
    expect(removed).toEqual([])
  })

  it("appends after the highest existing position instead of renumbering", async () => {
    rows.push(
      existingPhoto({ displayOrder: 0, isPrimary: true }),
      existingPhoto({ displayOrder: 1 })
    )

    await storeVehiclePhotos({
      ...BATCH,
      photos: [PREPARED, PREPARED],
      firstBecomesPrimary: false,
    })

    // An upload must never reshuffle an arrangement the operator has made.
    expect(gallery().map((photo) => photo.order)).toEqual([0, 1, 2, 3])
  })

  it("makes the first of the batch the main image when the caller says so", async () => {
    rows.push(existingPhoto({ displayOrder: 0, isPrimary: true }))
    const displaced = rows[0].id

    await storeVehiclePhotos({
      ...BATCH,
      photos: [PREPARED, PREPARED],
      firstBecomesPrimary: true,
    })

    const primaries = gallery().filter((photo) => photo.primary)

    expect(primaries).toHaveLength(1)
    expect(primaries[0].id).not.toBe(displaced)
    expect(primaries[0].order).toBe(1)
  })

  it("leaves a published listing's cover alone on an ordinary upload", async () => {
    rows.push(existingPhoto({ displayOrder: 0, isPrimary: true }))
    const cover = rows[0].id

    await storeVehiclePhotos({
      ...BATCH,
      photos: [PREPARED, PREPARED],
      firstBecomesPrimary: false,
    })

    expect(gallery().filter((photo) => photo.primary).map((p) => p.id)).toEqual([cover])
  })

  it("still gives an empty gallery a main image when none was nominated", async () => {
    await storeVehiclePhotos({
      ...BATCH,
      photos: [PREPARED, PREPARED],
      firstBecomesPrimary: false,
    })

    // reconcilePrimary's job: a gallery with images and no main one has
    // nothing to show on the vehicle card.
    const primaries = gallery().filter((photo) => photo.primary)

    expect(primaries).toHaveLength(1)
    expect(primaries[0].order).toBe(0)
  })

  it("never leaves a live gallery with two main images", async () => {
    rows.push(
      existingPhoto({ displayOrder: 0, isPrimary: true }),
      existingPhoto({ displayOrder: 1, isPrimary: true })
    )

    await storeVehiclePhotos({
      ...BATCH,
      photos: [PREPARED],
      firstBecomesPrimary: false,
    })

    expect(gallery().filter((photo) => photo.primary)).toHaveLength(1)
  })

  it("records the upload in the audit trail with its count", async () => {
    await storeVehiclePhotos({
      ...BATCH,
      photos: [PREPARED, PREPARED],
      firstBecomesPrimary: false,
    })

    expect(audit).toEqual([
      expect.objectContaining({
        action: "VEHICLE_PHOTOS_UPLOADED",
        metadata: { referenceNumber: BATCH.referenceNumber, count: 2 },
      }),
    ])
  })

  it("refuses a batch that would breach the ceiling and leaves no orphans", async () => {
    for (let index = 0; index < MAX_PHOTOS_PER_VEHICLE; index += 1) {
      rows.push(existingPhoto({ displayOrder: index, isPrimary: index === 0 }))
    }

    const result = await storeVehiclePhotos({
      ...BATCH,
      photos: [PREPARED],
      firstBecomesPrimary: false,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return

    // The operator-facing refusal, not a generic fault: this is a normal
    // outcome with a message worth showing.
    expect(result.message).toContain("maximum")
    // Every object uploaded before the refusal is removed again.
    expect(stored).toEqual([])
    expect(removed).toHaveLength(1)
    expect(live("vehicle-1")).toHaveLength(MAX_PHOTOS_PER_VEHICLE)
  })

  it("cleans up the objects already uploaded when a later one fails", async () => {
    uploadFailsAfter = 2

    const result = await storeVehiclePhotos({
      ...BATCH,
      photos: [PREPARED, PREPARED, PREPARED],
      firstBecomesPrimary: true,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.message).toBe(
      "Those photographs could not be saved. Please try again."
    )
    expect(removed).toHaveLength(2)
    expect(stored).toEqual([])
    // Nothing half-written: a row without an object would render as a
    // broken image on the public site.
    expect(rows).toEqual([])
  })

  it("removes every uploaded object when the database write fails", async () => {
    transactionFails = true

    const result = await storeVehiclePhotos({
      ...BATCH,
      photos: [PREPARED, PREPARED],
      firstBecomesPrimary: true,
    })

    expect(result.ok).toBe(false)
    expect(removed).toHaveLength(2)
    expect(stored).toEqual([])
  })
})
