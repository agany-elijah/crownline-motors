import { describe, expect, it } from "vitest"

import { sniffImageType } from "@/lib/storage/image-signature"
import {
  MAX_PHOTOS_PER_UPLOAD,
  MAX_PHOTOS_PER_VEHICLE,
  MAX_PHOTO_ALT_TEXT_LENGTH,
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_BATCH_BYTES,
} from "@/lib/constants/vehicle-photo-options"
import {
  vehiclePhotoAltTextSchema,
  vehiclePhotoFilesSchema,
  vehiclePhotoOrderSchema,
  vehiclePhotoRefSchema,
  vehiclePhotoUploadSchema,
} from "@/lib/validations/vehicle-photo.schema"

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** A File of a given size, without allocating the bytes for real — the
 *  schema only reads `size`, and an 8MB Uint8Array per case is wasteful. */
function fileOfSize(bytes: number, name = "photo.jpg"): File {
  const file = new File(["x"], name, { type: "image/jpeg" })
  Object.defineProperty(file, "size", { value: bytes })
  return file
}

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values)
}

/** Pads a header out to the twelve bytes the sniffer requires. */
function header(...values: number[]): Uint8Array {
  const out = new Uint8Array(12)
  out.set(values.slice(0, 12))
  return out
}

function asciiBytes(text: string, length = 12): Uint8Array {
  const out = new Uint8Array(length)
  for (let i = 0; i < text.length && i < length; i += 1) {
    out[i] = text.charCodeAt(i)
  }
  return out
}

/* ── Image type sniffing ─────────────────────────────────────────────── */

describe("sniffImageType", () => {
  it("identifies a JPEG by its SOI marker", () => {
    expect(sniffImageType(header(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg")
  })

  it("identifies a PNG by its full eight-byte signature", () => {
    expect(
      sniffImageType(header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    ).toBe("image/png")
  })

  it("identifies WebP by both the RIFF container and the form type", () => {
    const webp = asciiBytes("RIFF")
    webp.set(asciiBytes("WEBP", 4), 8)
    expect(sniffImageType(webp)).toBe("image/webp")
  })

  it("identifies AVIF by its ftyp brand", () => {
    const avif = new Uint8Array(12)
    avif.set(asciiBytes("ftyp", 4), 4)
    avif.set(asciiBytes("avif", 4), 8)
    expect(sniffImageType(avif)).toBe("image/avif")
  })

  it("rejects a RIFF container that is not WebP", () => {
    // A WAV file also begins "RIFF". Checking only the first four bytes
    // would accept it.
    const wav = asciiBytes("RIFF")
    wav.set(asciiBytes("WAVE", 4), 8)
    expect(sniffImageType(wav)).toBeNull()
  })

  it("rejects the AVIF image-sequence brand", () => {
    const avis = new Uint8Array(12)
    avis.set(asciiBytes("ftyp", 4), 4)
    avis.set(asciiBytes("avis", 4), 8)
    expect(sniffImageType(avis)).toBeNull()
  })

  it("rejects HTML regardless of what it claims to be", () => {
    // The attack this check exists to stop: a script uploaded as "car.jpg"
    // with Content-Type image/jpeg. Neither of those reaches the sniffer.
    expect(sniffImageType(asciiBytes("<!DOCTYPE html>"))).toBeNull()
  })

  it("rejects an SVG, which is an image format that can carry script", () => {
    expect(sniffImageType(asciiBytes("<svg xmlns=..."))).toBeNull()
  })

  it("rejects a truncated file rather than guessing", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff))).toBeNull()
    expect(sniffImageType(new Uint8Array(0))).toBeNull()
  })
})

/* ── Upload validation ───────────────────────────────────────────────── */

describe("vehiclePhotoUploadSchema", () => {
  const base = { vehicleId: "clx1234567890" }

  it("accepts a normal batch", () => {
    const result = vehiclePhotoUploadSchema.safeParse({
      ...base,
      files: [fileOfSize(1_000_000), fileOfSize(2_000_000)],
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.files).toHaveLength(2)
  })

  it("discards the empty File an untouched file input submits", () => {
    // A file input with nothing chosen still yields one zero-byte File.
    // Without the filter this parses as a one-file upload.
    const result = vehiclePhotoUploadSchema.safeParse({
      ...base,
      files: [new File([], "")],
    })

    expect(result.success).toBe(false)
  })

  it("rejects a file over the per-file ceiling", () => {
    const result = vehiclePhotoUploadSchema.safeParse({
      ...base,
      files: [fileOfSize(MAX_PHOTO_BYTES + 1)],
    })

    expect(result.success).toBe(false)
  })

  it("rejects more files than one batch allows", () => {
    const result = vehiclePhotoUploadSchema.safeParse({
      ...base,
      files: Array.from({ length: MAX_PHOTOS_PER_UPLOAD + 1 }, () =>
        fileOfSize(1000)
      ),
    })

    expect(result.success).toBe(false)
  })

  it("rejects a batch that is individually fine but collectively too large", () => {
    // Each file passes MAX_PHOTO_BYTES; the total does not. Checking only
    // per-file size would let this through and hit the framework's body
    // limit instead, which produces no usable message.
    const perFile = MAX_PHOTO_BYTES
    const count = Math.ceil(MAX_UPLOAD_BATCH_BYTES / perFile) + 1

    expect(count).toBeLessThanOrEqual(MAX_PHOTOS_PER_UPLOAD)

    const result = vehiclePhotoUploadSchema.safeParse({
      ...base,
      files: Array.from({ length: count }, () => fileOfSize(perFile)),
    })

    expect(result.success).toBe(false)
  })

  it("rejects an id carrying anything but cuid characters", () => {
    for (const vehicleId of ["../etc/passwd", "abc def", "abc-123'", ""]) {
      expect(
        vehiclePhotoUploadSchema.safeParse({
          ...base,
          vehicleId,
          files: [fileOfSize(1000)],
        }).success
      ).toBe(false)
    }
  })
})

describe("vehiclePhotoFilesSchema", () => {
  it("accepts an empty selection, which the create form relies on", () => {
    // A listing is often entered before its photography has been sourced.
    // Refusing to save the details in that case would throw away seventeen
    // fields of typing over an image that does not exist yet.
    const result = vehiclePhotoFilesSchema.safeParse([new File([], "")])

    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toHaveLength(0)
  })

  it("still applies every size and count limit to a batch that is present", () => {
    expect(
      vehiclePhotoFilesSchema.safeParse([fileOfSize(MAX_PHOTO_BYTES + 1)]).success
    ).toBe(false)

    expect(
      vehiclePhotoFilesSchema.safeParse(
        Array.from({ length: MAX_PHOTOS_PER_UPLOAD + 1 }, () => fileOfSize(1000))
      ).success
    ).toBe(false)
  })
})

/* ── Mutation payloads ───────────────────────────────────────────────── */

describe("vehiclePhotoRefSchema", () => {
  it("requires both ids, so ownership can be asserted", () => {
    expect(
      vehiclePhotoRefSchema.safeParse({ photoId: "clxphoto1" }).success
    ).toBe(false)

    expect(
      vehiclePhotoRefSchema.safeParse({
        vehicleId: "clxvehicle1",
        photoId: "clxphoto1",
      }).success
    ).toBe(true)
  })
})

describe("vehiclePhotoOrderSchema", () => {
  const vehicleId = "clv1abc23def45ghi67jkl890"
  const photoIds = ["clp1aaa", "clp2bbb", "clp3ccc"]

  it("accepts a list of photograph ids in a new order", () => {
    const result = vehiclePhotoOrderSchema.safeParse({ vehicleId, photoIds })

    expect(result.success).toBe(true)
    expect(result.data?.photoIds).toEqual(photoIds)
  })

  it("refuses a repeated id", () => {
    // Same length as a valid submission, so only the uniqueness check
    // catches it. Applied blindly it would renumber one photograph twice and
    // silently strand another.
    const result = vehiclePhotoOrderSchema.safeParse({
      vehicleId,
      photoIds: ["clp1aaa", "clp1aaa", "clp2bbb"],
    })

    expect(result.success).toBe(false)
  })

  it("refuses an empty order", () => {
    expect(
      vehiclePhotoOrderSchema.safeParse({ vehicleId, photoIds: [] }).success
    ).toBe(false)
  })

  it("refuses more ids than a vehicle can hold", () => {
    // A bound on the array itself, so a request cannot make the action loop
    // over an unbounded list before the database ever refuses it.
    const tooMany = Array.from(
      { length: MAX_PHOTOS_PER_VEHICLE + 1 },
      (_, index) => `clp${index}`
    )

    expect(
      vehiclePhotoOrderSchema.safeParse({ vehicleId, photoIds: tooMany }).success
    ).toBe(false)
  })

  it("refuses ids that are not the shape Prisma issues", () => {
    // The id format is constrained so a hand-crafted value cannot reach a
    // query as something exotic.
    for (const bad of ["../../etc/passwd", "id with spaces", "id-with-dash", ""]) {
      expect(
        vehiclePhotoOrderSchema.safeParse({ vehicleId, photoIds: [bad] }).success,
        `photoId ${JSON.stringify(bad)}`
      ).toBe(false)
    }
  })

  it("refuses a missing vehicle id", () => {
    expect(vehiclePhotoOrderSchema.safeParse({ photoIds }).success).toBe(false)
  })
})

describe("vehiclePhotoAltTextSchema", () => {
  const base = {
    vehicleId: "clv1abc23def45ghi67jkl890",
    photoId: "clp1aaa",
  }

  it("accepts a description and trims it", () => {
    const result = vehiclePhotoAltTextSchema.safeParse({
      ...base,
      altText: "  Front three-quarter view, offside  ",
    })

    expect(result.success).toBe(true)
    expect(result.data?.altText).toBe("Front three-quarter view, offside")
  })

  /**
   * An empty submission means "clear this and go back to the generated
   * description", and must reach the database as NULL rather than "".
   * An empty `alt` attribute tells a screen reader to skip the image
   * entirely, which for a content photograph is worse than a generic
   * description.
   */
  it("normalises an empty description to null, never an empty string", () => {
    for (const empty of ["", "   "]) {
      const result = vehiclePhotoAltTextSchema.safeParse({ ...base, altText: empty })

      expect(result.success).toBe(true)
      expect(result.data?.altText).toBeNull()
    }
  })

  it("refuses a description past the length cap", () => {
    const result = vehiclePhotoAltTextSchema.safeParse({
      ...base,
      altText: "x".repeat(MAX_PHOTO_ALT_TEXT_LENGTH + 1),
    })

    expect(result.success).toBe(false)
  })

  it("accepts a description exactly at the cap", () => {
    const result = vehiclePhotoAltTextSchema.safeParse({
      ...base,
      altText: "x".repeat(MAX_PHOTO_ALT_TEXT_LENGTH),
    })

    expect(result.success).toBe(true)
  })

  it("refuses a photograph reference that is not well formed", () => {
    expect(
      vehiclePhotoAltTextSchema.safeParse({ ...base, photoId: "../x", altText: "a" })
        .success
    ).toBe(false)
  })
})
