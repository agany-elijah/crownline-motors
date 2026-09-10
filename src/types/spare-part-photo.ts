/**
 * The shape a spare-part photograph takes once it leaves the database.
 *
 * Declared here rather than beside the query that produces it because the
 * admin gallery and the public gallery are both Client Components and need
 * both this type and the helper below. Importing them from a query module
 * would pull Prisma — and through it `pg` — into the browser bundle.
 *
 * The rule this encodes: types and pure helpers that cross the server/client
 * boundary live outside the modules that touch the database.
 */
export interface SparePartPhotoDTO {
  id: string
  /** Fully-resolved public URL. Components never build one themselves. */
  url: string
  altText: string | null
  /** The image customers see on the catalogue card and first in the gallery.
   *  Exactly one live photograph per part carries this. */
  isPrimary: boolean
}

/**
 * Alt text for a part photograph.
 *
 * A photograph with no description is not given an empty `alt` — these are
 * content images, not decoration, and an empty alt tells a screen reader to
 * skip them entirely. Generating something truthful from the part's name and
 * the photograph's role beats both silence and "image".
 *
 * `position` is the photograph's place among the supporting images, 1-based,
 * and is ignored for the main one. It is what a listener needs to tell two
 * otherwise identically-described frames apart while moving through a
 * gallery.
 */
export function describeSparePartPhoto(
  photo: Pick<SparePartPhotoDTO, "altText" | "isPrimary">,
  partName: string,
  position?: number
): string {
  if (photo.altText) return photo.altText

  if (photo.isPrimary) return `${partName} — main photograph`

  return position ? `${partName} — photograph ${position}` : partName
}
