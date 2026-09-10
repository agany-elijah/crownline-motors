import "server-only"

import { cache } from "react"

import { prisma } from "@/lib/prisma"
import { sparePartPhotoPublicUrl } from "@/lib/storage/spare-part-media"
import type { SparePartPhotoDTO } from "@/types/spare-part-photo"

/**
 * Reads for spare-part photography.
 *
 * Every query here filters `deletedAt: null`. That is not a convention to
 * remember at each call site — it is the whole point of the soft delete, and
 * a query that forgets it would resurrect a photo an operator removed.
 *
 * The public URL is resolved here rather than in components, so no component
 * needs to know where the bytes live.
 *
 * ── Safe on a public page, unlike spare-part.queries.ts ───────────────
 * This module selects nothing but the photograph's own columns: no status, no
 * supplier fields, no price. The visibility decision belongs to whoever
 * looked the part up — `getPublishedSparePartBySlug` will not return an
 * unpublished part in the first place, so a gallery keyed on its id can only
 * ever be one a customer is allowed to see.
 */

/**
 * Ordering, in one place.
 *
 * The main image sorts first, because that is what it means: it is the
 * photograph on the catalogue card *and* the first frame of the gallery, and
 * the dashboard presents it that way while it is being chosen. A gallery
 * whose first image is not the one the operator marked as main would be a
 * preview that lies about the result.
 *
 * `displayOrder` then holds the supporting images in the order they were
 * added, with `createdAt` breaking ties, so a batch uploaded together keeps
 * the order it was selected in rather than shuffling between renders.
 */
const PHOTO_ORDER = [
  { isPrimary: "desc" as const },
  { displayOrder: "asc" as const },
  { createdAt: "asc" as const },
]

const PHOTO_SELECT = {
  id: true,
  storagePath: true,
  altText: true,
  isPrimary: true,
} as const

export const listSparePartPhotos = cache(
  async (sparePartId: string): Promise<SparePartPhotoDTO[]> => {
    const photos = await prisma.sparePartPhoto.findMany({
      where: { sparePartId, deletedAt: null },
      orderBy: PHOTO_ORDER,
      select: PHOTO_SELECT,
    })

    return photos.map(({ storagePath, ...photo }) => ({
      ...photo,
      url: sparePartPhotoPublicUrl(storagePath),
    }))
  }
)
