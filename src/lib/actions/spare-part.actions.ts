"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { SparePartPricingMode, SparePartStatus } from "@/generated/prisma/enums"
import { logSecurityEvent, recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import {
  canTransitionSparePartStatus,
  describeRefusedSparePartTransition,
} from "@/lib/constants/spare-part-status-transitions"
import { prisma } from "@/lib/prisma"
import {
  prepareSparePartPhotos,
  storeSparePartPhotos,
} from "@/lib/storage/spare-part-photo-service"
import { sparePartPhotoFilesSchema } from "@/lib/validations/spare-part-photo.schema"
import { generateReference } from "@/lib/utils/generate-reference"
import { buildSparePartSlug } from "@/lib/utils/slugify"
import {
  createSparePartSchema,
  updateSparePartSchema,
  updateSparePartStatusSchema,
} from "@/lib/validations/spare-part.schema"

/**
 * Spare-parts inventory mutations.
 *
 * Each follows the order every Server Action in this codebase follows —
 * validate, authorise, then write with an audit record in one transaction.
 * A Server Action compiles to a public POST endpoint; nothing here may
 * assume it was reached through the form.
 *
 * Deliberately parallel to vehicle.actions.ts, down to the form-state shape
 * and the optimistic-concurrency mechanism. Two catalogues that behave
 * differently under the same hands is how an operator learns to distrust
 * both.
 */

export interface SparePartFormState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Record<string, string[]>
  /**
   * What the operator submitted, echoed back verbatim.
   *
   * React resets a `<form action={fn}>` to its `defaultValue`s once the
   * action's transition settles — unconditionally, whether the action
   * succeeded or failed. On a rejected save that would wipe every field the
   * operator has just typed and leave them looking at an empty form telling
   * them to fill it in. Making the defaults *be* what was submitted works
   * with the reset instead of fighting it.
   */
  values?: Record<string, string>
  /**
   * The part's `updatedAt` after a successful save, as an ISO string, so the
   * form can arm its next concurrency check immediately rather than waiting
   * for `revalidatePath`. Without it, an operator who saves twice in quick
   * succession has the second save refused as a conflict with their own
   * first — a false alarm that teaches them to ignore the real warning.
   */
  updatedAt?: string
}

/**
 * The fields echoed back on a failed submission.
 *
 * An allowlist, not `Object.fromEntries(formData)`, so Next.js's own action
 * fields never end up in state serialised back to the browser.
 *
 * ⚠️ A field added to the form must be added here too, or it silently empties
 * itself on the next validation error.
 */
const SPARE_PART_FORM_FIELDS = [
  "name",
  "categoryId",
  "oemPartNumber",
  "brand",
  "condition",
  "countryOfOrigin",
  "price",
  "stockQuantity",
  "availability",
  "description",
  "isFeatured",
  "supplierName",
  "supplierNotes",
  "hiddenFields",
] as const

/** The longest description the schema accepts, with headroom. A value past
 *  this is already invalid, so echoing the whole of it would only carry a
 *  hostile payload back and forth. */
const MAX_ECHOED_LENGTH = 6000

function echoedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}

  for (const field of SPARE_PART_FORM_FIELDS) {
    const value = formData.get(field)
    if (typeof value === "string") {
      values[field] = value.slice(0, MAX_ECHOED_LENGTH)
    }
  }

  return values
}

/** Field errors in the shape the forms render. */
function toFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> }
}): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>
}

const INVALID = "Check the highlighted fields and try again."

/** Signals that the part changed after the form being saved was rendered. */
class StaleSparePartError extends Error {}

/**
 * Every surface a change to this part can be seen on, refreshed together.
 *
 * The public catalogue and the part's own public page are included: an
 * operator who corrects a price in the dashboard and then finds the old one
 * still on the website has been given a tool that lies to them, and the
 * brief's central technical requirement is that publishing a change makes it
 * appear.
 *
 * `/spare-parts` covers the catalogue at every filter, because
 * `revalidatePath` invalidates the path rather than one query string.
 */
function revalidateSparePartSurfaces(id: string, slug: string): void {
  revalidatePath(`${ADMIN_BASE_PATH}/spare-parts`)
  revalidatePath(`${ADMIN_BASE_PATH}/spare-parts/${id}`)
  revalidatePath("/spare-parts")
  revalidatePath(`/spare-parts/${slug}`)
}

/**
 * Confirms the chosen category exists and may be used.
 *
 * The select only offers real categories, so a miss here means a stale page
 * or a crafted request rather than a typo — but the foreign key would answer
 * it with a constraint violation and a 500, and this answers it with a
 * sentence. A retired category is accepted only when the part is already
 * filed under it, which is what lets an operator edit such a part without
 * being forced to recategorise it in the same save.
 */
async function resolveCategory(
  categoryId: string,
  currentCategoryId?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const category = await prisma.sparePartCategory.findUnique({
    where: { id: categoryId },
    select: { isActive: true },
  })

  if (!category) {
    return {
      ok: false,
      message: "That category no longer exists. Reload the page and choose another.",
    }
  }

  if (!category.isActive && categoryId !== currentCategoryId) {
    return {
      ok: false,
      message: "That category has been retired and cannot be used for new listings.",
    }
  }

  return { ok: true }
}

/**
 * Creates a spare part as a DRAFT.
 *
 * Redirects to the part's page on success rather than returning, because
 * that is where the listing is published from and where its fitment and
 * photographs are managed from here on.
 */
export async function createSparePartAction(
  _prevState: SparePartFormState,
  formData: FormData
): Promise<SparePartFormState> {
  const values = echoedValues(formData)

  const parsed = createSparePartSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return {
      status: "error",
      message: INVALID,
      fieldErrors: toFieldErrors(parsed.error),
      values,
    }
  }

  /**
   * Photographs are optional here.
   *
   * A listing is often entered before its photography has been taken, and
   * refusing to save the details in that case would throw away the typing
   * over an image that does not exist yet. What is *not* optional is that a
   * batch which is present must be valid.
   */
  const parsedPhotos = sparePartPhotoFilesSchema.safeParse(formData.getAll("photos"))

  if (!parsedPhotos.success) {
    return {
      status: "error",
      message:
        parsedPhotos.error.issues[0]?.message ??
        "Those photographs could not be accepted.",
      values,
    }
  }

  const auth = await authorizePermission("sparePart:write")
  if (!auth.ok) {
    return { status: "error", message: auth.message, values }
  }

  const input = parsed.data

  const category = await resolveCategory(input.categoryId)
  if (!category.ok) {
    return { status: "error", message: category.message, values }
  }

  /**
   * Every file is read and content-checked before the part row exists.
   *
   * Deliberately this way round: a rejected image then costs the operator a
   * re-selection, where checking afterwards would leave a half-made draft
   * behind for every bad file — and reference numbers, which the business
   * reads as "parts listed this year", are allocated with that row.
   */
  const prepared = await prepareSparePartPhotos(parsedPhotos.data)

  if (!prepared.ok) {
    return { status: "error", message: prepared.message, values }
  }

  let partId: string
  let partReference: string

  try {
    const created = await prisma.$transaction(async (tx) => {
      /**
       * The reference is allocated inside this transaction, so a failed
       * insert rolls the counter back with it. Allocating outside would
       * silently burn a number and leave gaps in a sequence the business
       * reads as "parts listed this year".
       */
      const reference = await generateReference(tx, "SPARE_PART")

      const part = await tx.sparePart.create({
        data: {
          referenceNumber: reference,
          // Set once, here, and never regenerated on edit — the slug is a
          // public URL that gets shared over WhatsApp and indexed.
          slug: buildSparePartSlug({
            name: input.name,
            referenceNumber: reference,
          }),
          name: input.name,
          categoryId: input.categoryId,
          // `?? null` rather than letting undefined through: Prisma reads
          // undefined as "leave the column alone", and NULL is how an
          // unrecorded value is stored. An empty string would match searches
          // and render as a blank line where a number should be.
          oemPartNumber: input.oemPartNumber ?? null,
          brand: input.brand ?? null,
          condition: input.condition,
          countryOfOrigin: input.countryOfOrigin ?? null,
          pricingMode: input.pricingMode,
          // The schema has already reconciled these: a QUOTE_ONLY part
          // arrives with no price, which is what the database CHECK requires.
          price: input.price ?? null,
          stockQuantity: input.stockQuantity,
          availability: input.availability,
          description: input.description,
          isFeatured: input.isFeatured,
          supplierName: input.supplierName ?? null,
          supplierNotes: input.supplierNotes ?? null,
          hiddenFields: input.hiddenFields,
          // Explicit rather than relying on the column default: a new
          // listing is never live until someone decides it is.
          status: SparePartStatus.DRAFT,
        },
        select: { id: true, referenceNumber: true },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "SPARE_PART_CREATED",
          entityType: "SparePart",
          entityId: part.id,
          metadata: {
            referenceNumber: part.referenceNumber,
            name: input.name,
            pricingMode: input.pricingMode,
            stockQuantity: input.stockQuantity,
            availability: input.availability,
            photoCount: prepared.photos.length,
            ...(input.hiddenFields.length > 0 ? { hiddenFields: input.hiddenFields } : {}),
          },
        },
        tx
      )

      return part
    })

    partId = created.id
    partReference = created.referenceNumber
  } catch (error) {
    console.error("[spare-part] failed to create part", error)
    return {
      status: "error",
      message: "Could not save this part. Please try again.",
      values,
    }
  }

  /**
   * Photographs are stored after the part row, in a second step.
   *
   * They cannot share its transaction: the storage objects are keyed by part
   * id, so the row has to exist first, and holding a database transaction
   * open across several seconds of uploads is how a pool runs out of
   * connections under any real load.
   *
   * So the two can diverge, and the failure is handled rather than hidden:
   * the part is saved as a DRAFT — invisible to customers — and the operator
   * lands on its page with the gallery empty and told why. Nothing is lost,
   * and the alternative (discarding a correctly-entered listing because a
   * network hiccup ate one image) is worse.
   */
  const stored = await storeSparePartPhotos({
    sparePartId: partId,
    referenceNumber: partReference,
    actorId: auth.admin.id,
    photos: prepared.photos,
    // The operator nominated the main image on the form, and it is sent
    // first. On an existing part an upload never displaces the cover; here
    // there is nothing to displace.
    firstBecomesPrimary: true,
  })

  revalidatePath(`${ADMIN_BASE_PATH}/spare-parts`)

  // Outside the try: redirect() signals by throwing, and catching it would
  // turn a successful save into a swallowed error.
  redirect(
    stored.ok
      ? `${ADMIN_BASE_PATH}/spare-parts/${partId}?created=1`
      : `${ADMIN_BASE_PATH}/spare-parts/${partId}?created=1&photos=failed`
  )
}

/**
 * Updates a part's details.
 *
 * Deliberately does not touch `slug` or `referenceNumber`. Both are public
 * identifiers: regenerating the slug because someone corrected a typo in the
 * part name would break every link already shared and every URL already
 * indexed, to fix something only the business can see.
 */
export async function updateSparePartAction(
  _prevState: SparePartFormState,
  formData: FormData
): Promise<SparePartFormState> {
  const values = echoedValues(formData)

  const parsed = updateSparePartSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return {
      status: "error",
      message: INVALID,
      fieldErrors: toFieldErrors(parsed.error),
      values,
    }
  }

  const auth = await authorizePermission("sparePart:write")
  if (!auth.ok) {
    return { status: "error", message: auth.message, values }
  }

  const { id, expectedUpdatedAt, ...input } = parsed.data

  const existing = await prisma.sparePart.findUnique({
    where: { id },
    select: {
      referenceNumber: true,
      slug: true,
      categoryId: true,
      price: true,
      pricingMode: true,
      stockQuantity: true,
      availability: true,
      hiddenFields: true,
    },
  })

  if (!existing) {
    return { status: "error", message: "That part no longer exists.", values }
  }

  const category = await resolveCategory(input.categoryId, existing.categoryId)
  if (!category.ok) {
    return { status: "error", message: category.message, values }
  }

  let savedAt: Date

  try {
    savedAt = await prisma.$transaction(async (tx) => {
      /**
       * `updateMany` with `updatedAt` in the filter, not `update` by id.
       *
       * This is the optimistic-concurrency check, and it has to be part of
       * the write rather than a comparison beforehand: reading the row,
       * comparing, then updating leaves a window in which the other save
       * lands between the two statements. Matching on the timestamp inside
       * the UPDATE closes it — Postgres either finds a row still holding the
       * value this form was rendered from, or it finds none.
       *
       * `count === 0` therefore means someone else saved first. It cannot
       * mean "no such part": that was ruled out above, and a part is never
       * deleted.
       */
      const written = await tx.sparePart.updateMany({
        where: { id, updatedAt: expectedUpdatedAt },
        data: {
          name: input.name,
          categoryId: input.categoryId,
          condition: input.condition,
          pricingMode: input.pricingMode,
          stockQuantity: input.stockQuantity,
          availability: input.availability,
          description: input.description,
          isFeatured: input.isFeatured,
          /**
           * Written as explicit nulls rather than spread through, because
           * Prisma reads `undefined` as "leave this column alone". An
           * operator who clears the manufacturer's part number means "we do
           * not have one", and spreading would silently keep the stale value
           * on the public listing.
           *
           * `price` is the sharpest case: switching a part to "price on
           * enquiry" must actually remove the figure, or the database CHECK
           * refuses the write — correctly, because a quoted part carrying a
           * price is exactly the estimated/confirmed ambiguity the brief
           * warns against.
           */
          oemPartNumber: input.oemPartNumber ?? null,
          brand: input.brand ?? null,
          countryOfOrigin: input.countryOfOrigin ?? null,
          price: input.price ?? null,
          supplierName: input.supplierName ?? null,
          supplierNotes: input.supplierNotes ?? null,
          hiddenFields: input.hiddenFields,
        },
      })

      if (written.count === 0) {
        // Thrown, not returned: this is inside the transaction, and
        // returning here would commit the audit write below.
        throw new StaleSparePartError()
      }

      /**
       * Price and stock are called out separately in the audit metadata
       * rather than left inside a generic "updated" entry. One is the figure
       * a customer is quoted from and the other is a promise about what we
       * hold — "who changed it, when, and from what" is the question that
       * gets asked when a dispute arrives.
       */
      const previousPrice = existing.price?.toNumber() ?? null
      const nextPrice = input.price ?? null

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "SPARE_PART_UPDATED",
          entityType: "SparePart",
          entityId: id,
          metadata: {
            referenceNumber: existing.referenceNumber,
            ...(previousPrice !== nextPrice
              ? { priceChangedFrom: previousPrice, priceChangedTo: nextPrice }
              : {}),
            ...(existing.pricingMode !== input.pricingMode
              ? {
                  pricingModeChangedFrom: existing.pricingMode,
                  pricingModeChangedTo: input.pricingMode,
                }
              : {}),
            ...(existing.stockQuantity !== input.stockQuantity
              ? {
                  stockChangedFrom: existing.stockQuantity,
                  stockChangedTo: input.stockQuantity,
                }
              : {}),
            ...(existing.hiddenFields.join() !== input.hiddenFields.join()
              ? { hiddenFieldsFrom: existing.hiddenFields, hiddenFieldsTo: input.hiddenFields }
              : {}),
            /**
             * Recorded alongside price and stock, and for the same reason:
             * this is a promise published to customers, so "who changed it,
             * when, and from what" is a question that gets asked when a
             * customer says they were told a part was in stock.
             */
            ...(existing.availability !== input.availability
              ? {
                  availabilityChangedFrom: existing.availability,
                  availabilityChangedTo: input.availability,
                }
              : {}),
          },
        },
        tx
      )

      /**
       * Read back inside the same transaction so the returned timestamp is
       * exactly the one now stored. Computing it here in JavaScript would
       * drift from what `@updatedAt` actually wrote, and the next save would
       * then fail its own concurrency check.
       */
      const saved = await tx.sparePart.findUniqueOrThrow({
        where: { id },
        select: { updatedAt: true },
      })

      return saved.updatedAt
    })
  } catch (error) {
    if (error instanceof StaleSparePartError) {
      /**
       * The operator's typing is still echoed back, so nothing they entered
       * is lost — they can copy what they meant to change before reloading.
       */
      return {
        status: "error",
        message:
          "Someone else saved changes to this part while you were editing it. Reload the page to see the current details, then apply your changes again.",
        values,
      }
    }

    console.error("[spare-part] failed to update part", error)
    return {
      status: "error",
      message: "Could not save those changes. Please try again.",
      values,
    }
  }

  revalidateSparePartSurfaces(id, existing.slug)

  /**
   * Confirmed explicitly rather than returning silently. A form that saves
   * without saying so leaves an operator unsure whether the click
   * registered — so they click again, or reload to check.
   */
  return {
    status: "success",
    message: "Changes saved.",
    values,
    updatedAt: savedAt.toISOString(),
  }
}

/**
 * Changes a part's status — publish, unpublish, archive.
 *
 * Separate from the details form, and separately permissioned, because these
 * are decisions rather than corrections. Publishing puts a price in front of
 * customers; archiving takes the line away. Neither belongs in a dropdown
 * someone tabs past while fixing a stock figure.
 *
 * Archiving is how a part is removed. There is no delete: `OrderItem` holds
 * a Restrict foreign key to SparePart, so a part that has ever been ordered
 * cannot be deleted at the database level — and one that has not been
 * ordered still should not be, because its reference may already be on a
 * customer's WhatsApp thread.
 */
export async function updateSparePartStatusAction(
  _prevState: SparePartFormState,
  formData: FormData
): Promise<SparePartFormState> {
  const parsed = updateSparePartStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  })

  if (!parsed.success) {
    return { status: "error", message: "That is not a valid status." }
  }

  const { id, status } = parsed.data

  /**
   * Publishing and archiving are checked against different permissions from
   * an everyday edit. With Wave A's single ADMIN role all three resolve the
   * same, but the distinction is what makes a later "staff may list, only a
   * manager may publish" split a data change rather than a rewrite.
   */
  const permission =
    status === SparePartStatus.ARCHIVED
      ? ("sparePart:archive" as const)
      : status === SparePartStatus.PUBLISHED
        ? ("sparePart:publish" as const)
        : ("sparePart:write" as const)

  const auth = await authorizePermission(permission)
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const existing = await prisma.sparePart.findUnique({
    where: { id },
    select: {
      status: true,
      referenceNumber: true,
      slug: true,
      pricingMode: true,
      price: true,
    },
  })

  if (!existing) {
    return { status: "error", message: "That part no longer exists." }
  }

  if (existing.status === status) {
    // Not an error — most likely a double submit. Saying nothing beats
    // writing a second audit row claiming a change that did not happen.
    return { status: "idle" }
  }

  /**
   * The transition itself is checked here, not only in the UI.
   *
   * `SparePartStatusControl` renders buttons from the same table, but that
   * runs in the browser and decides nothing. Without this check a crafted
   * POST — or a tab left open across someone else's change — could move an
   * archived part straight back onto the public catalogue at whatever price
   * it carried when it was withdrawn.
   */
  if (!canTransitionSparePartStatus(existing.status, status)) {
    logSecurityEvent("spare_part_status_transition_refused", {
      actorId: auth.admin.id,
      sparePartId: id,
      from: existing.status,
      to: status,
    })

    return {
      status: "error",
      message: describeRefusedSparePartTransition(existing.status, status),
    }
  }

  /**
   * A last check before the part becomes visible.
   *
   * The database CHECK already makes a priced part without a price
   * impossible, so this cannot normally fire — it exists because publishing
   * is the moment the figure stops being internal, and a defence that only
   * runs on the way in is one migration away from being the only defence
   * that ever ran.
   */
  if (
    status === SparePartStatus.PUBLISHED &&
    existing.pricingMode === SparePartPricingMode.FIXED &&
    existing.price === null
  ) {
    return {
      status: "error",
      message:
        "This part is priced but has no price. Add one, or set it to 'Price on enquiry', before publishing.",
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.sparePart.update({ where: { id }, data: { status } })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "SPARE_PART_STATUS_CHANGED",
          entityType: "SparePart",
          entityId: id,
          metadata: {
            referenceNumber: existing.referenceNumber,
            previousStatus: existing.status,
            newStatus: status,
          },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[spare-part] failed to change part status", error)
    return {
      status: "error",
      message: "Could not change the status. Please try again.",
    }
  }

  revalidateSparePartSurfaces(id, existing.slug)

  return {
    status: "success",
    message: `Status changed to ${status.toLowerCase()}.`,
  }
}
