import {
  MAX_PHOTO_BYTES,
  PHOTO_ENCODE_MIME,
  PHOTO_ENCODE_QUALITY,
  PHOTO_MAX_EDGE_PX,
} from "@/lib/constants/vehicle-photo-options"

/**
 * Re-encodes a selected photograph in the browser before it is uploaded.
 *
 * ── Why this is not an optimisation ───────────────────────────────────
 * A phone camera produces 4–8MB frames. A ten-image walk-around is therefore
 * 60MB, which is past the Server Action body limit and, on the connections
 * this business actually runs on, several minutes of upload that frequently
 * does not finish. That is the failure an operator experiences as "it only
 * saved one or two of my images". Downscaling first is what makes a whole
 * batch arrive in one request.
 *
 * It also serves the brief's performance requirement directly: the bytes
 * stored here are the bytes served to a customer paying for mobile data.
 *
 * ── Why every failure returns the original ────────────────────────────
 * This is a convenience, not a control. The server reads the leading bytes
 * of whatever actually arrives and enforces every limit again. So if the
 * browser cannot decode the format, has no canvas, or produces something
 * larger than it started with, handing back the untouched file is correct —
 * the upload still works, it is just heavier.
 */
export async function downscalePhoto(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file

  let bitmap: ImageBitmap

  try {
    // `from-image` applies the EXIF orientation flag, which phones set rather
    // than rotating the pixels. Without it, portrait photographs from an
    // iPhone would be stored on their side — the canvas reads raw pixels.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    return file
  }

  try {
    const scale = Math.min(
      1,
      PHOTO_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height)
    )

    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) return file

    context.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, PHOTO_ENCODE_MIME, PHOTO_ENCODE_QUALITY)
    })

    // `toBlob` falls back to PNG when it does not support the requested type,
    // and a PNG re-encode of a photograph is routinely larger than the JPEG
    // it came from. Both conditions mean the original is the better upload.
    if (!blob || blob.type !== PHOTO_ENCODE_MIME) return file
    if (blob.size >= file.size && file.size <= MAX_PHOTO_BYTES) return file

    return new File([blob], replaceExtension(file.name), {
      type: PHOTO_ENCODE_MIME,
      lastModified: file.lastModified,
    })
  } catch {
    return file
  } finally {
    bitmap.close()
  }
}

/**
 * The stored filename is never the uploaded one — the storage layer mints a
 * UUID — so this only affects what the operator sees in the picker. Keeping
 * the extension honest avoids a list showing "front.jpg" for WebP bytes.
 */
function replaceExtension(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "photo"
  return `${base}.webp`
}
