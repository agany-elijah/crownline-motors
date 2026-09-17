import "server-only"

import { randomUUID } from "node:crypto"

import {
  BRANDING_BUCKET,
  BRANDING_EXTENSION_BY_MIME,
  type BrandingAssetKind,
  type BrandingMimeType,
} from "@/lib/constants/branding-options"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * The branding media store: logos, favicon and the default social image.
 *
 * Shaped like vehicle-media.ts, for the same reason — nothing outside this
 * file knows Supabase Storage is behind it, so moving to Cloudflare R2 is a
 * change here and nowhere else.
 *
 * The bucket is public-read and has no write policy; every write comes
 * through a Server Action that has already checked `settings:write`.
 *
 * ── Why replaced objects are deleted, unlike vehicle photographs ──────
 * A vehicle photo is soft-deleted and its object kept, because sourced
 * photography can be impossible to obtain again. A logo is a file the
 * dealership owns and has just re-uploaded; keeping every superseded favicon
 * forever buys nothing. The old object is removed only after the database
 * points at the new one, so a failure never leaves the site without a logo.
 */

/** Foldered by kind, named by a fresh UUID — never by the uploader's filename. */
function buildStoragePath(kind: BrandingAssetKind, type: BrandingMimeType): string {
  return `${kind}/${randomUUID()}.${BRANDING_EXTENSION_BY_MIME[type]}`
}

export async function uploadBrandingObject(
  kind: BrandingAssetKind,
  bytes: Uint8Array,
  contentType: BrandingMimeType
): Promise<string> {
  const supabase = createAdminClient()
  const storagePath = buildStoragePath(kind, contentType)

  const { error } = await supabase.storage.from(BRANDING_BUCKET).upload(storagePath, bytes, {
    contentType,
    upsert: false,
    // A year, immutable: a replacement is a new path, so the bytes behind a
    // given URL never change and browsers and the CDN can keep them.
    cacheControl: "31536000",
  })

  if (error) {
    throw new Error(`Branding upload failed: ${error.message}`)
  }

  return storagePath
}

/**
 * Removes objects that nothing references any more.
 *
 * Not rethrown: this runs after the change it follows has been committed and
 * reported, and an orphaned image in a public bucket is inert. Logged so it
 * can be tidied.
 */
export async function removeBrandingObjects(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return

  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(BRANDING_BUCKET).remove([...paths])

  if (error) {
    console.error("[storage] failed to remove superseded branding objects", error)
  }
}

export function brandingAssetPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!base) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be set to build branding asset URLs.")
  }

  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${BRANDING_BUCKET}/${storagePath}`
}
