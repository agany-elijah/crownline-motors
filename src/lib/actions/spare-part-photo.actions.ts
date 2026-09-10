"use server"

import { revalidatePath } from "next/cache"

import { recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { prisma } from "@/lib/prisma"
import {
  countLiveSparePartPhotos,
  isSamePhotoSet,
  partCapacityRefusal,
  prepareSparePartPhotos,
  reconcileSparePartPrimary,
  storeSparePartPhotos,
} from "@/lib/storage/spare-part-photo-service"
import {
  sparePartPhotoOrderSchema,
  sparePartPhotoRefSchema,
  sparePartPhotoUploadSchema,
} from "@/lib/validations/spare-part-photo.schema"

/**
 * Spare-part photograph management.
 *
 * Follows the order every Server Action in this codebase follows — validate,
 * authorise, then write with an audit record in one transaction. The storing
 * itself lives in `@/lib/storage/spare-part-photo-service`, which the
 * create-part action shares; see the notes there for why the objects are
 * written before the rows and why a batch is all-or-nothing.
 *
 * Alternative text is deliberately not editable here, unlike on the vehicle
 * side. `SparePartPhoto.altText` exists and every read carries it, but the
 * public gallery generates a truthful description from the part and the
 * photograph's position, and asking an operator to write ten of those per
 * listing is how a field ends up filled with "image1". If a listing ever
 * genuinely needs precise wording — a diagram, a set of markings — the column
 * and the read path are already there for an action to write to.
 */

export interface SparePartPhotoActionState {
  status: "idle" | "success" | "error"
  message?: string
}

const IDLE: SparePartPhotoActionState = { status: "idle" }

function fail(message: string): SparePartPhotoActionState {
  return { status: "error", message }
}

function succeed(message: string): SparePartPhotoActionState {
  return { status: "success", message }
}

/**
 * Every surface that shows this part's photography, refreshed together.
 *
 * The public pages are included — unlike the vehicle equivalent, whose
 * catalogue did not exist when it was written. A cover image changed in the
 * dashboard and not reflected on the catalogue card is the exact failure the
 * brief's "publish and it appears" requirement is about.
 */
function revalidateSparePart(sparePartId: string, slug: string): void {
  revalidatePath(`${ADMIN_BASE_PATH}/spare-parts`)
  revalidatePath(`${ADMIN_BASE_PATH}/spare-parts/${sparePartId}`)
  revalidatePath("/spare-parts")
  revalidatePath(`/spare-parts/${slug}`)
}

/**
 * Loads a photograph and proves it belongs to the part named in the request.
 *
 * The `sparePartId` in the where-clause is the authorisation check, not a
 * convenience: without it, a photo id belonging to any other listing would be
 * edited or deleted happily by anyone who could guess one.
 */
async function findOwnedPhoto(sparePartId: string, photoId: string) {
  return prisma.sparePartPhoto.findFirst({
    where: { id: photoId, sparePartId, deletedAt: null },
    select: {
      id: true,
      isPrimary: true,
      displayOrder: true,
      storagePath: true,
      sparePart: { select: { referenceNumber: true, slug: true } },
    },
  })
}

/**
 * Adds photographs to an existing part.
 *
 * New photographs always join the supporting set, never the main image —
 * promoting one is an explicit choice made from the gallery. An upload that
 * silently replaced the cover of a published listing would change what
 * customers see without anyone deciding to.
 *
 * The exception is a part with no live photographs at all, where
 * `reconcileSparePartPrimary` promotes the first: a gallery with images and
 * no main one has nothing to show on the card.
 */
export async function uploadSparePartPhotosAction(
  _prevState: SparePartPhotoActionState,
  formData: FormData
): Promise<SparePartPhotoActionState> {
  const parsed = sparePartPhotoUploadSchema.safeParse({
    sparePartId: formData.get("sparePartId"),
    files: formData.getAll("files"),
  })

  if (!parsed.success) {
    // One message rather than field errors: this form has a single meaningful
    // field, and the failure is always about the files.
    return fail(
      parsed.error.issues[0]?.message ?? "Those files could not be accepted."
    )
  }

  const auth = await authorizePermission("sparePart:write")
  if (!auth.ok) return fail(auth.message)

  const { sparePartId, files } = parsed.data

  const part = await prisma.sparePart.findUnique({
    where: { id: sparePartId },
    select: { id: true, referenceNumber: true, slug: true },
  })

  if (!part) return fail("That part no longer exists.")

  const refusal = partCapacityRefusal(
    await countLiveSparePartPhotos(sparePartId),
    files.length
  )
  if (refusal) return fail(refusal)

  const prepared = await prepareSparePartPhotos(files)
  if (!prepared.ok) return fail(prepared.message)

  const stored = await storeSparePartPhotos({
    sparePartId,
    referenceNumber: part.referenceNumber,
    actorId: auth.admin.id,
    photos: prepared.photos,
    firstBecomesPrimary: false,
  })

  if (!stored.ok) return fail(stored.message)

  revalidateSparePart(sparePartId, part.slug)

  return succeed(
    stored.count === 1 ? "Photograph added." : `${stored.count} photographs added.`
  )
}

/**
 * Rearranges a part's gallery.
 *
 * The client submits the complete ordered list, and the server accepts it
 * only if it is a permutation of exactly what is stored. That is what makes
 * this safe to expose: a request naming a photograph from another listing, or
 * omitting one, or repeating one, changes nothing — there is no partial
 * application. It also makes the action idempotent, so a double submit leaves
 * the same gallery rather than shuffling it again.
 *
 * `isPrimary` is deliberately untouched. The main image is a separate
 * decision with its own action, and the read ordering floats it to the front
 * regardless of `displayOrder`, so reordering the supporting images can never
 * displace the cover of a published listing.
 */
export async function reorderSparePartPhotosAction(
  _prevState: SparePartPhotoActionState,
  formData: FormData
): Promise<SparePartPhotoActionState> {
  const parsed = sparePartPhotoOrderSchema.safeParse({
    sparePartId: formData.get("sparePartId"),
    photoIds: formData.getAll("photoIds"),
  })

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That order is not valid.")
  }

  const auth = await authorizePermission("sparePart:write")
  if (!auth.ok) return fail(auth.message)

  const { sparePartId, photoIds } = parsed.data

  const part = await prisma.sparePart.findUnique({
    where: { id: sparePartId },
    select: { referenceNumber: true, slug: true },
  })

  if (!part) return fail("That part no longer exists.")

  try {
    await prisma.$transaction(async (tx) => {
      /**
       * Read inside the transaction, so the set being compared is the set
       * being written. Reading first and writing after would let a concurrent
       * upload or deletion land in between, and the permutation check would
       * then be vouching for a gallery that no longer exists.
       */
      const live = await tx.sparePartPhoto.findMany({
        where: { sparePartId, deletedAt: null },
        select: { id: true },
      })

      if (
        !isSamePhotoSet(
          photoIds,
          live.map((photo) => photo.id)
        )
      ) {
        // Thrown rather than returned: this is inside the transaction, and
        // returning would commit an empty one.
        throw new StalePartPhotoOrderError()
      }

      /**
       * Positions are rewritten from zero rather than patched — a gallery
       * that has had photographs added and removed accumulates gaps, and
       * renumbering makes the stored order match exactly what the operator
       * arranged.
       *
       * Sequential, not `Promise.all`: an interactive transaction is a single
       * pinned connection, and firing its statements concurrently is how a
       * Prisma transaction ends up interleaved or deadlocked. Ten trivial
       * primary-key writes is the ceiling here.
       */
      for (const [index, photoId] of photoIds.entries()) {
        await tx.sparePartPhoto.update({
          where: { id: photoId },
          data: { displayOrder: index },
        })
      }

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "SPARE_PART_PHOTOS_REORDERED",
          entityType: "SparePart",
          entityId: sparePartId,
          metadata: {
            referenceNumber: part.referenceNumber,
            count: photoIds.length,
          },
        },
        tx
      )
    })
  } catch (error) {
    if (error instanceof StalePartPhotoOrderError) {
      return fail(
        "The photographs changed while you were arranging them. Reload the page and try again."
      )
    }

    console.error("[spare-part-photo] failed to reorder photographs", error)
    return fail("Could not save that order. Please try again.")
  }

  revalidateSparePart(sparePartId, part.slug)

  return succeed("Order saved.")
}

/** Signals that a submitted order no longer matches the stored gallery. */
class StalePartPhotoOrderError extends Error {}

/** Makes one photograph the part's main image. */
export async function setPrimarySparePartPhotoAction(
  _prevState: SparePartPhotoActionState,
  formData: FormData
): Promise<SparePartPhotoActionState> {
  const parsed = sparePartPhotoRefSchema.safeParse({
    sparePartId: formData.get("sparePartId"),
    photoId: formData.get("photoId"),
  })

  if (!parsed.success) return fail("That photograph is not valid.")

  const auth = await authorizePermission("sparePart:write")
  if (!auth.ok) return fail(auth.message)

  const { sparePartId, photoId } = parsed.data
  const photo = await findOwnedPhoto(sparePartId, photoId)

  if (!photo) return fail("That photograph no longer exists.")
  if (photo.isPrimary) return IDLE

  try {
    await prisma.$transaction(async (tx) => {
      await tx.sparePartPhoto.updateMany({
        where: { sparePartId, deletedAt: null, isPrimary: true },
        data: { isPrimary: false },
      })

      await tx.sparePartPhoto.update({
        where: { id: photoId },
        data: { isPrimary: true },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "SPARE_PART_PRIMARY_PHOTO_CHANGED",
          entityType: "SparePart",
          entityId: sparePartId,
          metadata: {
            referenceNumber: photo.sparePart.referenceNumber,
            photoId,
          },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[spare-part-photo] failed to set main photograph", error)
    return fail("Could not change the main image. Please try again.")
  }

  revalidateSparePart(sparePartId, photo.sparePart.slug)

  return succeed("Main image updated.")
}

/**
 * Removes a photograph from the gallery.
 *
 * A soft delete: `deletedAt` is stamped and the stored object is left where
 * it is. Sourced photography is often impossible to obtain again, and every
 * read filters on `deletedAt`, so the photograph disappears from the site and
 * the dashboard immediately while remaining recoverable.
 */
export async function deleteSparePartPhotoAction(
  _prevState: SparePartPhotoActionState,
  formData: FormData
): Promise<SparePartPhotoActionState> {
  const parsed = sparePartPhotoRefSchema.safeParse({
    sparePartId: formData.get("sparePartId"),
    photoId: formData.get("photoId"),
  })

  if (!parsed.success) return fail("That photograph is not valid.")

  const auth = await authorizePermission("sparePart:write")
  if (!auth.ok) return fail(auth.message)

  const { sparePartId, photoId } = parsed.data
  const photo = await findOwnedPhoto(sparePartId, photoId)

  if (!photo) return fail("That photograph no longer exists.")

  try {
    await prisma.$transaction(async (tx) => {
      await tx.sparePartPhoto.update({
        where: { id: photoId },
        // isPrimary is cleared as part of the same write. Leaving it set on a
        // deleted row would make the reconciler's "keep the existing primary"
        // branch look at a photograph nobody can see.
        data: { deletedAt: new Date(), isPrimary: false },
      })

      await reconcileSparePartPrimary(tx, sparePartId)

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "SPARE_PART_PHOTO_DELETED",
          entityType: "SparePart",
          entityId: sparePartId,
          metadata: {
            referenceNumber: photo.sparePart.referenceNumber,
            photoId,
            wasPrimary: photo.isPrimary,
          },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[spare-part-photo] failed to delete photograph", error)
    return fail("Could not remove that photograph. Please try again.")
  }

  revalidateSparePart(sparePartId, photo.sparePart.slug)

  return succeed(
    photo.isPrimary
      ? "Photograph removed. The next photograph is now the main image."
      : "Photograph removed."
  )
}
