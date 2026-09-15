"use server"

import { recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { revalidateVehicleSurfaces } from "@/lib/cache/vehicle-surfaces"
import { prisma } from "@/lib/prisma"
import {
  capacityRefusal,
  countLiveVehiclePhotos,
  isSamePhotoSet,
  prepareVehiclePhotos,
  reconcilePrimary,
  storeVehiclePhotos,
} from "@/lib/storage/vehicle-photo-service"
import {
  vehiclePhotoAltTextSchema,
  vehiclePhotoOrderSchema,
  vehiclePhotoRefSchema,
  vehiclePhotoUploadSchema,
} from "@/lib/validations/vehicle-photo.schema"

/**
 * Vehicle photograph management.
 *
 * Follows the order every Server Action in this codebase follows —
 * validate, authorise, then write with an audit record in one transaction.
 * The storing itself lives in `@/lib/storage/vehicle-photo-service`, which
 * the create-vehicle action shares; see the notes there for why the objects
 * are written before the rows and why a batch is all-or-nothing.
 */

export interface VehiclePhotoActionState {
  status: "idle" | "success" | "error"
  message?: string
}

const IDLE: VehiclePhotoActionState = { status: "idle" }

function fail(message: string): VehiclePhotoActionState {
  return { status: "error", message }
}

function succeed(message: string): VehiclePhotoActionState {
  return { status: "success", message }
}

/** Every surface that shows photo state — the dashboard, the catalogue card
 *  and the public listing — refreshed together. */
function revalidateVehicle(vehicleId: string, slug: string): void {
  revalidateVehicleSurfaces(vehicleId, slug)
}

/**
 * Loads a photograph and proves it belongs to the vehicle named in the
 * request.
 *
 * The `vehicleId` in the where-clause is the authorisation check, not a
 * convenience: without it, a photo id belonging to any other listing would
 * be edited or deleted happily by anyone who could guess one.
 */
async function findOwnedPhoto(vehicleId: string, photoId: string) {
  return prisma.vehiclePhoto.findFirst({
    where: { id: photoId, vehicleId, deletedAt: null },
    select: {
      id: true,
      isPrimary: true,
      displayOrder: true,
      storagePath: true,
      vehicle: { select: { referenceNumber: true, slug: true } },
    },
  })
}

/**
 * Adds photographs to an existing vehicle.
 *
 * New photographs always join the supporting set, never the main image —
 * promoting one is an explicit choice made from the gallery. An upload that
 * silently replaced the cover of a published listing would change what
 * customers see without anyone deciding to.
 *
 * The exception is a vehicle with no live photographs at all, where
 * `reconcilePrimary` promotes the first: a gallery with images and no main
 * one has nothing to show on the card.
 */
export async function uploadVehiclePhotosAction(
  _prevState: VehiclePhotoActionState,
  formData: FormData
): Promise<VehiclePhotoActionState> {
  const parsed = vehiclePhotoUploadSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    files: formData.getAll("files"),
  })

  if (!parsed.success) {
    // One message rather than field errors: this form has a single
    // meaningful field, and the failure is always about the files.
    return fail(parsed.error.issues[0]?.message ?? "Those files could not be accepted.")
  }

  const auth = await authorizePermission("vehicle:write")
  if (!auth.ok) return fail(auth.message)

  const { vehicleId, files } = parsed.data

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, referenceNumber: true, slug: true },
  })

  if (!vehicle) return fail("That vehicle no longer exists.")

  const refusal = capacityRefusal(await countLiveVehiclePhotos(vehicleId), files.length)
  if (refusal) return fail(refusal)

  const prepared = await prepareVehiclePhotos(files)
  if (!prepared.ok) return fail(prepared.message)

  const stored = await storeVehiclePhotos({
    vehicleId,
    referenceNumber: vehicle.referenceNumber,
    actorId: auth.admin.id,
    photos: prepared.photos,
    firstBecomesPrimary: false,
  })

  if (!stored.ok) return fail(stored.message)

  revalidateVehicle(vehicleId, vehicle.slug)

  return succeed(
    stored.count === 1 ? "Photograph added." : `${stored.count} photographs added.`
  )
}

/**
 * Rearranges a vehicle's gallery.
 *
 * The client submits the complete ordered list, and the server accepts it
 * only if it is a permutation of exactly what is stored. That is what makes
 * this safe to expose: a request naming a photograph from another listing,
 * or omitting one, or repeating one, changes nothing — there is no partial
 * application. It also makes the action idempotent, so a double submit or a
 * retry leaves the same gallery rather than shuffling it again.
 *
 * `isPrimary` is deliberately untouched. The main image is a separate
 * decision with its own action, and the read ordering floats it to the front
 * regardless of `displayOrder` (see `PHOTO_ORDER`), so reordering the
 * supporting images can never displace the cover of a published listing.
 */
export async function reorderVehiclePhotosAction(
  _prevState: VehiclePhotoActionState,
  formData: FormData
): Promise<VehiclePhotoActionState> {
  const parsed = vehiclePhotoOrderSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    photoIds: formData.getAll("photoIds"),
  })

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That order is not valid.")
  }

  const auth = await authorizePermission("vehicle:write")
  if (!auth.ok) return fail(auth.message)

  const { vehicleId, photoIds } = parsed.data

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { referenceNumber: true, slug: true },
  })

  if (!vehicle) return fail("That vehicle no longer exists.")

  try {
    await prisma.$transaction(async (tx) => {
      /**
       * Read inside the transaction, so the set being compared is the set
       * being written. Reading first and writing after would let a
       * concurrent upload or deletion land in between, and the permutation
       * check would then be vouching for a gallery that no longer exists.
       */
      const live = await tx.vehiclePhoto.findMany({
        where: { vehicleId, deletedAt: null },
        select: { id: true },
      })

      if (!isSamePhotoSet(photoIds, live.map((photo) => photo.id))) {
        // Thrown rather than returned: this is inside the transaction, and
        // returning would commit an empty one. Caught below and reported as
        // a stale page, which is what it almost always is.
        throw new StalePhotoOrderError()
      }

      /**
       * Positions are rewritten from zero every time rather than patched.
       * A gallery that has had photographs added and removed accumulates
       * gaps in `displayOrder`; renumbering makes the stored order match
       * exactly what the operator arranged, which is what a later
       * drag-and-drop implementation will also want.
       *
       * Sequential, not `Promise.all`: an interactive transaction is a
       * single pinned connection, and firing its statements concurrently is
       * how a Prisma transaction ends up interleaved or deadlocked. Forty
       * updates is the ceiling here, and they are trivial primary-key writes.
       */
      for (const [index, photoId] of photoIds.entries()) {
        await tx.vehiclePhoto.update({
          where: { id: photoId },
          data: { displayOrder: index },
        })
      }

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "VEHICLE_PHOTOS_REORDERED",
          entityType: "Vehicle",
          entityId: vehicleId,
          metadata: {
            referenceNumber: vehicle.referenceNumber,
            count: photoIds.length,
          },
        },
        tx
      )
    })
  } catch (error) {
    if (error instanceof StalePhotoOrderError) {
      return fail(
        "The photographs changed while you were arranging them. Reload the page and try again."
      )
    }

    console.error("[vehicle-photo] failed to reorder photographs", error)
    return fail("Could not save that order. Please try again.")
  }

  revalidateVehicle(vehicleId, vehicle.slug)

  return succeed("Order saved.")
}

/** Signals that a submitted order no longer matches the stored gallery. */
class StalePhotoOrderError extends Error {}

/**
 * Sets or clears a photograph's alternative text.
 *
 * Optional by design. A photograph with none renders a truthful generated
 * description (`describeVehiclePhoto`), so an operator is never blocked on
 * writing twelve sentences for a walk-around — but the ones worth describing
 * precisely, an auction sheet or a panel of damage, can be.
 *
 * Clearing the field stores NULL rather than an empty string, so the
 * fallback resumes. An empty `alt` would tell a screen reader to skip a
 * content image entirely, which is the one outcome worse than a generic
 * description.
 */
export async function updateVehiclePhotoAltTextAction(
  _prevState: VehiclePhotoActionState,
  formData: FormData
): Promise<VehiclePhotoActionState> {
  const parsed = vehiclePhotoAltTextSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    photoId: formData.get("photoId"),
    altText: formData.get("altText") ?? "",
  })

  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "That description could not be saved."
    )
  }

  const auth = await authorizePermission("vehicle:write")
  if (!auth.ok) return fail(auth.message)

  const { vehicleId, photoId, altText } = parsed.data
  const photo = await findOwnedPhoto(vehicleId, photoId)

  if (!photo) return fail("That photograph no longer exists.")

  try {
    await prisma.$transaction(async (tx) => {
      await tx.vehiclePhoto.update({
        where: { id: photoId },
        data: { altText },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "VEHICLE_PHOTO_UPDATED",
          entityType: "Vehicle",
          entityId: vehicleId,
          metadata: {
            referenceNumber: photo.vehicle.referenceNumber,
            photoId,
            // The text itself is not recorded. It is not a financial or
            // access-control value, and the audit trail's job here is that
            // it changed and who changed it.
            altTextSet: altText !== null,
          },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[vehicle-photo] failed to update alternative text", error)
    return fail("Could not save that description. Please try again.")
  }

  revalidateVehicle(vehicleId, photo.vehicle.slug)

  return succeed(altText ? "Description saved." : "Description cleared.")
}

/** Makes one photograph the vehicle's main image. */
export async function setPrimaryVehiclePhotoAction(
  _prevState: VehiclePhotoActionState,
  formData: FormData
): Promise<VehiclePhotoActionState> {
  const parsed = vehiclePhotoRefSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    photoId: formData.get("photoId"),
  })

  if (!parsed.success) return fail("That photograph is not valid.")

  const auth = await authorizePermission("vehicle:write")
  if (!auth.ok) return fail(auth.message)

  const { vehicleId, photoId } = parsed.data
  const photo = await findOwnedPhoto(vehicleId, photoId)

  if (!photo) return fail("That photograph no longer exists.")
  if (photo.isPrimary) return IDLE

  try {
    await prisma.$transaction(async (tx) => {
      await tx.vehiclePhoto.updateMany({
        where: { vehicleId, deletedAt: null, isPrimary: true },
        data: { isPrimary: false },
      })

      await tx.vehiclePhoto.update({
        where: { id: photoId },
        data: { isPrimary: true },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "VEHICLE_PRIMARY_PHOTO_CHANGED",
          entityType: "Vehicle",
          entityId: vehicleId,
          metadata: {
            referenceNumber: photo.vehicle.referenceNumber,
            photoId,
          },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[vehicle-photo] failed to set main photograph", error)
    return fail("Could not change the main image. Please try again.")
  }

  revalidateVehicle(vehicleId, photo.vehicle.slug)

  return succeed("Main image updated.")
}

/**
 * Removes a photograph from the gallery.
 *
 * A soft delete: `deletedAt` is stamped and the stored object is left where
 * it is. Sourced and auction photography is often impossible to obtain
 * again, and every read filters on `deletedAt`, so the photograph disappears
 * from the site and the dashboard immediately while remaining recoverable.
 */
export async function deleteVehiclePhotoAction(
  _prevState: VehiclePhotoActionState,
  formData: FormData
): Promise<VehiclePhotoActionState> {
  const parsed = vehiclePhotoRefSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    photoId: formData.get("photoId"),
  })

  if (!parsed.success) return fail("That photograph is not valid.")

  const auth = await authorizePermission("vehicle:write")
  if (!auth.ok) return fail(auth.message)

  const { vehicleId, photoId } = parsed.data
  const photo = await findOwnedPhoto(vehicleId, photoId)

  if (!photo) return fail("That photograph no longer exists.")

  try {
    await prisma.$transaction(async (tx) => {
      await tx.vehiclePhoto.update({
        where: { id: photoId },
        // isPrimary is cleared as part of the same write. Leaving it set on
        // a deleted row would make reconcilePrimary's "keep the existing
        // primary" branch look at a photograph nobody can see.
        data: { deletedAt: new Date(), isPrimary: false },
      })

      await reconcilePrimary(tx, vehicleId)

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "VEHICLE_PHOTO_DELETED",
          entityType: "Vehicle",
          entityId: vehicleId,
          metadata: {
            referenceNumber: photo.vehicle.referenceNumber,
            photoId,
            wasPrimary: photo.isPrimary,
          },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[vehicle-photo] failed to delete photograph", error)
    return fail("Could not remove that photograph. Please try again.")
  }

  revalidateVehicle(vehicleId, photo.vehicle.slug)

  return succeed(
    photo.isPrimary
      ? "Photograph removed. The next photograph is now the main image."
      : "Photograph removed."
  )
}
