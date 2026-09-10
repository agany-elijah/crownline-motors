"use server"

import { revalidatePath } from "next/cache"

import { recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { prisma } from "@/lib/prisma"
import { describeFitment } from "@/lib/utils/spare-part-compatibility"
import {
  createSparePartCompatibilitySchema,
  deleteSparePartCompatibilitySchema,
} from "@/lib/validations/spare-part-compatibility.schema"

/**
 * Fitment rules — what a part fits — as managed from the dashboard.
 *
 * ── Why these are their own actions and not part of the details form ──
 * A part has one name and one price, and many fitment rules. Folding a
 * variable-length list into the details form would mean an operator could not
 * add a rule without re-submitting every other field, and a failed save on
 * the price would take the fitment with it. Rules are added and removed one
 * at a time, against a part that already exists.
 *
 * ── Why deletion is a real DELETE here, uniquely in this codebase ─────
 * Almost nothing in this system is hard-deleted. A fitment rule is the
 * exception, and deliberately: nothing references it, it carries no money and
 * no customer, and it is a *claim* rather than a record of something that
 * happened. A wrong claim should stop being made, not be annotated — an
 * archived "fits the 2015 Prado" that no longer displays is indistinguishable
 * from a deleted one, and would only be a row for someone to trip over later.
 * The cascade from `SparePart` says the same thing.
 *
 * Each action follows the order every Server Action here follows: validate,
 * authorise, write with an audit record in one transaction. These compile to
 * public POST endpoints; nothing may assume it was reached through the form.
 */

export interface FitmentFormState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Record<string, string[]>
}

/**
 * The surfaces a fitment change is visible on.
 *
 * The public catalogue is included because fitment is printed on the card —
 * an operator who corrects "Prado" to "Land Cruiser Prado" and then finds the
 * old claim still on the website has a tool that lies to them.
 */
function revalidateFitmentSurfaces(sparePartId: string, slug: string): void {
  revalidatePath(`${ADMIN_BASE_PATH}/spare-parts/${sparePartId}`)
  revalidatePath("/spare-parts")
  revalidatePath(`/spare-parts/${slug}`)
}

export async function addSparePartCompatibilityAction(
  _prevState: FitmentFormState,
  formData: FormData
): Promise<FitmentFormState> {
  const parsed = createSparePartCompatibilitySchema.safeParse({
    sparePartId: formData.get("sparePartId"),
    make: formData.get("make"),
    model: formData.get("model"),
    yearFrom: formData.get("yearFrom"),
    yearTo: formData.get("yearTo"),
    engine: formData.get("engine"),
    notes: formData.get("notes"),
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  /**
   * Editing fitment is editing the listing, so it takes the same permission
   * the details form does. It is deliberately *not* `sparePart:publish`: a
   * rule added to a draft changes nothing a customer can see, and one added
   * to a live part changes a claim on a page that is already published —
   * which is exactly the write `sparePart:write` describes.
   */
  const auth = await authorizePermission("sparePart:write")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const { sparePartId, ...rule } = parsed.data

  const part = await prisma.sparePart.findUnique({
    where: { id: sparePartId },
    select: { slug: true, referenceNumber: true },
  })

  if (!part) {
    return { status: "error", message: "That part no longer exists." }
  }

  /**
   * Duplicates are refused here rather than by a unique index.
   *
   * The natural key has four nullable columns and Postgres treats NULLs as
   * distinct in a unique index, so a constraint would let through exactly the
   * duplicates it was added to stop (the reasoning is written out on the
   * model). `NULLS NOT DISTINCT` would fix that and is not expressible in the
   * Prisma schema, and an index existing only in raw SQL is one Prisma
   * proposes to drop.
   *
   * So this is a check, not a guarantee — and it does not need to be one. A
   * duplicated fitment row cannot mis-sell anything; it can only be listed
   * twice. Catching the common case (an operator adding the same rule after a
   * page reload) is worth a query; racing two identical submissions is not
   * worth a constraint that would also block legitimate rows.
   *
   * `null` is passed explicitly, not `undefined`: in a Prisma `where`,
   * `undefined` means "do not filter on this column at all", so an
   * `undefined` model would match *every* model and refuse a legitimate rule
   * as a duplicate of an unrelated one.
   */
  const duplicate = await prisma.sparePartCompatibility.findFirst({
    where: {
      sparePartId,
      make: rule.make ?? null,
      model: rule.model ?? null,
      yearFrom: rule.yearFrom ?? null,
      yearTo: rule.yearTo ?? null,
      engine: rule.engine ?? null,
    },
    select: { id: true },
  })

  if (duplicate) {
    return {
      status: "error",
      message: "That fitment is already listed for this part.",
    }
  }

  const stored = {
    make: rule.make ?? null,
    model: rule.model ?? null,
    yearFrom: rule.yearFrom ?? null,
    yearTo: rule.yearTo ?? null,
    engine: rule.engine ?? null,
    notes: rule.notes ?? null,
  }

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.sparePartCompatibility.create({
        data: { sparePartId, ...stored },
        select: { id: true },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "SPARE_PART_FITMENT_ADDED",
          entityType: "SparePartCompatibility",
          entityId: created.id,
          metadata: {
            sparePartId,
            referenceNumber: part.referenceNumber,
            // Recorded as the customer reads it, so the log answers "what did
            // we claim this fits" without a reader reassembling six columns.
            fitment: describeFitment(stored),
          },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[spare-part] failed to add a fitment rule", error)
    return {
      status: "error",
      message: "Could not add that fitment. Please try again.",
    }
  }

  revalidateFitmentSurfaces(sparePartId, part.slug)

  return { status: "success", message: `Added ${describeFitment(stored)}.` }
}

export async function removeSparePartCompatibilityAction(
  _prevState: FitmentFormState,
  formData: FormData
): Promise<FitmentFormState> {
  const parsed = deleteSparePartCompatibilitySchema.safeParse({
    id: formData.get("id"),
  })

  if (!parsed.success) {
    return { status: "error", message: "That fitment rule is not valid." }
  }

  const auth = await authorizePermission("sparePart:write")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  /**
   * Read before the delete, for two reasons that both matter: the audit entry
   * has to say *what* was removed (the row is about to stop existing), and
   * the revalidation needs the part's public slug.
   */
  const existing = await prisma.sparePartCompatibility.findUnique({
    where: { id: parsed.data.id },
    select: {
      sparePartId: true,
      make: true,
      model: true,
      yearFrom: true,
      yearTo: true,
      engine: true,
      sparePart: { select: { slug: true, referenceNumber: true } },
    },
  })

  if (!existing) {
    // Most likely a double submit, or a stale page. Not an error worth
    // alarming an operator with: the row is gone, which is what they wanted.
    return { status: "idle" }
  }

  const description = describeFitment(existing)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.sparePartCompatibility.delete({ where: { id: parsed.data.id } })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "SPARE_PART_FITMENT_REMOVED",
          entityType: "SparePartCompatibility",
          entityId: parsed.data.id,
          metadata: {
            sparePartId: existing.sparePartId,
            referenceNumber: existing.sparePart.referenceNumber,
            fitment: description,
          },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[spare-part] failed to remove a fitment rule", error)
    return {
      status: "error",
      message: "Could not remove that fitment. Please try again.",
    }
  }

  revalidateFitmentSurfaces(existing.sparePartId, existing.sparePart.slug)

  return { status: "success", message: `Removed ${description}.` }
}
