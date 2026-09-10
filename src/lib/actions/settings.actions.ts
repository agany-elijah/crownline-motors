"use server"

import { revalidatePath, updateTag } from "next/cache"

import { recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { prisma } from "@/lib/prisma"
import { BUSINESS_SETTINGS_CACHE_TAG } from "@/lib/queries/settings.queries"
import { businessSettingsSchema } from "@/lib/validations/settings.schema"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

/**
 * Business settings mutations.
 *
 * This is the first write path in the application, and it is written the way
 * every later one should be. The order of the opening steps is not
 * cosmetic — it is the sequence Security-files/authentication.md requires of
 * every Server Action, because each step assumes the previous one:
 *
 *   1. Validate the input, before anything touches it.
 *   2. Authenticate and authorise, before anything is written.
 *   3. Write, and record who did it, in one transaction.
 *
 * A Server Action compiles to a public POST endpoint. Nothing here may
 * assume it was reached through the form.
 */

export interface SettingsFormState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Record<string, string[]>
}

export async function updateBusinessSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  // 1 — Validate. Note this runs before the authorisation check: parsing a
  // form body reveals nothing, and doing it first means a malformed request
  // from an unauthorised caller gets the same treatment as any other.
  const parsed = businessSettingsSchema.safeParse({
    whatsappNumber: formData.get("whatsappNumber"),
    defaultInitialPercentage: formData.get("defaultInitialPercentage"),
    defaultMombasaPercentage: formData.get("defaultMombasaPercentage"),
    defaultFinalPercentage: formData.get("defaultFinalPercentage"),
    sparePartDeliverySteps: formData.get("sparePartDeliverySteps"),
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 2 — Authorise. `settings:write`, not merely "is an administrator":
  // these percentages determine what every future order asks a customer to
  // pay, which is why the permission is separate from `settings:read`.
  const auth = await authorizePermission("settings:write")

  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const input = parsed.data

  // Read the current values first so the audit entry can record what
  // actually changed. An audit row saying only "settings were updated" tells
  // a future reader nothing they can act on.
  const previous = await prisma.businessSettings.findUnique({ where: { id: 1 } })

  try {
    // 3 — Write and audit together. Unlike the auth events, this is a
    // configuration change with no independent record anywhere else, so a
    // failed audit write must roll the change back rather than leave an
    // unrecorded edit to the payment structure.
    await prisma.$transaction(async (tx) => {
      const updated = await tx.businessSettings.upsert({
        where: { id: 1 },
        update: {
          whatsappNumber: input.whatsappNumber,
          defaultInitialPercentage: input.defaultInitialPercentage,
          defaultMombasaPercentage: input.defaultMombasaPercentage,
          defaultFinalPercentage: input.defaultFinalPercentage,
          /**
           * Written as the validated array, never as the raw submitted
           * string. Everything stored in this Json column therefore has the
           * shape the read path expects — which matters because Postgres
           * checks nothing inside a jsonb value, so this write is the only
           * place the shape can be guaranteed.
           *
           * An empty array is stored as an empty array, not as NULL: the two
           * mean different things (see the DTO), and collapsing them would
           * make it impossible for an operator to hide the section.
           *
           * `undefined` — a request that did not mention the steps at all —
           * reaches Prisma as "leave this column alone", which is precisely
           * the intended reading. It is why a crafted POST carrying only the
           * percentages cannot clear an operator's configured steps.
           */
          sparePartDeliverySteps: input.sparePartDeliverySteps,
        },
        create: {
          id: 1,
          whatsappNumber: input.whatsappNumber,
          defaultInitialPercentage: input.defaultInitialPercentage,
          defaultMombasaPercentage: input.defaultMombasaPercentage,
          defaultFinalPercentage: input.defaultFinalPercentage,
          sparePartDeliverySteps: input.sparePartDeliverySteps,
        },
      })

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "BUSINESS_SETTINGS_UPDATED",
          entityType: "BusinessSettings",
          entityId: String(updated.id),
          metadata: {
            previous: previous
              ? {
                  whatsappNumber: previous.whatsappNumber,
                  initial: previous.defaultInitialPercentage.toString(),
                  mombasa: previous.defaultMombasaPercentage.toString(),
                  final: previous.defaultFinalPercentage.toString(),
                }
              : null,
            next: {
              whatsappNumber: input.whatsappNumber,
              initial: String(input.defaultInitialPercentage),
              mombasa: String(input.defaultMombasaPercentage),
              final: String(input.defaultFinalPercentage),
            },
            /**
             * The steps are recorded as a *count*, not verbatim.
             *
             * An audit entry answers "who changed what, and when". Two copies
             * of six paragraphs of marketing copy in every settings audit row
             * would bury the financial change sitting beside it — which is
             * the change this log exists for. The copy itself is public on
             * every part page and recoverable from a database backup.
             */
            sparePartDeliveryStepCount:
              input.sparePartDeliverySteps?.length ?? "unchanged",
          },
        },
        tx
      )
    })
  } catch (error) {
    // Logged in full for the operator, summarised for the caller. Returning
    // the raw message would leak database structure to whoever posted the
    // request (SECURITY.MD §37).
    console.error("[settings] failed to update business settings", error)

    return {
      status: "error",
      message: "Could not save those settings. Please try again.",
    }
  }

  // The settings page reads through `cache()`, which is per-request, but the
  // route itself is cached by Next. Without this the operator would save
  // successfully and still see the old values.
  revalidatePath(`${ADMIN_BASE_PATH}/settings`)

  /**
   * The public site reads the WhatsApp number through `unstable_cache`, so
   * without this an operator would save a new number, see it on this page,
   * and go on watching customers message the old one until the next deploy.
   * Tag-based rather than path-based because the number appears in the
   * public layout — that is every page, not a list of them.
   *
   * `updateTag`, not `revalidateTag("...", "max")`. The latter serves the
   * stale value to the next visitor while it refetches, which for a phone
   * number means customers messaging the old one for one more request after
   * the change was saved. `updateTag` expires it outright, so the next
   * request pays a cache miss and gets the number the operator just entered.
   * That is the read-your-own-writes case it exists for, and the cost — one
   * uncached read after a settings save — is nothing.
   */
  updateTag(BUSINESS_SETTINGS_CACHE_TAG)

  return { status: "success", message: "Settings saved." }
}
