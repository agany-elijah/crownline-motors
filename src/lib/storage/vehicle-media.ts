import "server-only"

import { randomUUID } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  PHOTO_EXTENSION_BY_MIME,
  VEHICLE_PHOTO_BUCKET,
  type AcceptedPhotoMimeType,
} from "@/lib/constants/vehicle-photo-options"
import { sniffImageType } from "@/lib/storage/image-signature"

/**
 * The vehicle media store.
 *
 * ── Why this module exists ────────────────────────────────────────────
 * Stage 9 of the roadmap requires the media abstraction to be shaped so
 * storage can later move to Cloudflare R2 "without rewriting the vehicle
 * system". Nothing outside this file knows that Supabase Storage is behind
 * it: callers deal in a `storagePath` (what `VehiclePhoto.storagePath`
 * holds) and a public URL. Swapping the provider means reimplementing the
 * four functions below and leaving every action, query and component
 * untouched.
 *
 * ── Why the bucket is public ──────────────────────────────────────────
 * Vehicle photographs are marketing material: they are shown to anonymous
 * visitors on /cars, indexed by search engines, and served through the CDN.
 * Signed URLs would expire mid-page, defeat caching, and buy nothing — the
 * images are the thing we are trying to publish.
 *
 * "Public" here means public *reads*. The bucket carries no INSERT, UPDATE
 * or DELETE policy at all, so no browser session — signed in or not — can
 * write to it. Every write goes through the functions below, which use the
 * secret key from a Server Action that has already checked `vehicle:write`.
 * That is the same boundary the rest of the application uses: authorisation
 * lives in the server action, never in the client.
 *
 * Payment receipts (Stage 22) are the opposite case and must NOT reuse this
 * bucket — they belong in a private one read through short-lived signed
 * URLs. The schema documentation is explicit about that, which is why this
 * module is named for vehicle media rather than for storage in general.
 */

export { VEHICLE_PHOTO_BUCKET }

/** Re-exported so callers have one import for "everything about storing a
 *  vehicle photo". The implementation is pure and lives in its own module so
 *  it can be unit-tested without the server-only guard. */
export { sniffImageType }

/**
 * Where a photo lives.
 *
 * Foldered by vehicle so everything for one listing can be listed or
 * removed as a unit, and named with a fresh UUID rather than anything the
 * uploader supplied. A client filename can carry path traversal (`../`),
 * a second extension (`car.jpg.html`), or characters that break a URL —
 * none of which we have to defend against if we simply never use it.
 */
function buildStoragePath(vehicleId: string, type: AcceptedPhotoMimeType): string {
  return `${vehicleId}/${randomUUID()}.${PHOTO_EXTENSION_BY_MIME[type]}`
}

export interface UploadedPhotoObject {
  storagePath: string
  contentType: AcceptedPhotoMimeType
  sizeBytes: number
}

/**
 * Stores one photo and returns where it went.
 *
 * Does not touch the database — the caller writes the `VehiclePhoto` row,
 * so that the row and its object are created in a known order and an
 * orphaned object can be cleaned up if the write fails (see the action).
 *
 * `upsert: false` is deliberate: the path contains a fresh UUID, so a
 * collision would mean something is badly wrong and should surface as an
 * error rather than silently overwrite a photo belonging to another
 * listing.
 */
export async function uploadVehiclePhotoObject(
  vehicleId: string,
  bytes: Uint8Array,
  contentType: AcceptedPhotoMimeType
): Promise<UploadedPhotoObject> {
  const supabase = createAdminClient()
  const storagePath = buildStoragePath(vehicleId, contentType)

  const { error } = await supabase.storage
    .from(VEHICLE_PHOTO_BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      upsert: false,
      // A year, immutable: the path contains a UUID, so the bytes at a
      // given path never change. Replacing a photo creates a new path.
      cacheControl: "31536000",
    })

  if (error) {
    throw new Error(`Vehicle photo upload failed: ${error.message}`)
  }

  return { storagePath, contentType, sizeBytes: bytes.byteLength }
}

/**
 * Removes objects from the store.
 *
 * Used only to clean up after a failed write. A photo an operator deletes
 * is soft-deleted in the database and its object is deliberately left in
 * place — sourced and auction photography can be expensive or impossible to
 * obtain again, and `VehiclePhoto.deletedAt` exists precisely so a deletion
 * is recoverable. Purging storage would make the soft delete a lie.
 */
export async function removeVehiclePhotoObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return

  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(VEHICLE_PHOTO_BUCKET).remove(paths)

  if (error) {
    // Deliberately not rethrown. This only ever runs while unwinding a
    // failure the caller is already reporting; turning a cleanup miss into
    // a second error would replace an accurate message with a confusing
    // one. The orphan is inert (no row references it) and logged.
    console.error("[storage] failed to remove orphaned vehicle photo objects", error)
  }
}

/**
 * The public URL for a stored path.
 *
 * Built from the URL, rather than asked of the SDK, so it can be called
 * from a query without constructing a client per row. The shape is
 * Supabase's documented public-object route; if this moves to R2 it becomes
 * the CDN origin and nothing else changes.
 */
export function vehiclePhotoPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be set to build vehicle photo URLs."
    )
  }

  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${VEHICLE_PHOTO_BUCKET}/${storagePath}`
}
