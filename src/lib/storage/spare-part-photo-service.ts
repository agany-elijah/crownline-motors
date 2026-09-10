import "server-only"

import { recordAuditLog } from "@/lib/audit"
import {
  MAX_PHOTOS_PER_SPARE_PART,
  type AcceptedPhotoMimeType,
} from "@/lib/constants/spare-part-photo-options"
import { prisma } from "@/lib/prisma"
import {
  removeSparePartPhotoObjects,
  sniffImageType,
  uploadSparePartPhotoObject,
} from "@/lib/storage/spare-part-media"
import { reconcileSparePartPrimary } from "@/lib/storage/spare-part-photo-gallery"

/**
 * Storing spare-part photographs.
 *
 * Lives outside the Server Action modules because two of them need it: the
 * uploader on a part's page, and the create-part form, which carries the
 * first batch of photographs alongside the details. A `"use server"` module
 * cannot export a shared helper — every export there becomes a public
 * endpoint — so the logic belongs here and the actions stay thin.
 *
 * A deliberate parallel of `vehicle-photo-service.ts`, including the order of
 * operations and the failure handling. See that file for the long-form
 * reasoning; the notes here cover only what differs.
 *
 * ── The invariant everything here preserves ───────────────────────────
 * A part with at least one live photograph has exactly one primary. Not zero
 * (the catalogue card would have no image to show), and not two (the card
 * would pick one arbitrarily and appear to change on its own). It is
 * maintained at write time, and `reconcileSparePartPrimary` is the single
 * place that restores it.
 */

export interface PreparedPartPhoto {
  bytes: Uint8Array
  type: AcceptedPhotoMimeType
}

export type PartPhotoResult<T> = ({ ok: true } & T) | { ok: false; message: string }

/** Re-exported so callers have one import for "everything about storing a
 *  part photo". `isSamePhotoSet` is genuinely generic — it compares two lists
 *  of ids and knows nothing about either model — so it is shared rather than
 *  mirrored. */
export { isSamePhotoSet } from "@/lib/storage/vehicle-photo-gallery"
export { reconcileSparePartPrimary } from "@/lib/storage/spare-part-photo-gallery"

/**
 * Reads every file and decides what it actually is, before anything is
 * stored.
 *
 * The declared type is ignored entirely — `sniffImageType` reads the file's
 * leading bytes and its answer is what gets written as the stored object's
 * Content-Type. A .jpg that is really an HTML document is rejected here, not
 * discovered when a browser executes it.
 *
 * All-or-nothing on purpose: an operator who selected six photographs wants
 * six, and silently dropping the one the sniffer disliked is how a gallery
 * ends up missing a frame nobody notices until a customer asks.
 */
export async function prepareSparePartPhotos(
  files: File[]
): Promise<PartPhotoResult<{ photos: PreparedPartPhoto[] }>> {
  const photos: PreparedPartPhoto[] = []

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

/** How many live photographs this part already holds. */
export async function countLiveSparePartPhotos(sparePartId: string): Promise<number> {
  return prisma.sparePartPhoto.count({ where: { sparePartId, deletedAt: null } })
}

/** The message for a batch that would overflow the per-part ceiling, or null
 *  when it fits. Shared so the uploader and the create form phrase the same
 *  refusal the same way. */
export function partCapacityRefusal(
  existingCount: number,
  incoming: number
): string | null {
  if (existingCount + incoming <= MAX_PHOTOS_PER_SPARE_PART) return null

  const remaining = Math.max(0, MAX_PHOTOS_PER_SPARE_PART - existingCount)

  return remaining === 0
    ? `This part already has the maximum of ${MAX_PHOTOS_PER_SPARE_PART} photographs. Remove one before adding another.`
    : `Only ${remaining} more photograph${remaining === 1 ? "" : "s"} can be added to this part.`
}

interface StorePartPhotoOptions {
  sparePartId: string
  referenceNumber: string
  actorId: string
  photos: PreparedPartPhoto[]
  /**
   * Whether the first photograph in the batch becomes the part's main image,
   * displacing any existing one.
   *
   * True for the create form, where the operator explicitly nominated it.
   * False for the uploader on an existing part, where new photographs join
   * the supporting set and the main image is only chosen by hand — an upload
   * must never silently replace the cover of a published listing.
   */
  firstBecomesPrimary: boolean
}

/**
 * Stores a batch of prepared photographs against a part.
 *
 * ── Order of operations, and why ──────────────────────────────────────
 * Every object is written to storage first, then all rows are written in a
 * single transaction. If the transaction fails, the objects just written are
 * removed.
 *
 * The alternative — a row per file as it uploads — leaves a half-finished
 * gallery behind on any failure, and an operator cannot tell which of the six
 * they selected actually landed. An object without a row is inert and is
 * cleaned up; a row without an object would render as a broken image on the
 * public site, which is why the ordering is this way round.
 */
export async function storeSparePartPhotos(
  options: StorePartPhotoOptions
): Promise<PartPhotoResult<{ count: number }>> {
  const { sparePartId, referenceNumber, actorId, photos, firstBecomesPrimary } =
    options

  if (photos.length === 0) return { ok: true, count: 0 }

  const uploaded: string[] = []

  try {
    for (const photo of photos) {
      const object = await uploadSparePartPhotoObject(
        sparePartId,
        photo.bytes,
        photo.type
      )
      uploaded.push(object.storagePath)
    }

    await prisma.$transaction(async (tx) => {
      /**
       * The per-part ceiling is re-checked here, inside the transaction.
       *
       * The caller checks it too, before uploading, so an operator is told
       * early rather than after sending several megabytes. But that check is
       * a read followed seconds later by a write, and two uploads running
       * together would both pass it and both commit — leaving a gallery over
       * the limit that nothing afterwards would correct.
       *
       * Throwing rather than returning is what makes this safe: the catch
       * below removes the objects just uploaded, so a refused batch leaves
       * neither rows nor orphaned files.
       */
      const alreadyStored = await tx.sparePartPhoto.count({
        where: { sparePartId, deletedAt: null },
      })

      if (alreadyStored + uploaded.length > MAX_PHOTOS_PER_SPARE_PART) {
        throw new PartPhotoCapacityError(
          partCapacityRefusal(alreadyStored, uploaded.length) ??
            `This part can hold at most ${MAX_PHOTOS_PER_SPARE_PART} photographs.`
        )
      }

      /**
       * Positions are allocated here, not before the uploads — reading the
       * current maximum and then spending seconds sending files leaves a wide
       * window in which a second upload reads the same maximum and both
       * batches land on the same positions.
       *
       * Appended after whatever is already there, so an upload never
       * reshuffles an arrangement the operator has already made.
       */
      const nextOrderStart = await tx.sparePartPhoto
        .aggregate({
          where: { sparePartId, deletedAt: null },
          _max: { displayOrder: true },
        })
        .then((result) => (result._max.displayOrder ?? -1) + 1)

      await tx.sparePartPhoto.createMany({
        data: uploaded.map((storagePath, index) => ({
          sparePartId,
          storagePath,
          displayOrder: nextOrderStart + index,
          // Left to reconcileSparePartPrimary below, so "the gallery has
          // exactly one main image" is one rule in one place rather than a
          // condition duplicated across every action that adds a photograph.
          isPrimary: false,
        })),
      })

      if (firstBecomesPrimary) {
        const first = await tx.sparePartPhoto.findFirst({
          where: { sparePartId, deletedAt: null, storagePath: uploaded[0] },
          select: { id: true },
        })

        if (first) {
          await tx.sparePartPhoto.updateMany({
            where: { sparePartId, deletedAt: null, isPrimary: true },
            data: { isPrimary: false },
          })
          await tx.sparePartPhoto.update({
            where: { id: first.id },
            data: { isPrimary: true },
          })
        }
      }

      await reconcileSparePartPrimary(tx, sparePartId)

      await recordAuditLog(
        {
          actorId,
          action: "SPARE_PART_PHOTOS_UPLOADED",
          entityType: "SparePart",
          entityId: sparePartId,
          metadata: { referenceNumber, count: uploaded.length },
        },
        tx
      )
    })
  } catch (error) {
    await removeSparePartPhotoObjects(uploaded)

    // A refused batch is a normal outcome with a message worth showing, not a
    // fault. Logging it as an error would bury the real ones.
    if (error instanceof PartPhotoCapacityError) {
      return { ok: false, message: error.message }
    }

    console.error("[spare-part-photo] upload failed", error)

    return {
      ok: false,
      message: "Those photographs could not be saved. Please try again.",
    }
  }

  return { ok: true, count: photos.length }
}

/** A batch that would take a part past `MAX_PHOTOS_PER_SPARE_PART`. Carries
 *  the operator-facing message so the caller does not have to rebuild it. */
class PartPhotoCapacityError extends Error {}
