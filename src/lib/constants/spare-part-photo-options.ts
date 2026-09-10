import {
  ACCEPTED_PHOTO_MIME_TYPES,
  MAX_PHOTO_ALT_TEXT_LENGTH,
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_BATCH_BYTES,
  PHOTO_EXTENSION_BY_MIME,
  PHOTO_INPUT_ACCEPT,
  formatMegabytes,
  type AcceptedPhotoMimeType,
} from "@/lib/constants/vehicle-photo-options"

/**
 * Limits and formats for spare-part photography.
 *
 * ── What is shared, and why it is shared by import rather than by copy ──
 * The *format* rules — which image types are accepted, the extension each is
 * stored under, the per-file and per-batch ceilings, the browser-side
 * downscale settings, what the file input hints at — are not facts about
 * vehicles. They are facts about what this application will accept as an
 * image, and every reason behind them (no SVG because it can carry script;
 * `image/*` so an iPhone opens the Photos sheet; a size ceiling matched to
 * the Server Action body limit) applies identically to a photograph of a
 * brake pad.
 *
 * So they are re-exported from `vehicle-photo-options.ts` rather than
 * restated here. Two copies of an allowlist is precisely how a security
 * control drifts: someone adds a format on one side, and the other side goes
 * on accepting the old set for a year without anyone noticing which is which.
 *
 * The vehicle module is the older of the two and is where those rules were
 * first written down, which is why it is the origin. If a third media domain
 * ever appears, the right move is to lift them into a neutral module and
 * have both re-export from there — not to add a third copy.
 *
 * What genuinely differs is below: a bucket of its own, and a ceiling of its
 * own.
 */

export {
  ACCEPTED_PHOTO_MIME_TYPES,
  MAX_PHOTO_ALT_TEXT_LENGTH,
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_BATCH_BYTES,
  PHOTO_EXTENSION_BY_MIME,
  PHOTO_INPUT_ACCEPT,
  formatMegabytes,
}
export type { AcceptedPhotoMimeType }

/**
 * The storage bucket part photography lives in.
 *
 * A separate bucket from vehicle photography rather than a folder inside it.
 * The two have different lifecycles and, in time, different retention and
 * access rules; more immediately, a bucket is the unit Supabase applies a
 * MIME allowlist, a size ceiling and an access policy to, so sharing one
 * would mean the parts catalogue silently inherits whatever the vehicle
 * bucket is configured with today.
 *
 * Public read, server-only write — the same posture as the vehicle bucket,
 * for the same reason: a part photograph is marketing material served to
 * anonymous visitors and cached by the CDN, and no browser session, signed
 * in or not, may write to it. See scripts/create-storage-buckets.ts.
 *
 * Declared here rather than in the storage module because that module is
 * `server-only` and the provisioning script is plain Node.
 */
export const SPARE_PART_PHOTO_BUCKET = "spare-part-photos"

/**
 * Per part, across all uploads.
 *
 * Ten, against a vehicle's forty, and the difference is not arbitrary. A car
 * needs a walk-around plus documentation; a brake pad needs the part, the
 * markings, the packaging and the condition of the wear surfaces. Past about
 * ten frames a parts listing is not describing the part any better, it is
 * costing a customer on a metered connection to scroll past duplicates.
 *
 * It is also the per-upload ceiling, since a whole gallery fits inside it —
 * so unlike the vehicle uploader there is no second, smaller batch limit for
 * an operator to run into.
 */
export const MAX_PHOTOS_PER_SPARE_PART = 10
