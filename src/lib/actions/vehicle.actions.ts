"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { VehicleStatus } from "@/generated/prisma/enums"
import { logSecurityEvent, recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { revalidateVehicleSurfaces } from "@/lib/cache/vehicle-surfaces"
import {
  canTransitionVehicleStatus,
  describeRefusedTransition,
} from "@/lib/constants/vehicle-status-transitions"

import { prisma } from "@/lib/prisma"
import {
  prepareVehiclePhotos,
  storeVehiclePhotos,
} from "@/lib/storage/vehicle-photo-service"
import { generateReference } from "@/lib/utils/generate-reference"
import { buildVehicleSlug } from "@/lib/utils/slugify"
import { vehiclePhotoFilesSchema } from "@/lib/validations/vehicle-photo.schema"
import {
  createVehicleSchema,
  updateVehicleSchema,
  updateVehicleStatusSchema,
} from "@/lib/validations/vehicle.schema"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

/**
 * Vehicle inventory mutations.
 *
 * Each follows the order every Server Action in this codebase follows —
 * validate, authorise, then write with an audit record in one transaction.
 * A Server Action compiles to a public POST endpoint; nothing here may
 * assume it was reached through the form.
 */

export interface VehicleFormState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Record<string, string[]>
  /**
   * What the operator submitted, echoed back verbatim.
   *
   * ── Why this exists ────────────────────────────────────────────────
   * React resets a `<form action={fn}>` to its `defaultValue`s once the
   * action's transition settles — unconditionally, whether the action
   * succeeded or failed (see `startHostTransition` in react-dom, which calls
   * `requestFormReset` before invoking the action). On a successful create
   * that is invisible, because the action redirects. On a rejected one it
   * wipes seventeen fields the operator has just typed and leaves them
   * looking at an empty form telling them to fill it in.
   *
   * Fighting the reset — controlled inputs, a form `key`, `preventDefault` —
   * either gives up progressive enhancement or fights the framework. Making
   * the defaults *be* what was submitted works with it: the reset still
   * happens and restores exactly what was there.
   */
  values?: Record<string, string>
  /**
   * The vehicle's `updatedAt` after a successful save, as an ISO string.
   *
   * Returned so the form can arm its next optimistic-concurrency check
   * immediately, rather than waiting for `revalidatePath` to push a fresh
   * `vehicle` prop down. Without it, an operator who saves twice in quick
   * succession would have the second save refused as a conflict with their
   * own first one — a false alarm that would teach them to ignore the real
   * warning.
   */
  updatedAt?: string
}

/**
 * The fields echoed back on a failed submission.
 *
 * An allowlist, not `Object.fromEntries(formData)`. The form also carries
 * photograph `File`s and Next.js's own action fields, neither of which
 * belongs in state that is serialised back to the browser.
 */
const VEHICLE_FORM_FIELDS = [
  "make",
  "model",
  "year",
  "countryOfOrigin",
  "condition",
  "price",
  "shippingEstimate",
  "clearingEstimate",
  "otherChargesEst",
  "mileageKm",
  "engineSize",
  "fuelType",
  "transmission",
  "driveType",
  "bodyType",
  "currentLocation",
  "exteriorColor",
  "interiorColor",
  "description",
  "features",
  "isFeatured",
  "hiddenFields",
] as const

/** The longest description the schema accepts, with headroom. A value past
 *  this is already invalid, so echoing the whole of it would only carry a
 *  hostile payload back and forth. */
const MAX_ECHOED_LENGTH = 6000

function echoedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}

  for (const field of VEHICLE_FORM_FIELDS) {
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

/** Signals that the vehicle changed after the form being saved was rendered. */
class StaleVehicleError extends Error {}

/*
 * A status change is no longer refused because an open order names the
 * vehicle.
 *
 * It used to be: PUBLISHED, DRAFT and ARCHIVED were "releasing" statuses,
 * blocked while an order held the car, on the reasoning that republishing it
 * would resell a car a customer had paid a deposit against. That reasoning
 * belonged to a dealership selling the one car on its floor. This one sources
 * from external dealers, so a listing is a vehicle it can obtain and an order
 * against it takes nothing off the marketplace — see create-order-from-quote.ts.
 *
 * The transition table (`canTransitionVehicleStatus`) is still enforced here,
 * so the status graph itself is unchanged; what is gone is the extra refusal
 * on top of it.
 */

/**
 * Creates a vehicle as a DRAFT, with the photographs staged alongside it.
 *
 * Redirects to the vehicle's page on success rather than returning, because
 * that is where the listing is published from and where its gallery is
 * managed from here on.
 */
export async function createVehicleAction(
  _prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const values = echoedValues(formData)

  const parsed = createVehicleSchema.safeParse(Object.fromEntries(formData))

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
   * A listing is often entered before its photography has been sourced, and
   * refusing to save the details in that case would throw away the typing
   * over an image that does not exist yet. What is *not* optional is that a
   * batch which is present must be valid — see the note in the schema.
   */
  const parsedPhotos = vehiclePhotoFilesSchema.safeParse(formData.getAll("photos"))

  if (!parsedPhotos.success) {
    return {
      status: "error",
      message:
        parsedPhotos.error.issues[0]?.message ??
        "Those photographs could not be accepted.",
      values,
    }
  }

  const auth = await authorizePermission("vehicle:write")
  if (!auth.ok) {
    return { status: "error", message: auth.message, values }
  }

  /**
   * Every file is read and content-checked before the vehicle row exists.
   *
   * Deliberately this way round: a rejected image then costs the operator a
   * re-selection, where checking afterwards would leave a half-made draft
   * behind for every bad file — and reference numbers, which the business
   * reads as "vehicles listed this year", are allocated with that row.
   */
  const prepared = await prepareVehiclePhotos(parsedPhotos.data)

  if (!prepared.ok) {
    return { status: "error", message: prepared.message, values }
  }

  const input = parsed.data
  let vehicleId: string
  let referenceNumber: string

  try {
    const created = await prisma.$transaction(async (tx) => {
      /**
       * The reference is allocated inside this transaction, so a failed
       * insert rolls the counter back with it. Allocating outside would
       * silently burn a number and leave gaps in a sequence the business
       * reads as "vehicles listed this year".
       */
      const reference = await generateReference(tx, "VEHICLE")

      const vehicle = await tx.vehicle.create({
        data: {
          referenceNumber: reference,
          // Set once, here, and never regenerated on edit — the slug is a
          // public URL that gets shared over WhatsApp and indexed.
          slug: buildVehicleSlug({
            make: input.make,
            model: input.model,
            year: input.year,
            referenceNumber: reference,
          }),
          make: input.make,
          model: input.model,
          year: input.year,
          price: input.price,
          mileageKm: input.mileageKm,
          fuelType: input.fuelType,
          transmission: input.transmission,
          engineSize: input.engineSize,
          driveType: input.driveType,
          bodyType: input.bodyType,
          exteriorColor: input.exteriorColor,
          interiorColor: input.interiorColor,
          countryOfOrigin: input.countryOfOrigin,
          currentLocation: input.currentLocation,
          condition: input.condition,
          // `?? null` rather than passing undefined through: an estimate
          // the operator left blank is genuinely "not estimated yet", and
          // NULL is how the column says that. Zero would render on the
          // public page as a confirmed charge of nothing.
          shippingEstimate: input.shippingEstimate ?? null,
          clearingEstimate: input.clearingEstimate ?? null,
          otherChargesEst: input.otherChargesEst ?? null,
          description: input.description,
          features: input.features,
          isFeatured: input.isFeatured,
          hiddenFields: input.hiddenFields,
          // Explicit rather than relying on the column default: a new
          // listing is never live until someone decides it is.
          status: VehicleStatus.DRAFT,
        },
        select: { id: true, referenceNumber: true },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "VEHICLE_CREATED",
          entityType: "Vehicle",
          entityId: vehicle.id,
          metadata: {
            referenceNumber: vehicle.referenceNumber,
            vehicle: `${input.year} ${input.make} ${input.model}`,
            photoCount: prepared.photos.length,
            ...(input.hiddenFields.length > 0 ? { hiddenFields: input.hiddenFields } : {}),
          },
        },
        tx
      )

      return vehicle
    })

    vehicleId = created.id
    referenceNumber = created.referenceNumber
  } catch (error) {
    console.error("[vehicle] failed to create vehicle", error)
    return {
      status: "error",
      message: "Could not save this vehicle. Please try again.",
      values,
    }
  }

  /**
   * Photographs are stored after the vehicle row, in a second step.
   *
   * They cannot share its transaction: the storage objects are keyed by
   * vehicle id, so the row has to exist first, and holding a database
   * transaction open across several seconds of uploads is how a pool runs
   * out of connections under any real load.
   *
   * So the two can diverge, and the failure is handled rather than hidden:
   * the vehicle is saved as a DRAFT — invisible to customers — and the
   * operator lands on its page with the gallery empty and told why. Nothing
   * is lost, and the alternative (discarding a correctly-entered listing
   * because a network hiccup ate one image) is worse.
   */
  const stored = await storeVehiclePhotos({
    vehicleId,
    referenceNumber,
    actorId: auth.admin.id,
    photos: prepared.photos,
    // The operator nominated the main image on the form, and it is sent
    // first. On an existing vehicle an upload never displaces the cover;
    // here there is nothing to displace.
    firstBecomesPrimary: true,
  })

  revalidatePath(`${ADMIN_BASE_PATH}/vehicles`)

  // Outside the try: redirect() signals by throwing, and catching it would
  // turn a successful save into a swallowed error.
  redirect(
    stored.ok
      ? `${ADMIN_BASE_PATH}/vehicles/${vehicleId}?created=1`
      : `${ADMIN_BASE_PATH}/vehicles/${vehicleId}?created=1&photos=failed`
  )
}

/**
 * Updates a vehicle's details.
 *
 * Deliberately does not touch `slug` or `referenceNumber`. Both are public
 * identifiers: regenerating the slug because someone corrected a typo in the
 * model name would break every link already shared and every URL already
 * indexed, to fix something only the business can see.
 */
export async function updateVehicleAction(
  _prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const values = echoedValues(formData)

  const parsed = updateVehicleSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return {
      status: "error",
      message: INVALID,
      fieldErrors: toFieldErrors(parsed.error),
      values,
    }
  }

  const auth = await authorizePermission("vehicle:write")
  if (!auth.ok) {
    return { status: "error", message: auth.message, values }
  }

  const { id, expectedUpdatedAt, ...input } = parsed.data

  const existing = await prisma.vehicle.findUnique({
    where: { id },
    select: { id: true, referenceNumber: true, slug: true, price: true, status: true, hiddenFields: true },
  })

  if (!existing) {
    return { status: "error", message: "That vehicle no longer exists.", values }
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
       * mean "no such vehicle": that was ruled out above, and a vehicle is
       * never deleted.
       */
      const written = await tx.vehicle.updateMany({
        where: { id, updatedAt: expectedUpdatedAt },
        data: {
          ...input,
          /**
           * Written explicitly instead of spreading through, because Prisma
           * reads `undefined` as "leave this column alone". An operator who
           * clears a shipping estimate means "we no longer have one", and
           * spreading would silently keep the stale figure on the public
           * listing — a wrong price shown with confidence.
           *
           * `features` needs no such treatment: the schema turns an empty
           * textarea into `[]`, never `undefined`, so clearing the list
           * genuinely clears the column rather than leaving equipment on a
           * listing that no longer has it.
           */
          shippingEstimate: input.shippingEstimate ?? null,
          clearingEstimate: input.clearingEstimate ?? null,
          otherChargesEst: input.otherChargesEst ?? null,
        },
      })

      if (written.count === 0) {
        // Thrown, not returned: this is inside the transaction, and
        // returning here would commit the audit write below.
        throw new StaleVehicleError()
      }

      /**
       * The price is called out separately in the audit metadata rather
       * than left inside a generic "updated" entry. It is the figure a
       * customer is quoted from, and "who changed the price, when, and from
       * what" is the question that gets asked when a dispute arrives.
       */
      const previousPrice = existing.price.toNumber()

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "VEHICLE_UPDATED",
          entityType: "Vehicle",
          entityId: id,
          metadata: {
            referenceNumber: existing.referenceNumber,
            ...(previousPrice !== input.price
              ? { priceChangedFrom: previousPrice, priceChangedTo: input.price }
              : {}),
            // What customers can see is a publishing decision, so a change
            // to it is recorded as plainly as a price change.
            ...(existing.hiddenFields.join() !== input.hiddenFields.join()
              ? { hiddenFieldsFrom: existing.hiddenFields, hiddenFieldsTo: input.hiddenFields }
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
      const saved = await tx.vehicle.findUniqueOrThrow({
        where: { id },
        select: { updatedAt: true },
      })

      return saved.updatedAt
    })
  } catch (error) {
    if (error instanceof StaleVehicleError) {
      /**
       * The operator's typing is still echoed back, so nothing they entered
       * is lost — they can copy what they meant to change before reloading.
       * Telling them to reload while discarding their work would be a worse
       * answer than the silent overwrite this replaced.
       */
      return {
        status: "error",
        message:
          "Someone else saved changes to this vehicle while you were editing it. Reload the page to see the current details, then apply your changes again.",
        values,
      }
    }

    console.error("[vehicle] failed to update vehicle", error)
    return {
      status: "error",
      message: "Could not save those changes. Please try again.",
      values,
    }
  }

  revalidateVehicleSurfaces(id, existing.slug)

  /**
   * Confirmed explicitly rather than returning silently.
   *
   * A form that saves without saying so leaves an operator unsure whether
   * the click registered — so they click again, or reload to check. On a
   * page where the fields still show what they typed, "nothing happened" and
   * "it saved" look identical.
   *
   * The values are echoed on success too, for the same reason as on failure:
   * React resets the form either way, and the saved values are what the
   * fields must settle on.
   */
  return {
    status: "success",
    message: "Changes saved.",
    values,
    updatedAt: savedAt.toISOString(),
  }
}

/**
 * Changes a vehicle's status — publish, reserve, mark sold, archive.
 *
 * Separate from the details form, and separately permissioned, because
 * these are decisions rather than corrections. Publishing puts a vehicle in
 * front of customers; archiving takes it away. Neither belongs in a
 * dropdown someone tabs past while fixing the mileage.
 *
 * Archiving is how a vehicle is removed. There is no delete: `OrderItem`
 * and `Shipment` hold Restrict foreign keys to Vehicle, so a vehicle that
 * has ever been ordered cannot be deleted at the database level — and one
 * that has not been ordered still should not be, because the reference
 * number may already be on a customer's email.
 */
export async function updateVehicleStatusAction(
  _prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const parsed = updateVehicleStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  })

  if (!parsed.success) {
    return { status: "error", message: "That is not a valid status." }
  }

  const { id, status } = parsed.data

  /**
   * Publishing and archiving are checked against different permissions from
   * an everyday edit. With Wave A's single ADMIN role both resolve the
   * same, but the distinction is what makes a later "staff may list, only a
   * manager may publish" split a data change rather than a rewrite.
   */
  const permission =
    status === VehicleStatus.ARCHIVED
      ? ("vehicle:archive" as const)
      : status === VehicleStatus.PUBLISHED
        ? ("vehicle:publish" as const)
        : ("vehicle:write" as const)

  const auth = await authorizePermission(permission)
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const existing = await prisma.vehicle.findUnique({
    where: { id },
    select: { status: true, referenceNumber: true, slug: true },
  })

  if (!existing) {
    return { status: "error", message: "That vehicle no longer exists." }
  }

  if (existing.status === status) {
    // Not an error — most likely a double submit. Saying so beats writing a
    // second audit row claiming a change that did not happen.
    return { status: "idle" }
  }

  /**
   * The transition itself is checked here, not only in the UI.
   *
   * `VehicleStatusControl` renders buttons from the same table, but that
   * runs in the browser and decides nothing. Without this check a crafted
   * POST — or a tab left open across someone else's change — could move a
   * SOLD vehicle back to PUBLISHED and put a car a customer has already paid
   * a deposit against back on the marketplace.
   */
  if (!canTransitionVehicleStatus(existing.status, status)) {
    logSecurityEvent("vehicle_status_transition_refused", {
      actorId: auth.admin.id,
      vehicleId: id,
      from: existing.status,
      to: status,
    })

    return {
      status: "error",
      message: describeRefusedTransition(existing.status, status),
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Conditional on the status the transition was checked from, so a
      // change landing since the read above is refused rather than skipped.
      const written = await tx.vehicle.updateMany({ where: { id, status: existing.status }, data: { status } })
      if (written.count === 0) throw new StaleVehicleError()

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "VEHICLE_STATUS_CHANGED",
          entityType: "Vehicle",
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
    if (error instanceof StaleVehicleError) {
      return {
        status: "error",
        message: "This vehicle's status changed while you were looking at it. Reload the page to see the actions available now.",
      }
    }

    console.error("[vehicle] failed to change vehicle status", error)
    return {
      status: "error",
      message: "Could not change the status. Please try again.",
    }
  }

  revalidateVehicleSurfaces(id, existing.slug)

  return {
    status: "success",
    message: `Status changed to ${status.toLowerCase()}.`,
  }
}
