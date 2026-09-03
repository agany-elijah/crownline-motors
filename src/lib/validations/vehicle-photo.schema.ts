import { z } from "zod"

import {
  MAX_PHOTOS_PER_UPLOAD,
  MAX_PHOTOS_PER_VEHICLE,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_ALT_TEXT_LENGTH,
  MAX_UPLOAD_BATCH_BYTES,
  formatMegabytes,
} from "@/lib/constants/vehicle-photo-options"

/**
 * Validation for vehicle photograph management.
 *
 * Everything a Server Action receives is untrusted, including the parts of
 * a `FormData` that a form would never produce — a Server Action compiles
 * to a public POST endpoint and nothing here may assume it was reached
 * through the uploader.
 *
 * The file checks below are the *cheap* half: count, declared size. The half
 * that actually decides what a file is — reading its leading bytes — happens
 * in the storage service, because it needs the file's contents and Zod
 * should not be pulling multi-megabyte bodies into memory to run a
 * refinement.
 */

/** Ids are cuids from Prisma. Bounded and character-restricted so a
 *  hand-crafted value cannot reach a query as something exotic. */
const id = (field: string) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required.`)
    .max(64, `${field} is not valid.`)
    .regex(/^[a-z0-9]+$/i, `${field} is not valid.`)

/**
 * The files from an upload.
 *
 * `FormData.getAll()` yields one entry per selected file, and an empty file
 * input still yields a single zero-byte `File` with an empty name — hence
 * the filter before the count check, which otherwise reports "1 file" for
 * an empty submission.
 *
 * Exported on its own so the create-vehicle action can validate the
 * photographs staged alongside the details, using the identical rules
 * rather than a second, drifting copy of them.
 */
export const vehiclePhotoFilesSchema = z
  .array(z.instanceof(File))
  .transform((files) => files.filter((file) => file.size > 0))
  .pipe(
    z
      .array(z.instanceof(File))
      .max(
        MAX_PHOTOS_PER_UPLOAD,
        `Upload at most ${MAX_PHOTOS_PER_UPLOAD} photographs at a time.`
      )
      .refine((files) => files.every((file) => file.size <= MAX_PHOTO_BYTES), {
        message: `Each photograph must be ${formatMegabytes(MAX_PHOTO_BYTES)} or smaller.`,
      })
      .refine(
        (files) =>
          files.reduce((total, file) => total + file.size, 0) <=
          MAX_UPLOAD_BATCH_BYTES,
        {
          message: `That batch is over ${formatMegabytes(MAX_UPLOAD_BATCH_BYTES)} in total. Upload it in smaller groups.`,
        }
      )
  )

/**
 * The uploader's payload.
 *
 * At least one file, because pressing Upload with nothing chosen is a
 * mistake worth naming rather than a silent no-op. The create-vehicle form
 * uses `vehiclePhotoFilesSchema` directly instead, where an empty selection
 * is legitimate: a listing may be saved as a draft before any photography
 * exists, and refusing to save the details in that case would lose the
 * operator's typing over an image they have not taken yet.
 */
export const vehiclePhotoUploadSchema = z.object({
  vehicleId: id("Vehicle"),
  files: vehiclePhotoFilesSchema.pipe(
    z.array(z.instanceof(File)).min(1, "Choose at least one photograph.")
  ),
})

export type VehiclePhotoUploadInput = z.infer<typeof vehiclePhotoUploadSchema>

/** Identifies one photo, and the vehicle it must belong to.
 *
 *  The vehicle id is carried on every mutation rather than being looked up
 *  from the photo, so the action can assert the two match. Without it, a
 *  photo id guessed from another listing would be actioned happily — the
 *  classic insecure-direct-object-reference. */
export const vehiclePhotoRefSchema = z.object({
  vehicleId: id("Vehicle"),
  photoId: id("Photo"),
})

export type VehiclePhotoRefInput = z.infer<typeof vehiclePhotoRefSchema>

/**
 * A new order for a vehicle's gallery.
 *
 * The whole ordered list is submitted rather than "move this one up",
 * because the server can then verify the result is a permutation of exactly
 * what is stored — no photograph silently dropped, none belonging to another
 * listing spliced in, no gap left behind. It is also idempotent: replaying
 * the same request twice produces the same gallery, which a
 * move-by-one-position request cannot promise.
 *
 * The ids arrive as one `photoIds` field per photograph, which is what
 * `FormData.getAll()` yields from repeated hidden inputs.
 */
export const vehiclePhotoOrderSchema = z.object({
  vehicleId: id("Vehicle"),
  photoIds: z
    .array(id("Photo"))
    .min(1, "Nothing to reorder.")
    .max(MAX_PHOTOS_PER_VEHICLE, "That is more photographs than a vehicle can hold.")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "That photograph order is not valid.",
    }),
})

export type VehiclePhotoOrderInput = z.infer<typeof vehiclePhotoOrderSchema>

/**
 * A photograph's alternative text.
 *
 * Optional, and empty means "fall back to the generated description" rather
 * than "no description" — an empty `alt` tells a screen reader to skip the
 * image entirely, which is wrong for a content photograph. See
 * `describeVehiclePhoto`, which is what renders when this is null.
 *
 * Length-capped because it is written into the public page's markup: alt
 * text is a description, and anything past a couple of lines is being used
 * as something else.
 */
export const vehiclePhotoAltTextSchema = z.object({
  vehicleId: id("Vehicle"),
  photoId: id("Photo"),
  altText: z
    .string()
    .trim()
    .max(
      MAX_PHOTO_ALT_TEXT_LENGTH,
      `Keep the description under ${MAX_PHOTO_ALT_TEXT_LENGTH} characters.`
    )
    // "" is a legitimate submission meaning "clear this and go back to the
    // generated description", so it is normalised to null here rather than
    // being rejected or stored as an empty string.
    .transform((value) => (value.length === 0 ? null : value)),
})

export type VehiclePhotoAltTextInput = z.infer<typeof vehiclePhotoAltTextSchema>
