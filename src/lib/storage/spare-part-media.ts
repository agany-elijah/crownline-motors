import "server-only"

import { randomUUID } from "node:crypto"

import {
  PHOTO_EXTENSION_BY_MIME,
  SPARE_PART_PHOTO_BUCKET,
  type AcceptedPhotoMimeType,
} from "@/lib/constants/spare-part-photo-options"
import { sniffImageType } from "@/lib/storage/image-signature"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * The spare-part media store.
 *
 * A deliberate mirror of `vehicle-media.ts`, parameterised on a different
 * bucket and a different owner id. The two are kept as separate modules for
 * the same reason the buckets are separate: nothing outside this file knows
 * that Supabase Storage is behind it, so migrating parts photography to
 * Cloudflare R2 — or migrating it *before* vehicle photography, which is
 * plausible given volume — means reimplementing the three functions below
 * and touching nothing else.
 *
 * ── Why the bucket is public ──────────────────────────────────────────
 * "Public" is about reads. Part photographs are shown to anonymous
 * visitors on /spare-parts, indexed, and served through the CDN; signed URLs
 * would expire mid-page and buy nothing. The bucket carries no INSERT,
 * UPDATE or DELETE policy, so no browser session can write to it. Every
 * write goes through the functions below, called from a Server Action that
 * has already checked `sparePart:write` and holds the secret key
 * server-side.
 */

export { SPARE_PART_PHOTO_BUCKET }

/** Re-exported so callers have one import for "everything about storing a
 *  part photo". The implementation is pure and lives in its own module so it
 *  can be unit-tested without the server-only guard. */
export { sniffImageType }

/**
 * Where a photo lives.
 *
 * Foldered by part so everything for one listing can be listed or removed as
 * a unit, and named with a fresh UUID rather than anything the uploader
 * supplied — a client filename can carry path traversal, a second extension
 * (`pad.jpg.html`), or characters that break a URL, none of which we have to
 * defend against if we never use it.
 */
function buildStoragePath(
  sparePartId: string,
  type: AcceptedPhotoMimeType
): string {
  return `${sparePartId}/${randomUUID()}.${PHOTO_EXTENSION_BY_MIME[type]}`
}

export interface UploadedPartPhotoObject {
  storagePath: string
  contentType: AcceptedPhotoMimeType
  sizeBytes: number
}

/**
 * Stores one photo and returns where it went.
 *
 * Does not touch the database — the caller writes the `SparePartPhoto` row,
 * so the row and its object are created in a known order and an orphaned
 * object can be cleaned up if the write fails.
 *
 * `upsert: false` is deliberate: the path contains a fresh UUID, so a
 * collision means something is badly wrong and should surface as an error
 * rather than silently overwrite a photo belonging to another listing.
 */
export async function uploadSparePartPhotoObject(
  sparePartId: string,
  bytes: Uint8Array,
  contentType: AcceptedPhotoMimeType
): Promise<UploadedPartPhotoObject> {
  const supabase = createAdminClient()
  const storagePath = buildStoragePath(sparePartId, contentType)

  const { error } = await supabase.storage
    .from(SPARE_PART_PHOTO_BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      upsert: false,
      // A year, immutable: the path contains a UUID, so the bytes at a given
      // path never change. Replacing a photo creates a new path.
      cacheControl: "31536000",
    })

  if (error) {
    throw new Error(`Spare-part photo upload failed: ${error.message}`)
  }

  return { storagePath, contentType, sizeBytes: bytes.byteLength }
}

/**
 * Removes objects from the store.
 *
 * Used only to clean up after a failed write. A photo an operator deletes is
 * soft-deleted in the database and its object is deliberately left in place —
 * `SparePartPhoto.deletedAt` exists precisely so a deletion is recoverable,
 * and purging storage would make the soft delete a lie.
 */
export async function removeSparePartPhotoObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return

  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(SPARE_PART_PHOTO_BUCKET).remove(paths)

  if (error) {
    // Deliberately not rethrown. This only runs while unwinding a failure the
    // caller is already reporting; turning a cleanup miss into a second error
    // would replace an accurate message with a confusing one. The orphan is
    // inert — no row references it — and it is logged.
    console.error("[storage] failed to remove orphaned spare-part photo objects", error)
  }
}

/**
 * The public URL for a stored path.
 *
 * Built from the URL rather than asked of the SDK, so it can be called from a
 * query without constructing a client per row. If this moves to R2 it becomes
 * the CDN origin and nothing else changes.
 */
export function sparePartPhotoPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be set to build spare-part photo URLs."
    )
  }

  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${SPARE_PART_PHOTO_BUCKET}/${storagePath}`
}
