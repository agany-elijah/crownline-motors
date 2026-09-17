"use server"

import { revalidatePath, updateTag } from "next/cache"

import { recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import {
  BRANDING_ASSET_RULES,
  readPngDimensions,
  type BrandingMimeType,
} from "@/lib/constants/branding-options"
import { SETTINGS_BASE_PATH } from "@/lib/constants/settings-nav"
import { prisma } from "@/lib/prisma"
import { BUSINESS_SETTINGS_CACHE_TAG } from "@/lib/queries/settings.queries"
import { sniffImageType } from "@/lib/storage/image-signature"
import { removeBrandingObjects, uploadBrandingObject } from "@/lib/storage/branding-media"
import { formatMegabytes } from "@/lib/constants/vehicle-photo-options"
import { brandingAssetKindSchema } from "@/lib/validations/settings.schema"

/**
 * Uploading and removing the logos, favicon and default social image.
 *
 * ── What is never trusted ─────────────────────────────────────────────
 * The browser's MIME type and the filename. The type is read from the file's
 * own leading bytes (image-signature.ts) and must be one this asset accepts;
 * the stored name is a fresh UUID. A favicon's dimensions are read from its
 * PNG header rather than taken on faith, because a favicon that is not square
 * renders stretched in every browser tab.
 *
 * ── Order of operations ───────────────────────────────────────────────
 * Upload the object, then point the database at it and record the change in
 * one transaction, then delete the object it replaced. A failed database write
 * removes the new object; the old one is only removed once nothing references
 * it, so no failure can leave the site without its logo.
 */

export interface BrandingAssetState {
  status: "idle" | "success" | "error"
  message?: string
}

const KB = 1024

function describeLimit(bytes: number): string {
  return bytes >= 1024 * KB ? formatMegabytes(bytes) : `${Math.round(bytes / KB)} KB`
}

const MIME_LABELS: Record<BrandingMimeType, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
}

function revalidateBranding(): void {
  revalidatePath(SETTINGS_BASE_PATH, "layout")
  updateTag(BUSINESS_SETTINGS_CACHE_TAG)
}

export async function uploadBrandingAssetAction(
  _prevState: BrandingAssetState,
  formData: FormData
): Promise<BrandingAssetState> {
  const kind = brandingAssetKindSchema.safeParse(formData.get("kind"))
  const file = formData.get("file")

  if (!kind.success) {
    return { status: "error", message: "That image slot could not be found." }
  }

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose an image to upload." }
  }

  const auth = await authorizePermission("settings:write")
  if (!auth.ok) return { status: "error", message: auth.message }

  const rule = BRANDING_ASSET_RULES[kind.data]

  // Checked before the bytes are read, so an oversized upload costs nothing
  // beyond the request body the platform has already bounded.
  if (file.size > rule.maxBytes) {
    return { status: "error", message: `That file is too large. The limit is ${describeLimit(rule.maxBytes)}.` }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const sniffed = sniffImageType(bytes)
  const type = rule.mimeTypes.find((accepted) => accepted === sniffed)

  if (!type) {
    return {
      status: "error",
      message: `That file is not an accepted image. Upload ${rule.mimeTypes.map((mime) => MIME_LABELS[mime]).join(" or ")}.`,
    }
  }

  if (rule.squarePng) {
    const dimensions = readPngDimensions(bytes)
    const { minEdge, maxEdge } = rule.squarePng

    if (!dimensions || dimensions.width !== dimensions.height) {
      return { status: "error", message: "The favicon must be square — the same width and height." }
    }

    if (dimensions.width < minEdge || dimensions.width > maxEdge) {
      return {
        status: "error",
        message: `The favicon must be between ${minEdge}×${minEdge} and ${maxEdge}×${maxEdge} pixels. This one is ${dimensions.width}×${dimensions.height}.`,
      }
    }
  }

  let storagePath: string
  try {
    storagePath = await uploadBrandingObject(kind.data, bytes, type)
  } catch (error) {
    console.error("[branding] upload failed", error)
    return { status: "error", message: "Could not upload that image. Please try again." }
  }

  let replacedPath: string | null
  try {
    replacedPath = await prisma.$transaction(async (tx) => {
      const previous = await tx.businessSettings.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, whatsappNumber: "" },
        select: { [rule.column]: true },
      })

      await tx.businessSettings.update({ where: { id: 1 }, data: { [rule.column]: storagePath } })

      const replaced = (previous as Record<string, string | null>)[rule.column] ?? null

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "SETTINGS_BRANDING_ASSET_UPDATED",
          entityType: "BusinessSettings",
          entityId: "1",
          metadata: {
            changes: [{ field: rule.label, from: replaced ? "Previous image" : null, to: "New image uploaded" }],
          },
        },
        tx
      )

      return replaced
    })
  } catch (error) {
    console.error("[branding] failed to record the uploaded image", error)
    await removeBrandingObjects([storagePath])
    return { status: "error", message: "Could not save that image. Please try again." }
  }

  if (replacedPath) await removeBrandingObjects([replacedPath])

  revalidateBranding()

  return { status: "success", message: `${rule.label} updated.` }
}

export async function removeBrandingAssetAction(
  _prevState: BrandingAssetState,
  formData: FormData
): Promise<BrandingAssetState> {
  const kind = brandingAssetKindSchema.safeParse(formData.get("kind"))
  if (!kind.success) {
    return { status: "error", message: "That image slot could not be found." }
  }

  const auth = await authorizePermission("settings:write")
  if (!auth.ok) return { status: "error", message: auth.message }

  const rule = BRANDING_ASSET_RULES[kind.data]

  let removedPath: string | null
  try {
    removedPath = await prisma.$transaction(async (tx) => {
      const previous = await tx.businessSettings.findUnique({
        where: { id: 1 },
        select: { [rule.column]: true },
      })

      const current = (previous as Record<string, string | null> | null)?.[rule.column] ?? null
      if (!current) return null

      await tx.businessSettings.update({ where: { id: 1 }, data: { [rule.column]: null } })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "SETTINGS_BRANDING_ASSET_REMOVED",
          entityType: "BusinessSettings",
          entityId: "1",
          metadata: { changes: [{ field: rule.label, from: "Uploaded image", to: null }] },
        },
        tx
      )

      return current
    })
  } catch (error) {
    console.error("[branding] failed to remove image", error)
    return { status: "error", message: "Could not remove that image. Please try again." }
  }

  if (removedPath) await removeBrandingObjects([removedPath])

  revalidateBranding()

  return { status: "success", message: removedPath ? `${rule.label} removed.` : "There was no image to remove." }
}
