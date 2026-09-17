"use server"

import { Prisma } from "@/generated/prisma/client"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { CATALOG_ACTIONS } from "@/lib/settings/catalog-display"
import { SPARE_PART_INFO_FIELDS, VEHICLE_INFO_FIELDS } from "@/lib/visibility/product-visibility"
import { writeSettingsSection as writeSection, type SettingsFormState } from "@/lib/settings/write-settings-section"
import {
  businessInformationSchema,
  brandingSettingsSchema,
  catalogDisplaySettingsSchema,
  commerceSettingsSchema,
  notificationSettingsSchema,
  ordersTrackingSettingsSchema,
  seoSettingsSchema,
} from "@/lib/validations/settings.schema"

/**
 * Settings mutations — one action per section.
 *
 * Each follows the order every write path in this codebase follows, and the
 * order is not cosmetic (Security-files/authentication.md):
 *
 *   1. Validate the input, before anything touches it.
 *   2. Authorise, before anything is written.
 *   3. Write, and record what changed and who changed it, in one transaction
 *      (see write-settings-section.ts, which is deliberately not in this
 *      file: every export here is a public endpoint).
 *
 * A Server Action is a public POST endpoint; nothing here assumes it was
 * reached through the form. Each action writes only its own section's
 * columns, so a crafted request to Notifications cannot reach the payment
 * split.
 */

export type { SettingsFormState }

const INVALID: SettingsFormState = {
  status: "error",
  message: "Check the highlighted fields and try again.",
}

function invalid(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }): SettingsFormState {
  return { ...INVALID, fieldErrors: error.flatten().fieldErrors as Record<string, string[]> }
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

// ─────────────────────────────────────────────────────────────────────
// 1. Business information
// ─────────────────────────────────────────────────────────────────────

export async function updateBusinessInformationAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const parsed = businessInformationSchema.safeParse({
    businessName: text(formData, "businessName"),
    businessDescription: text(formData, "businessDescription"),
    defaultCountry: text(formData, "defaultCountry"),
    primaryPhone: text(formData, "primaryPhone"),
    whatsappNumber: text(formData, "whatsappNumber"),
    businessEmail: text(formData, "businessEmail"),
    businessAddress: text(formData, "businessAddress"),
    publishHours: formData.get("publishHours"),
    businessHours: text(formData, "businessHours"),
    socialFacebook: text(formData, "socialFacebook"),
    socialInstagram: text(formData, "socialInstagram"),
    socialTiktok: text(formData, "socialTiktok"),
    socialYoutube: text(formData, "socialYoutube"),
    socialLinkedin: text(formData, "socialLinkedin"),
    socialX: text(formData, "socialX"),
  })

  if (!parsed.success) return invalid(parsed.error)

  const auth = await authorizePermission("settings:write")
  if (!auth.ok) return { status: "error", message: auth.message }

  const { publishHours, businessHours, ...scalars } = parsed.data
  const hours = publishHours ? businessHours : null

  return writeSection({
    actorId: auth.admin.id,
    action: "SETTINGS_BUSINESS_INFORMATION_UPDATED",
    data: { ...scalars, businessHours: hours ?? Prisma.DbNull },
    compare: { ...scalars, businessHours: hours },
  })
}

// ─────────────────────────────────────────────────────────────────────
// 2. Website & branding (the images are in branding.actions.ts)
// ─────────────────────────────────────────────────────────────────────

export async function updateBrandingSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const parsed = brandingSettingsSchema.safeParse({
    siteTitle: text(formData, "siteTitle"),
    defaultDashboardTheme: text(formData, "defaultDashboardTheme"),
  })

  if (!parsed.success) return invalid(parsed.error)

  const auth = await authorizePermission("settings:write")
  if (!auth.ok) return { status: "error", message: auth.message }

  return writeSection({
    actorId: auth.admin.id,
    action: "SETTINGS_BRANDING_UPDATED",
    data: parsed.data,
    compare: parsed.data,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 3. Commerce & payments
// ─────────────────────────────────────────────────────────────────────

/**
 * The default vehicle payment schedule.
 *
 * Only *new* orders use these: every existing order has its percentages and
 * amounts locked into its own PaymentMilestone rows, so a change here can
 * never alter what a customer already agreed to (schema documentation §8).
 */
export async function updateCommerceSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const parsed = commerceSettingsSchema.safeParse({
    defaultInitialPercentage: formData.get("defaultInitialPercentage"),
    defaultMombasaPercentage: formData.get("defaultMombasaPercentage"),
    defaultFinalPercentage: formData.get("defaultFinalPercentage"),
  })

  if (!parsed.success) return invalid(parsed.error)

  const auth = await authorizePermission("settings:write")
  if (!auth.ok) return { status: "error", message: auth.message }

  return writeSection({
    actorId: auth.admin.id,
    action: "SETTINGS_PAYMENT_SCHEDULE_UPDATED",
    data: parsed.data,
    compare: parsed.data,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 4. Orders & tracking
// ─────────────────────────────────────────────────────────────────────

export async function updateOrdersTrackingSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const parsed = ordersTrackingSettingsSchema.safeParse({
    trackingNumberPrefix: text(formData, "trackingNumberPrefix"),
    // Raw, so an absent field stays null and means "leave it alone".
    trackingStages: formData.get("trackingStages"),
    sparePartDeliverySteps: formData.get("sparePartDeliverySteps"),
  })

  if (!parsed.success) return invalid(parsed.error)

  const auth = await authorizePermission("settings:write")
  if (!auth.ok) return { status: "error", message: auth.message }

  const { trackingNumberPrefix, trackingStages, sparePartDeliverySteps } = parsed.data

  return writeSection({
    actorId: auth.admin.id,
    action: "SETTINGS_ORDERS_TRACKING_UPDATED",
    data: {
      trackingNumberPrefix,
      // `undefined` reaches Prisma as "leave this column alone".
      trackingStages: trackingStages as unknown as Prisma.InputJsonValue | undefined,
      sparePartDeliverySteps: sparePartDeliverySteps as unknown as Prisma.InputJsonValue | undefined,
    },
    compare: { trackingNumberPrefix, trackingStages, sparePartDeliverySteps },
  })
}

// ─────────────────────────────────────────────────────────────────────
// 5. Catalogue display
// ─────────────────────────────────────────────────────────────────────

export async function updateCatalogDisplayAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const group = (prefix: string, keys: readonly string[]) =>
    Object.fromEntries(keys.map((key) => [key, formData.get(`${prefix}.${key}`)]))

  const parsed = catalogDisplaySettingsSchema.safeParse({
    vehicle: group("vehicle", VEHICLE_INFO_FIELDS),
    sparePart: group("sparePart", SPARE_PART_INFO_FIELDS),
    actions: group("actions", CATALOG_ACTIONS),
  })

  if (!parsed.success) return invalid(parsed.error)

  const auth = await authorizePermission("settings:write")
  if (!auth.ok) return { status: "error", message: auth.message }

  return writeSection({
    actorId: auth.admin.id,
    action: "SETTINGS_CATALOG_DISPLAY_UPDATED",
    data: { catalogDisplay: parsed.data as unknown as Prisma.InputJsonValue },
    compare: { catalogDisplay: parsed.data },
  })
}

// ─────────────────────────────────────────────────────────────────────
// 6. Notifications
// ─────────────────────────────────────────────────────────────────────

export async function updateNotificationSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const parsed = notificationSettingsSchema.safeParse({
    notifyAdminsOfNewQuotes: formData.get("notifyAdminsOfNewQuotes"),
    customerEmailsEnabled: formData.get("customerEmailsEnabled"),
    adminEmailNotificationsEnabled: formData.get("adminEmailNotificationsEnabled"),
    dashboardNotificationsEnabled: formData.get("dashboardNotificationsEnabled"),
  })

  if (!parsed.success) return invalid(parsed.error)

  const auth = await authorizePermission("settings:write")
  if (!auth.ok) return { status: "error", message: auth.message }

  return writeSection({
    actorId: auth.admin.id,
    action: "SETTINGS_NOTIFICATIONS_UPDATED",
    data: parsed.data,
    compare: parsed.data,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 7. SEO & social
// ─────────────────────────────────────────────────────────────────────

export async function updateSeoSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const parsed = seoSettingsSchema.safeParse({
    seoDefaultTitle: text(formData, "seoDefaultTitle"),
    seoDefaultDescription: text(formData, "seoDefaultDescription"),
    sitemapEnabled: formData.get("sitemapEnabled"),
    searchIndexingEnabled: formData.get("searchIndexingEnabled"),
  })

  if (!parsed.success) return invalid(parsed.error)

  const auth = await authorizePermission("settings:write")
  if (!auth.ok) return { status: "error", message: auth.message }

  return writeSection({
    actorId: auth.admin.id,
    action: "SETTINGS_SEO_UPDATED",
    data: parsed.data,
    compare: parsed.data,
  })
}
