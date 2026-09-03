import "server-only"

import { cache } from "react"

import { prisma } from "@/lib/prisma"
import { vehiclePhotoPublicUrl } from "@/lib/storage/vehicle-media"
import type { VehiclePhotoDTO } from "@/types/vehicle-photo"

/**
 * Reads for vehicle photography.
 *
 * Every query here filters `deletedAt: null`. That is not a convention to
 * remember at each call site — it is the whole point of the soft delete, and
 * a query that forgets it would resurrect a photo an operator removed. The
 * only reader that should ever see deleted rows is a future restore screen,
 * which does not exist yet and would ask for them explicitly.
 *
 * The public URL is resolved here rather than in components, so no component
 * needs to know where the bytes live.
 */

/**
 * Ordering, in one place.
 *
 * The main image sorts first, because that is now what it means: it is the
 * photograph on the vehicle card *and* the first frame of the gallery, and
 * the dashboard presents it that way while it is being chosen. A gallery
 * whose first image is not the one the operator marked as main would be a
 * preview that lies about the result.
 *
 * `displayOrder` then holds the supporting images in the order they were
 * added, with `createdAt` breaking ties, so a batch uploaded together keeps
 * the order it was selected in rather than shuffling between renders — an
 * unstable sort in a gallery reads as a bug.
 */
const PHOTO_ORDER = [
  { isPrimary: "desc" as const },
  { displayOrder: "asc" as const },
  { createdAt: "asc" as const },
]

export const listVehiclePhotos = cache(
  async (vehicleId: string): Promise<VehiclePhotoDTO[]> => {
    const photos = await prisma.vehiclePhoto.findMany({
      where: { vehicleId, deletedAt: null },
      orderBy: PHOTO_ORDER,
      select: {
        id: true,
        storagePath: true,
        altText: true,
        isPrimary: true,
        displayOrder: true,
        createdAt: true,
      },
    })

    return photos.map((photo) => ({
      ...photo,
      url: vehiclePhotoPublicUrl(photo.storagePath),
    }))
  }
)
