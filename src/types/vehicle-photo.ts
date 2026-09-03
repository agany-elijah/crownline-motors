/**
 * The shape a vehicle photograph takes once it leaves the database.
 *
 * Declared here rather than beside the query that produces it because the
 * admin gallery is a Client Component and needs both this type and the
 * helper below. Importing them from the query module would pull Prisma —
 * and through it `pg` — into the browser bundle, which fails the build
 * rather than failing quietly, but only once someone tries it.
 *
 * The rule this encodes: types and pure helpers that cross the
 * server/client boundary live outside the modules that touch the database.
 */
export interface VehiclePhotoDTO {
  id: string
  /** Fully-resolved public URL. Components never build one themselves. */
  url: string
  storagePath: string
  altText: string | null
  /** The image customers see on the vehicle card and first in the gallery.
   *  Exactly one live photograph per vehicle carries this. */
  isPrimary: boolean
  displayOrder: number
  createdAt: Date
}

export interface VehicleNaming {
  year: number
  make: string
  model: string
}

/**
 * Alt text for a photograph.
 *
 * A photograph with no description is not given an empty `alt` — these are
 * content images, not decoration, and an empty alt tells a screen reader to
 * skip them entirely. Generating something truthful from the vehicle and the
 * photograph's role beats both silence and "image".
 *
 * `position` is the photograph's place among the supporting images, 1-based,
 * and is ignored for the main one. It is what a listener needs to tell two
 * otherwise identically-described frames apart while moving through a
 * gallery.
 */
export function describeVehiclePhoto(
  photo: Pick<VehiclePhotoDTO, "altText" | "isPrimary">,
  vehicle: VehicleNaming,
  position?: number
): string {
  if (photo.altText) return photo.altText

  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`

  if (photo.isPrimary) return `${name} — main photograph`

  return position ? `${name} — photograph ${position}` : name
}
