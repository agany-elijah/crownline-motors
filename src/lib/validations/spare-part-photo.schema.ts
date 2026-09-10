import { z } from "zod"

import {
  MAX_PHOTOS_PER_SPARE_PART,
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_BATCH_BYTES,
  formatMegabytes,
} from "@/lib/constants/spare-part-photo-options"

/**
 * Validation for spare-part photograph management.
 *
 * Everything a Server Action receives is untrusted, including the parts of a
 * `FormData` that a form would never produce — a Server Action compiles to a
 * public POST endpoint and nothing here may assume it was reached through the
 * uploader.
 *
 * The file checks below are the *cheap* half: count, declared size. The half
 * that actually decides what a file is — reading its leading bytes — happens
 * in the storage service, because it needs the file's contents and Zod should
 * not be pulling multi-megabyte bodies into memory to run a refinement.
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
 * input still yields a single zero-byte `File` with an empty name — hence the
 * filter before the count check, which otherwise reports "1 file" for an
 * empty submission.
 *
 * Exported on its own so the create-part action can validate the photographs
 * staged alongside the details, using the identical rules rather than a
 * second, drifting copy of them.
 *
 * The per-batch ceiling is `MAX_PHOTOS_PER_SPARE_PART` rather than a separate
 * smaller number: a whole part gallery is ten frames, so there is no case
 * where a legitimate batch is bigger than a legitimate gallery.
 */
export const sparePartPhotoFilesSchema = z
  .array(z.instanceof(File))
  .transform((files) => files.filter((file) => file.size > 0))
  .pipe(
    z
      .array(z.instanceof(File))
      .max(
        MAX_PHOTOS_PER_SPARE_PART,
        `Upload at most ${MAX_PHOTOS_PER_SPARE_PART} photographs at a time.`
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
 * At least one file, because pressing Upload with nothing chosen is a mistake
 * worth naming rather than a silent no-op. The create-part form uses
 * `sparePartPhotoFilesSchema` directly instead, where an empty selection is
 * legitimate: a listing may be saved as a draft before any photography
 * exists, and refusing to save the details in that case would lose the
 * operator's typing over an image they have not taken yet.
 */
export const sparePartPhotoUploadSchema = z.object({
  sparePartId: id("Part"),
  files: sparePartPhotoFilesSchema.pipe(
    z.array(z.instanceof(File)).min(1, "Choose at least one photograph.")
  ),
})

export type SparePartPhotoUploadInput = z.infer<typeof sparePartPhotoUploadSchema>

/**
 * Identifies one photo, and the part it must belong to.
 *
 * The part id is carried on every mutation rather than being looked up from
 * the photo, so the action can assert the two match. Without it, a photo id
 * guessed from another listing would be actioned happily — the classic
 * insecure-direct-object-reference.
 */
export const sparePartPhotoRefSchema = z.object({
  sparePartId: id("Part"),
  photoId: id("Photo"),
})

export type SparePartPhotoRefInput = z.infer<typeof sparePartPhotoRefSchema>

/**
 * A new order for a part's gallery.
 *
 * The whole ordered list is submitted rather than "move this one up", because
 * the server can then verify the result is a permutation of exactly what is
 * stored — no photograph silently dropped, none belonging to another listing
 * spliced in, no gap left behind. It is also idempotent: replaying the same
 * request twice produces the same gallery, which a move-by-one-position
 * request cannot promise.
 */
export const sparePartPhotoOrderSchema = z.object({
  sparePartId: id("Part"),
  photoIds: z
    .array(id("Photo"))
    .min(1, "Nothing to reorder.")
    .max(MAX_PHOTOS_PER_SPARE_PART, "That is more photographs than a part can hold.")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "That photograph order is not valid.",
    }),
})

export type SparePartPhotoOrderInput = z.infer<typeof sparePartPhotoOrderSchema>
