import "server-only"

import { revalidatePath, updateTag } from "next/cache"

import { Prisma } from "@/generated/prisma/client"
import { recordAuditLog, type AuditAction } from "@/lib/audit"
import { SETTINGS_BASE_PATH } from "@/lib/constants/settings-nav"
import { prisma } from "@/lib/prisma"
import { BUSINESS_SETTINGS_CACHE_TAG } from "@/lib/queries/settings.queries"
import { diffSettings } from "@/lib/settings/audit-diff"

/**
 * Writes one Settings section and its audit entry, for every settings action.
 *
 * ── Why this is not in a "use server" file ────────────────────────────
 * Every export of a "use server" module is a public POST endpoint. This takes
 * an actor id and arbitrary column data; exported from an actions file it
 * would let anyone write any setting as anyone. It lives here, and only
 * actions that have already validated and authorised call it.
 *
 * The previous values are read inside the transaction, so the recorded "from"
 * is what was actually replaced even if two operators save at once. A save
 * that changes nothing writes nothing and records nothing. The audit write is
 * inside the transaction: these changes have no independent record, so a
 * failed audit rolls the change back.
 */

export interface SettingsFormState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Record<string, string[]>
}

/** Operator-facing names for the audit log's "what changed" column. */
const FIELD_LABELS: Record<string, string> = {
  businessName: "Business name",
  businessDescription: "Business description",
  defaultCountry: "Default country",
  primaryPhone: "Primary phone",
  whatsappNumber: "WhatsApp number",
  businessEmail: "Business email",
  businessAddress: "Address",
  businessHours: "Business hours",
  socialFacebook: "Facebook",
  socialInstagram: "Instagram",
  socialTiktok: "TikTok",
  socialYoutube: "YouTube",
  socialLinkedin: "LinkedIn",
  socialX: "X (Twitter)",
  siteTitle: "Site title",
  defaultDashboardTheme: "Default dashboard theme",
  defaultInitialPercentage: "Initial payment %",
  defaultMombasaPercentage: "Mombasa payment %",
  defaultFinalPercentage: "Final payment %",
  trackingNumberPrefix: "Tracking number prefix",
  trackingStages: "Tracking stages",
  sparePartDeliverySteps: "Spare-part delivery steps",
  catalogDisplay: "Catalogue display",
  notifyAdminsOfNewQuotes: "New quote received",
  customerEmailsEnabled: "Automatic customer emails",
  adminEmailNotificationsEnabled: "Admin email notifications",
  dashboardNotificationsEnabled: "Dashboard notifications",
  seoDefaultTitle: "Default SEO title",
  seoDefaultDescription: "Default SEO description",
  sitemapEnabled: "Sitemap",
  searchIndexingEnabled: "Search engine indexing",
  requireTwoFactor: "Require 2FA",
  allowPasswordRecovery: "Allow password recovery",
  sessionTimeoutHours: "Session timeout (hours)",
}

type PlainRow = Record<string, unknown>

/** The stored row as plain values, so Decimals compare as numbers in the diff. */
function toPlain(row: object): PlainRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Prisma.Decimal.isDecimal(value) ? value.toString() : value])
  )
}

export interface SectionWrite {
  actorId: string
  action: AuditAction
  /** What is written. Json columns use `Prisma.DbNull` for "not configured". */
  data: Prisma.BusinessSettingsUpdateInput
  /** The same values as plain data, for the diff. `null` for a cleared Json column. */
  compare: PlainRow
}

export async function writeSettingsSection({ actorId, action, data, compare }: SectionWrite): Promise<SettingsFormState> {
  try {
    const changed = await prisma.$transaction(async (tx) => {
      const previous = await tx.businessSettings.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, whatsappNumber: "" },
      })

      const changes = diffSettings(toPlain(previous), compare, FIELD_LABELS)
      if (changes.length === 0) return 0

      await tx.businessSettings.update({ where: { id: 1 }, data })

      await recordAuditLog(
        {
          actorId,
          action,
          entityType: "BusinessSettings",
          entityId: "1",
          metadata: { changes: changes as unknown as Prisma.InputJsonValue },
        },
        tx
      )

      return changes.length
    })

    if (changed === 0) {
      return { status: "success", message: "No changes to save." }
    }
  } catch (error) {
    // Logged in full for the operator, summarised for the caller: the raw
    // message would leak database structure (SECURITY.MD §37).
    console.error(`[settings] failed to save (${action})`, error)
    return { status: "error", message: "Could not save these settings. Please try again." }
  }

  // Every settings page, and every surface reading the tagged cache — public
  // pages and the DAL's security settings alike. `updateTag`: the next request
  // must get the new value, not one more serving of the old.
  revalidatePath(SETTINGS_BASE_PATH, "layout")
  updateTag(BUSINESS_SETTINGS_CACHE_TAG)

  return { status: "success", message: "Settings saved." }
}
