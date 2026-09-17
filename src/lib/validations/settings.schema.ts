import { z } from "zod"

import { AdminTheme, ShipmentType } from "@/generated/prisma/enums"
import { BRANDING_ASSET_KINDS } from "@/lib/constants/branding-options"
import { RESERVED_TRACKING_PREFIXES } from "@/lib/tracking/tracking-number"
import {
  MAX_SPARE_PART_DELIVERY_STEPS,
  SPARE_PART_DELIVERY_STEP_DESCRIPTION_MAX,
  SPARE_PART_DELIVERY_STEP_TITLE_MAX,
} from "@/lib/constants/spare-part-delivery"
import {
  TIME_OF_DAY_PATTERN,
  WEEKDAYS,
  type BusinessHours,
} from "@/lib/settings/business-hours"
import {
  CATALOG_ACTIONS,
  DEFAULT_CATALOG_DISPLAY,
  type CatalogDisplaySettings,
} from "@/lib/settings/catalog-display"
import { SPARE_PART_INFO_FIELDS, VEHICLE_INFO_FIELDS } from "@/lib/visibility/product-visibility"
import {
  TRACKING_STAGE_DESCRIPTION_MAX,
  TRACKING_STAGE_LABEL_MAX,
  canonicalTimeline,
  defaultTrackingStageConfig,
  trackingStagesProblem,
  type TrackingStageConfig,
} from "@/lib/settings/tracking-stages"
import { findDialCode } from "@/lib/utils/phone"

/**
 * Validation for every Settings section.
 *
 * One schema per section, because each section saves on its own: a save on
 * Notifications must not be able to touch the payment split, and a crafted
 * POST to one action cannot reach columns another action owns.
 *
 * Several Json columns are validated here on the way *out* as well as in —
 * Postgres checks nothing inside a jsonb value, so a row written by an older
 * build, a restored backup or a hand edit in Studio is untrusted input
 * exactly like a request body. The `resolve*` functions at the bottom are
 * that read path.
 */

// ─────────────────────────────────────────────────────────────────────
// Shared field builders
// ─────────────────────────────────────────────────────────────────────

/** A switch in a submitted form: present as "on" when checked, absent when not. */
const formSwitch = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean())

/** Optional free text: trimmed, and an empty value stored as null. */
function optionalText(max: number, message = "That is too long.") {
  return z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null))
}

/** A JSON string posted from a hidden field, parsed before validation. */
function jsonField<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value
    try {
      return JSON.parse(value)
    } catch {
      // Returned unchanged so the schema reports a shape error rather than
      // this preprocessor throwing a 500.
      return value
    }
  }, schema)
}

/** Hundredths of a percent. Working in integers avoids the float trap below. */
const TOTAL_HUNDREDTHS = 10_000

const percentageField = z.coerce
  .number({ error: "Enter a number." })
  .min(0, "Cannot be negative.")
  .max(100, "Cannot exceed 100%.")
  /**
   * Two decimal places, matching Decimal(5,2) in the database. Compared with a
   * tolerance rather than `value * 100 % 1 === 0`, because that test is itself
   * a floating-point trap: `33.34 * 100` evaluates to 3334.0000000000005.
   */
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, {
    message: "Use at most two decimal places.",
  })

/**
 * A phone number in full international format, or empty for "not published".
 *
 * Formatting characters are allowed through and stripped at use, so an
 * operator can type the number the way they read it. The digit range catches
 * typos and pasted rubbish, not every invalid number in the world.
 */
function phoneNumberField(message: string) {
  return z
    .string()
    .trim()
    .max(32, "That number is too long.")
    .refine(
      (value) => {
        if (value.length === 0) return true
        if (!/^[+\d][\d\s().-]*$/.test(value)) return false
        const digits = value.replace(/\D/g, "")
        return digits.length >= 7 && digits.length <= 15
      },
      { message }
    )
}

const whatsAppNumberField = phoneNumberField("Enter a full international number, for example +211900000000.")

// ─────────────────────────────────────────────────────────────────────
// 1. Business information
// ─────────────────────────────────────────────────────────────────────

export const businessHoursDaySchema = z
  .object({
    day: z.enum(WEEKDAYS),
    closed: z.boolean(),
    opensAt: z.string().regex(TIME_OF_DAY_PATTERN, "Use a time such as 08:00."),
    closesAt: z.string().regex(TIME_OF_DAY_PATTERN, "Use a time such as 18:00."),
  })
  .refine((day) => day.closed || day.closesAt > day.opensAt, {
    // "HH:MM" strings compare correctly as text. Overnight opening is not a
    // thing a dealership does, and allowing it would let a typo publish a
    // closing time before the opening one.
    message: "Closing time must be after opening time.",
    path: ["closesAt"],
  })

/** Seven days, Monday to Sunday, each exactly once and in order. */
export const businessHoursSchema = z
  .array(businessHoursDaySchema)
  .length(WEEKDAYS.length, "Give hours for every day of the week.")
  .refine((days) => days.every((day, index) => day.day === WEEKDAYS[index]), {
    message: "Days must run Monday to Sunday.",
  })

/**
 * The social networks and the hosts a link to each must point at.
 *
 * A link is checked against its own network's domain, so a typo — or a
 * pasted phishing URL — cannot be published behind the Facebook icon. Only
 * https: a footer link that downgrades a customer to http is not one the
 * dealership should be able to publish by accident.
 */
export const SOCIAL_NETWORKS = {
  socialFacebook: { label: "Facebook", hosts: ["facebook.com", "fb.com"] },
  socialInstagram: { label: "Instagram", hosts: ["instagram.com"] },
  socialTiktok: { label: "TikTok", hosts: ["tiktok.com"] },
  socialYoutube: { label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  socialLinkedin: { label: "LinkedIn", hosts: ["linkedin.com"] },
  socialX: { label: "X (Twitter)", hosts: ["x.com", "twitter.com"] },
} as const

export type SocialNetworkField = keyof typeof SOCIAL_NETWORKS

export function isAllowedSocialUrl(field: SocialNetworkField, value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  if (url.protocol !== "https:" || url.username || url.password) return false

  const host = url.hostname.toLowerCase()
  return SOCIAL_NETWORKS[field].hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

function socialField(field: SocialNetworkField) {
  return z
    .string()
    .trim()
    .max(300, "That link is too long.")
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null))
    .refine((value) => value === null || isAllowedSocialUrl(field, value), {
      message: `Enter the full https:// link to your ${SOCIAL_NETWORKS[field].label} page.`,
    })
}

export const businessInformationSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Enter the business name.")
    .max(80, "Keep the business name under 80 characters."),
  businessDescription: z
    .string()
    .trim()
    .min(10, "Describe the business in a sentence.")
    .max(300, "Keep the description to one or two sentences."),
  defaultCountry: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => findDialCode(value) !== null, { message: "Choose a country from the list." }),
  primaryPhone: phoneNumberField("Enter the phone number in full international format, for example +211900000000."),
  whatsappNumber: whatsAppNumberField,
  businessEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "That email address is too long.")
    .refine((value) => value.length === 0 || z.email().safeParse(value).success, {
      message: "Enter a valid email address.",
    }),
  businessAddress: z.string().trim().max(200, "Keep the address under 200 characters."),
  /** Absent or unpublished → null, which hides the hours everywhere. */
  publishHours: formSwitch,
  businessHours: jsonField(businessHoursSchema),
  socialFacebook: socialField("socialFacebook"),
  socialInstagram: socialField("socialInstagram"),
  socialTiktok: socialField("socialTiktok"),
  socialYoutube: socialField("socialYoutube"),
  socialLinkedin: socialField("socialLinkedin"),
  socialX: socialField("socialX"),
})

export type BusinessInformationInput = z.infer<typeof businessInformationSchema>

// ─────────────────────────────────────────────────────────────────────
// 2. Website & branding
// ─────────────────────────────────────────────────────────────────────

export const brandingSettingsSchema = z.object({
  siteTitle: optionalText(60, "Keep the site title under 60 characters — browsers cut longer tab titles."),
  defaultDashboardTheme: z.enum(AdminTheme, { error: "Choose light or dark." }),
})

export type BrandingSettingsInput = z.infer<typeof brandingSettingsSchema>

/** Which branding image an upload or removal is for. */
export const brandingAssetKindSchema = z.enum(BRANDING_ASSET_KINDS)

// ─────────────────────────────────────────────────────────────────────
// 3. Commerce & payments
// ─────────────────────────────────────────────────────────────────────

/**
 * The vehicle payment schedule and the quotation defaults.
 *
 * The percentage rule here is not a nicety. Prisma's DSL cannot express a
 * cross-column check, so this schema is the only thing standing between a
 * typo and a payment structure that never adds up to the price the customer
 * agreed.
 */
export const commerceSettingsSchema = z
  .object({
    defaultInitialPercentage: percentageField,
    defaultMombasaPercentage: percentageField,
    defaultFinalPercentage: percentageField,
  })
  .refine(
    (values) => {
      /**
       * Compared as integer hundredths rather than by adding the floats.
       * `33.33 + 33.33 + 33.34` is not exactly `100` in IEEE-754, so a direct
       * `=== 100` would reject a perfectly valid split — and an admin who
       * cannot save a correct value will eventually enter an incorrect one.
       */
      const total =
        Math.round(values.defaultInitialPercentage * 100) +
        Math.round(values.defaultMombasaPercentage * 100) +
        Math.round(values.defaultFinalPercentage * 100)

      return total === TOTAL_HUNDREDTHS
    },
    {
      message:
        "The three payment stages must add up to exactly 100%. A customer must have paid the full agreed price before the vehicle is released.",
      path: ["defaultInitialPercentage"],
    }
  )

export type CommerceSettingsInput = z.infer<typeof commerceSettingsSchema>

// ─────────────────────────────────────────────────────────────────────
// 4. Orders & tracking
// ─────────────────────────────────────────────────────────────────────

export const trackingNumberPrefixSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,6}$/, "Use 2 to 6 letters, A to Z.")
  .refine((value) => !(RESERVED_TRACKING_PREFIXES as readonly string[]).includes(value), {
    message: "That prefix is used by order, quote or listing references. Choose another.",
  })

/**
 * One configured stage. The status must belong to the shipment type's own
 * timeline; which orders are acceptable is decided by
 * `trackingStagesProblem`, attached per type below.
 */
const trackingStageSettingSchema = z.object({
  status: z.string(),
  label: z
    .string()
    .trim()
    .min(1, "Give every stage a name.")
    .max(TRACKING_STAGE_LABEL_MAX, `Keep stage names under ${TRACKING_STAGE_LABEL_MAX} characters.`),
  description: z
    .string()
    .trim()
    .max(TRACKING_STAGE_DESCRIPTION_MAX, `Keep descriptions under ${TRACKING_STAGE_DESCRIPTION_MAX} characters.`),
  enabled: z.boolean(),
})

function trackingStageListSchema(type: ShipmentType) {
  return z.array(trackingStageSettingSchema).superRefine((stages, context) => {
    const timeline = canonicalTimeline(type) as readonly string[]

    if (stages.some((stage) => !timeline.includes(stage.status))) {
      context.addIssue({ code: "custom", message: "A stage does not belong to this timeline." })
      return
    }

    const problem = trackingStagesProblem(type, stages as Parameters<typeof trackingStagesProblem>[1])
    if (problem) context.addIssue({ code: "custom", message: problem })
  })
}

export const trackingStageConfigSchema = z.object({
  VEHICLE: trackingStageListSchema(ShipmentType.VEHICLE),
  SPARE_PART: trackingStageListSchema(ShipmentType.SPARE_PART),
})

/**
 * One "how this reaches you" step. Both fields are required: a step with a
 * title and no sentence is a word floating under a numeral.
 */
export const sparePartDeliveryStepSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give this step a short title.")
    .max(SPARE_PART_DELIVERY_STEP_TITLE_MAX, "That title is too long for the layout."),
  description: z
    .string()
    .trim()
    .min(10, "Say in a sentence what happens at this step.")
    .max(SPARE_PART_DELIVERY_STEP_DESCRIPTION_MAX, "Keep this to a sentence — the detail belongs on WhatsApp."),
})

/**
 * The ordered list of steps. Used on the way out as well as in (see the file
 * note). An empty array is valid and meaningful: it hides the section, which
 * is different from never having configured it (null → built-in steps).
 */
export const sparePartDeliveryStepsSchema = z
  .array(sparePartDeliveryStepSchema)
  .max(
    MAX_SPARE_PART_DELIVERY_STEPS,
    `Use at most ${MAX_SPARE_PART_DELIVERY_STEPS} steps — a list longer than that stops being read.`
  )

export type SparePartDeliveryStepsInput = z.infer<typeof sparePartDeliveryStepsSchema>

/**
 * The two structured fields, each with three distinct inputs:
 *
 *   absent (`null` from `FormData.get`) → `undefined`, "leave the stored value
 *     alone". A crafted POST that changes only the prefix cannot wipe the
 *     configured stages or copy as a side effect.
 *   `""` → `[]` for the delivery steps: the operator cleared the list, which
 *     hides the section.
 *   a JSON value → that value, once every row has been validated.
 */
export const ordersTrackingSettingsSchema = z.object({
  trackingNumberPrefix: trackingNumberPrefixSchema,
  trackingStages: z.preprocess((value) => {
    if (value === null || value === undefined) return undefined
    if (typeof value !== "string") return value
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }, trackingStageConfigSchema.optional()),
  sparePartDeliverySteps: z.preprocess((value) => {
    if (value === null || value === undefined) return undefined
    if (typeof value !== "string") return value
    if (value.trim() === "") return []
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }, sparePartDeliveryStepsSchema.optional()),
})

export type OrdersTrackingSettingsInput = z.infer<typeof ordersTrackingSettingsSchema>

// ─────────────────────────────────────────────────────────────────────
// 5. Catalogue display
// ─────────────────────────────────────────────────────────────────────

function switchGroup<const T extends readonly string[]>(keys: T) {
  return z.object(Object.fromEntries(keys.map((key) => [key, formSwitch])) as { [K in T[number]]: typeof formSwitch })
}

export const catalogDisplaySettingsSchema = z.object({
  vehicle: switchGroup(VEHICLE_INFO_FIELDS),
  sparePart: switchGroup(SPARE_PART_INFO_FIELDS),
  actions: switchGroup(CATALOG_ACTIONS),
})

/**
 * The stored shape: every key optional, so defaults fill what is missing.
 * `vehicleCard` / `sparePartCard` are the pre-site-wide names, read only when
 * the current group is absent.
 */
const storedCatalogDisplaySchema = z.object({
  vehicle: z.record(z.string(), z.boolean()).optional(),
  sparePart: z.record(z.string(), z.boolean()).optional(),
  vehicleCard: z.record(z.string(), z.boolean()).optional(),
  sparePartCard: z.record(z.string(), z.boolean()).optional(),
  actions: z.record(z.string(), z.boolean()).optional(),
})

// ─────────────────────────────────────────────────────────────────────
// 6. Notifications
// ─────────────────────────────────────────────────────────────────────

export const notificationSettingsSchema = z.object({
  notifyAdminsOfNewQuotes: formSwitch,
  customerEmailsEnabled: formSwitch,
  adminEmailNotificationsEnabled: formSwitch,
  dashboardNotificationsEnabled: formSwitch,
})

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>

// ─────────────────────────────────────────────────────────────────────
// 7. SEO & social
// ─────────────────────────────────────────────────────────────────────

export const seoSettingsSchema = z.object({
  seoDefaultTitle: optionalText(70, "Keep the title under 70 characters — search results cut longer ones."),
  seoDefaultDescription: optionalText(200, "Keep the description under 200 characters — search results cut longer ones."),
  sitemapEnabled: formSwitch,
  searchIndexingEnabled: formSwitch,
})

export type SeoSettingsInput = z.infer<typeof seoSettingsSchema>

// ─────────────────────────────────────────────────────────────────────
// Read-side resolvers for the Json columns
// ─────────────────────────────────────────────────────────────────────

/**
 * Stored business hours, or null when never configured or malformed.
 * Malformed is logged: silently discarding an operator's configuration is not
 * something to do quietly.
 */
export function resolveBusinessHours(value: unknown): BusinessHours | null {
  if (value === null || value === undefined) return null

  const parsed = businessHoursSchema.safeParse(value)
  if (!parsed.success) {
    console.error("[settings] stored business hours are malformed; treating them as unpublished")
    return null
  }

  return parsed.data
}

/** Stored catalogue display merged over the defaults, key by key. */
export function resolveCatalogDisplay(value: unknown): CatalogDisplaySettings {
  const parsed = storedCatalogDisplaySchema.safeParse(value ?? {})

  if (!parsed.success) {
    console.error("[settings] stored catalogue display settings are malformed; using the defaults")
    return structuredClone(DEFAULT_CATALOG_DISPLAY)
  }

  const pick = <K extends string>(keys: readonly K[], stored: Record<string, boolean> | undefined, defaults: Record<K, boolean>) =>
    Object.fromEntries(keys.map((key) => [key, typeof stored?.[key] === "boolean" ? stored[key] : defaults[key]])) as Record<K, boolean>

  return {
    vehicle: pick(VEHICLE_INFO_FIELDS, parsed.data.vehicle ?? parsed.data.vehicleCard, DEFAULT_CATALOG_DISPLAY.vehicle),
    sparePart: pick(
      SPARE_PART_INFO_FIELDS,
      parsed.data.sparePart ?? parsed.data.sparePartCard,
      DEFAULT_CATALOG_DISPLAY.sparePart
    ),
    actions: pick(CATALOG_ACTIONS, parsed.data.actions, DEFAULT_CATALOG_DISPLAY.actions),
  }
}

/**
 * Stored tracking stages, per shipment type, or the built-in timeline.
 *
 * Each type falls back on its own: a malformed parts list must not also throw
 * away a good vehicle one. A stored list that has become invalid — because a
 * later release added a status, say — falls back rather than rendering a
 * timeline that is missing a step.
 */
export function resolveTrackingStageConfig(value: unknown): TrackingStageConfig {
  const defaults = defaultTrackingStageConfig()
  if (value === null || value === undefined || typeof value !== "object") return defaults

  const stored = value as Record<string, unknown>
  const resolved = { ...defaults }

  for (const type of [ShipmentType.VEHICLE, ShipmentType.SPARE_PART]) {
    if (stored[type] === undefined) continue

    const parsed = trackingStageListSchema(type).safeParse(stored[type])
    if (parsed.success) {
      resolved[type] = parsed.data as TrackingStageConfig[typeof type]
    } else {
      console.error(`[settings] stored ${type} tracking stages are invalid; using the built-in timeline`)
    }
  }

  return resolved
}
