import type { AcceptedPhotoMimeType } from "@/lib/constants/vehicle-photo-options"

/**
 * What a file actually is, decided from its bytes.
 *
 * Kept in its own module — with no `server-only` and no I/O — for two
 * reasons. It is the security-critical half of upload validation and
 * deserves direct unit tests, and it is pure logic that any future upload
 * path (payment receipts, spare-part images) will want unchanged.
 *
 * ── Why this exists at all ────────────────────────────────────────────
 * A multipart upload carries a `Content-Type` and a filename, and both are
 * written by whoever sent the request. Neither says anything true about the
 * contents. Accepting a file because it claims `image/jpeg`, then serving it
 * back from our own origin, is how a stored cross-site scripting hole gets
 * built out of an image uploader.
 *
 * So the declared type is discarded and the leading bytes are read instead.
 * The type this returns is what gets stored *and* what is later sent as the
 * object's `Content-Type` — together with the `X-Content-Type-Options:
 * nosniff` header already set in next.config.ts, a file that is not one of
 * these four formats has no path to being interpreted as anything else.
 */

const SIGNATURES: ReadonlyArray<{
  type: AcceptedPhotoMimeType
  matches: (bytes: Uint8Array) => boolean
}> = [
  {
    // SOI marker, then the start of the first segment.
    type: "image/jpeg",
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    // The eight-byte PNG signature, in full. The trailing CR/LF/EOF bytes
    // are part of it precisely so a corrupted transfer fails this check.
    type: "image/png",
    matches: (b) =>
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    // RIFF container: "RIFF", a four-byte length, then the form type.
    // Checking only "RIFF" would also accept a WAV file.
    type: "image/webp",
    matches: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
  },
  {
    // ISO base media file format: a four-byte box size, "ftyp", then the
    // major brand. "avis" — the image-sequence brand — is deliberately not
    // accepted; a still gallery has no use for it.
    type: "image/avif",
    matches: (b) => ascii(b, 4, 8) === "ftyp" && ascii(b, 8, 12) === "avif",
  },
]

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end))
}

/** The number of leading bytes any signature above needs. */
export const IMAGE_SIGNATURE_BYTES = 12

/**
 * The real type of a file, or null if it is not one we accept.
 *
 * Null is the safe answer for everything unrecognised, truncated or empty —
 * this is an allowlist, so a format nobody anticipated is refused rather
 * than passed through.
 */
export function sniffImageType(bytes: Uint8Array): AcceptedPhotoMimeType | null {
  if (bytes.length < IMAGE_SIGNATURE_BYTES) return null

  const header = bytes.subarray(0, IMAGE_SIGNATURE_BYTES)
  const match = SIGNATURES.find((signature) => signature.matches(header))

  return match ? match.type : null
}
