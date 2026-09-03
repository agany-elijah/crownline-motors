import "server-only"

import { recordAuditLog } from "@/lib/audit"
import { MAX_PHOTOS_PER_VEHICLE } from "@/lib/constants/vehicle-photo-options"
import type { AcceptedPhotoMimeType } from "@/lib/constants/vehicle-photo-options"
import { prisma } from "@/lib/prisma"
import { reconcilePrimary } from "@/lib/storage/vehicle-photo-gallery"
import {
  removeVehiclePhotoObjects,
  sniffImageType,
  uploadVehiclePhotoObject,
} from "@/lib/storage/vehicle-media"

/**
 * Storing vehicle photographs.
 *
 * Lives outside the Server Action modules because two of them need it: the
 * uploader on a vehicle's page, and the create-vehicle form, which now
 * carries the first batch of photographs alongside the details. A `"use
 * server"` module cannot export a shared helper — every export there becomes
 * a public endpoint — so the logic belongs here and the actions stay thin.
 *
 * ── The invariant everything here preserves ───────────────────────────
 * A vehicle with at least one live photograph has exactly one primary. Not
 * zero (the marketplace card would have no image to show), and not two (the
 * card would pick one arbitrarily and appear to change on its own).
 *
 * It is maintained at write time rather than derived at read time, because
 * "which photograph represents this vehicle" is a decision an operator makes
 * and must be able to see, not something a query infers. `reconcilePrimary`
 * is the single place that restores it, and every mutation that could
 * disturb it calls that function inside its own transaction.
 */

export interface PreparedPhoto {
  bytes: Uint8Array
  type: AcceptedPhotoMimeType
}

export type PhotoResult<T> =
  | ({ ok: true } & T)
  | { ok: false; message: string }

/**
 * The gallery invariants live in their own dependency-free module so they
 * can be unit-tested directly, and are re-exported here so every existing
 * caller keeps one import for "everything about storing a vehicle photo".
 * See the note at the top of that file for why that mattered enough to
 * split.
 */
export { isSamePhotoSet, reconcilePrimary } from "@/lib/storage/vehicle-photo-gallery"

/**
 * Reads every file and decides what it actually is, before anything is
 * stored.
 *
 * The declared type is ignored entirely — `sniffImageType` reads the file's
 * leading bytes and its answer is what gets written as the stored object's
 * Content-Type. A .jpg that is really an HTML document is rejected here, not
 * discovered when a browser executes it.
 *
 * All-or-nothing on purpose: an operator who selected eight photographs
 * wants eight, and silently dropping the one the sniffer disliked is how a
 * gallery ends up missing a frame nobody notices until a customer asks.
 */
export async function prepareVehiclePhotos(
  files: File[]
): Promise<PhotoResult<{ photos: PreparedPhoto[] }>> {
  const photos: PreparedPhoto[] = []

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = sniffImageType(bytes)

    if (!type) {
      return {
        ok: false,
        message: `“${file.name || "One of those files"}” is not a JPEG, PNG, WebP or AVIF image. Nothing was uploaded.`,
      }
    }

    photos.push({ bytes, type })
  }

  return { ok: true, photos }
}

/** How many more photographs this vehicle can take. */
export async function countLiveVehiclePhotos(vehicleId: string): Promise<number> {
  return prisma.vehiclePhoto.count({ where: { vehicleId, deletedAt: null } })
}

/** The message for a batch that would overflow the per-vehicle ceiling, or
 *  null when it fits. Shared so the uploader and the create form phrase the
 *  same refusal the same way. */
export function capacityRefusal(
  existingCount: number,
  incoming: number
): string | null {
  if (existingCount + incoming <= MAX_PHOTOS_PER_VEHICLE) return null

  const remaining = Math.max(0, MAX_PHOTOS_PER_VEHICLE - existingCount)

  return remaining === 0
    ? `This vehicle already has the maximum of ${MAX_PHOTOS_PER_VEHICLE} photographs. Remove one before adding another.`
    : `Only ${remaining} more photograph${remaining === 1 ? "" : "s"} can be added to this vehicle.`
}

interface StoreOptions {
  vehicleId: string
  referenceNumber: string
  actorId: string
  photos: PreparedPhoto[]
  /**
   * Whether the first photograph in the batch becomes the vehicle's main
   * image, displacing any existing one.
   *
   * True for the create form, where the operator explicitly nominated it.
   * False for the uploader on an existing vehicle, where new photographs
   * join the supporting set and the main image is only chosen by hand — an
   * upload must never silently replace the cover of a published listing.
   */
  firstBecomesPrimary: boolean
}

/**
 * Stores a batch of prepared photographs against a vehicle.
 *
 * ── Order of operations, and why ──────────────────────────────────────
 * Every object is written to storage first, then all rows are written in a
 * single transaction. If the transaction fails, the objects just written are
 * removed.
 *
 * The alternative — a row per file as it uploads — leaves a half-finished
 * gallery behind on any failure, and an operator cannot tell which of the
 * eight they selected actually landed. Uploading first and committing once
 * means the gallery either gains the whole batch or none of it. That is the
 * defect this shape exists to prevent, and it is why nothing below is
 * allowed to succeed partially.
 *
 * An object without a row is inert (nothing references it) and is cleaned
 * up; a row without an object would render as a broken image on the public
 * site, which is why the ordering is this way round and not the other.
 */
export async function storeVehiclePhotos(
  options: StoreOptions
): Promise<PhotoResult<{ count: number }>> {
  const { vehicleId, referenceNumber, actorId, photos, firstBecomesPrimary } =
    options

  if (photos.length === 0) return { ok: true, count: 0 }

  const uploaded: string[] = []

  try {
    for (const photo of photos) {
      const object = await uploadVehiclePhotoObject(
        vehicleId,
        photo.bytes,
        photo.type
      )
      uploaded.push(object.storagePath)
    }

    await prisma.$transaction(async (tx) => {
      /**
       * The per-vehicle ceiling is re-checked here, inside the transaction.
       *
       * The caller checks it too, before uploading, so an operator is told
       * early rather than after sending twelve megabytes. But that check is
       * a read followed several seconds later by a write, and two uploads
       * running together would both pass it and both commit — leaving a
       * gallery over the limit that nothing afterwards would correct.
       *
       * Throwing rather than returning is what makes this safe: the catch
       * below removes the objects just uploaded, so a refused batch leaves
       * neither rows nor orphaned files.
       */
      const alreadyStored = await tx.vehiclePhoto.count({
        where: { vehicleId, deletedAt: null },
      })

      if (alreadyStored + uploaded.length > MAX_PHOTOS_PER_VEHICLE) {
        throw new PhotoCapacityError(
          capacityRefusal(alreadyStored, uploaded.length) ??
            `This vehicle can hold at most ${MAX_PHOTOS_PER_VEHICLE} photographs.`
        )
      }

      /**
       * Positions are allocated here, not before the uploads.
       *
       * Reading the current maximum and then spending several seconds
       * sending files leaves a wide window in which a second upload reads
       * the same maximum, and both batches land on the same positions.
       * Inside the transaction the window is the width of two statements.
       *
       * Appended after whatever is already there, so an upload never
       * reshuffles an arrangement the operator has already made.
       */
      const nextOrderStart = await tx.vehiclePhoto
        .aggregate({
          where: { vehicleId, deletedAt: null },
          _max: { displayOrder: true },
        })
        .then((result) => (result._max.displayOrder ?? -1) + 1)

      await tx.vehiclePhoto.createMany({
        data: uploaded.map((storagePath, index) => ({
          vehicleId,
          storagePath,
          displayOrder: nextOrderStart + index,
          // Left to reconcilePrimary below, so "the gallery has exactly one
          // main image" is one rule in one place rather than a condition
          // duplicated across every action that adds a photograph.
          isPrimary: false,
        })),
      })

      if (firstBecomesPrimary) {
        const first = await tx.vehiclePhoto.findFirst({
          where: { vehicleId, deletedAt: null, storagePath: uploaded[0] },
          select: { id: true },
        })

        if (first) {
          await tx.vehiclePhoto.updateMany({
            where: { vehicleId, deletedAt: null, isPrimary: true },
            data: { isPrimary: false },
          })
          await tx.vehiclePhoto.update({
            where: { id: first.id },
            data: { isPrimary: true },
          })
        }
      }

      await reconcilePrimary(tx, vehicleId)

      await recordAuditLog(
        {
          actorId,
          action: "VEHICLE_PHOTOS_UPLOADED",
          entityType: "Vehicle",
          entityId: vehicleId,
          metadata: { referenceNumber, count: uploaded.length },
        },
        tx
      )
    })
  } catch (error) {
    await removeVehiclePhotoObjects(uploaded)

    // A refused batch is a normal outcome with a message worth showing, not
    // a fault. Logging it as an error would bury the real ones.
    if (error instanceof PhotoCapacityError) {
      return { ok: false, message: error.message }
    }

    console.error("[vehicle-photo] upload failed", error)

    return {
      ok: false,
      message: "Those photographs could not be saved. Please try again.",
    }
  }

  return { ok: true, count: photos.length }
}

/** A batch that would take a vehicle past `MAX_PHOTOS_PER_VEHICLE`. Carries
 *  the operator-facing message so the caller does not have to rebuild it. */
class PhotoCapacityError extends Error {}
