/**
 * Limits and formats for vehicle photography.
 *
 * Consumed by three places that do not otherwise overlap — the admin
 * uploader, the admin gallery, and (from Stage 11) the public vehicle
 * gallery — and read by both the browser and the Server Action. Keeping
 * them in one module is what makes "the client rejected it but the server
 * accepted it" impossible.
 *
 * ── On the absence of photo categories ────────────────────────────────
 * A gallery is one main photograph plus its supporting images. That is the
 * only distinction that changes what a customer sees: the main image is the
 * vehicle card and the first frame of the gallery. FRONT / REAR / DASHBOARD
 * and the rest were a taxonomy an operator had to maintain on every upload
 * and that nothing downstream ever read.
 */

/**
 * The storage bucket vehicle photography lives in.
 *
 * Declared here rather than in the storage module because that module is
 * `server-only`, and scripts/create-storage-buckets.ts — a plain Node
 * script, not a React Server Component — has to name the same bucket. Two
 * copies of a bucket name is exactly the kind of drift that provisions the
 * wrong container in a new environment.
 */
export const VEHICLE_PHOTO_BUCKET = "vehicle-photos"

/* ── Accepted formats ───────────────────────────────────────────── */

/**
 * Formats the browser accepts and the server will store.
 *
 * An allowlist, not a denylist, and matched against the file's actual
 * leading bytes rather than its declared Content-Type or its extension —
 * both of which are attacker-supplied. See `sniffImageType`.
 *
 * No SVG. It is an image format that can carry script, and serving one
 * from our own storage origin would hand an uploader a stored-XSS
 * primitive. Vehicle photography has no use for it.
 */
export const ACCEPTED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const

export type AcceptedPhotoMimeType = (typeof ACCEPTED_PHOTO_MIME_TYPES)[number]

/** The extension each accepted type is stored under. We never reuse the
 *  uploaded filename, so this is the only source of the stored extension. */
export const PHOTO_EXTENSION_BY_MIME: Record<AcceptedPhotoMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
}

/**
 * `accept` attribute for the file input.
 *
 * Deliberately the broad `image/*` rather than the four-type allowlist
 * above, and that is a mobile decision:
 *
 *  - **iOS.** With an explicit type list, Safari opens the Files browser,
 *    where photographs are picked one at a time. With `image/*` it opens the
 *    Photos sheet, which is the one that lets someone tap fifteen images and
 *    press Add. `multiple` alone does not get you there.
 *  - **Android.** Several document pickers filter on extension rather than
 *    MIME type, and grey out photographs the server would happily accept —
 *    which reads to an operator as "it only took two of my images".
 *
 * The cost is that HEIC/HEIF from an iPhone can now be chosen. That is a
 * feature, not a leak: the browser re-encodes every selected image to WebP
 * before it is sent (see downscale-photo.ts), so an iPhone photograph
 * arrives as WebP, and anything the browser cannot decode is refused in the
 * picker with a message naming the file.
 *
 * None of this widens what the *server* stores. ACCEPTED_PHOTO_MIME_TYPES is
 * still the allowlist, still matched against the file's leading bytes, and
 * `accept` remains what it has always been — a hint to the file dialog that
 * an attacker simply omits.
 */
export const PHOTO_INPUT_ACCEPT = "image/*"

/* ── Browser-side downscaling ───────────────────────────────────── */

/**
 * Every selected photograph is re-encoded in the browser before it is sent.
 *
 * Two problems, one fix. A modern phone camera produces 4–8MB frames, so a
 * walk-around of ten is 60MB — over the Server Action body limit, and on the
 * connections this business runs on, minutes of upload that frequently do
 * not finish. And the brief (§19) requires the site itself to be light on
 * mobile data, which a gallery of unprocessed originals never is.
 *
 * 1920px on the long edge is comfortably above what any surface renders:
 * the public gallery's largest presentation is a full-width 16:9 frame.
 * WebP at 0.82 is visually indistinguishable from the original at that size
 * and lands each frame in the low hundreds of kilobytes.
 *
 * This is a convenience, never a control. The server re-checks the size and
 * reads the leading bytes of whatever actually arrives.
 */
export const PHOTO_MAX_EDGE_PX = 1920
export const PHOTO_ENCODE_QUALITY = 0.82
export const PHOTO_ENCODE_MIME = "image/webp" satisfies AcceptedPhotoMimeType

/* ── Upload limits ──────────────────────────────────────────────
   Enforced on the server (vehicle-photo.actions.ts). The uploader
   applies the same numbers in the browser purely so an operator is told
   before spending three minutes uploading a file that will be refused —
   never as the check itself. */

/** Per file, as received. A camera JPEG straight off a phone is comfortably
 *  under this, and downscaling puts a typical frame two orders of magnitude
 *  below it; anything larger is an unprocessed original that will not have
 *  survived `next dev`'s body limit either. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024

/** Per submission. Also bounded by `serverActions.bodySizeLimit` in
 *  next.config.ts — keep the two in step if either moves. */
export const MAX_PHOTOS_PER_UPLOAD = 12
export const MAX_UPLOAD_BATCH_BYTES = 16 * 1024 * 1024

/**
 * Per vehicle, across all uploads.
 *
 * A ceiling rather than a target. The brief asks for a full walk-around
 * plus documentation, which lands around fifteen; forty is where a gallery
 * stops helping a buyer decide and starts costing them bandwidth they are
 * paying for by the megabyte.
 */
export const MAX_PHOTOS_PER_VEHICLE = 40

/**
 * The longest alternative text a photograph may carry.
 *
 * Alt text is a description read aloud in place of the image, and it ships
 * in the public page's markup. Past roughly this length it has stopped being
 * a description and started being a paragraph — which is what the vehicle's
 * own description field is for.
 *
 * Writing it is optional: a photograph with none falls back to a truthful
 * generated description (see `describeVehiclePhoto`), so an operator
 * arranging a twelve-frame walk-around is never asked to write twelve
 * sentences.
 */
export const MAX_PHOTO_ALT_TEXT_LENGTH = 160

/** For messages. Whole megabytes, since every limit above is one. */
export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`
}
