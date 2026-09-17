import "server-only"

import { cache } from "react"
import { unstable_cache } from "next/cache"

import { siteConfig } from "@/config/site"
import type { BusinessSettings } from "@/generated/prisma/client"
import { AdminTheme } from "@/generated/prisma/enums"
import {
  BRANDING_ASSET_KINDS,
  BRANDING_ASSET_RULES,
  type BrandingAssetKind,
} from "@/lib/constants/branding-options"
import {
  DEFAULT_SPARE_PART_DELIVERY_STEPS,
  type SparePartDeliveryStep,
} from "@/lib/constants/spare-part-delivery"
import { prisma } from "@/lib/prisma"
import { summariseBusinessHours, type BusinessHours } from "@/lib/settings/business-hours"
import type { CatalogDisplaySettings } from "@/lib/settings/catalog-display"
import type { TrackingStageConfig } from "@/lib/settings/tracking-stages"
import { brandingAssetPublicUrl } from "@/lib/storage/branding-media"
import {
  SOCIAL_NETWORKS,
  resolveBusinessHours,
  resolveCatalogDisplay,
  resolveTrackingStageConfig,
  sparePartDeliveryStepsSchema,
  type SocialNetworkField,
} from "@/lib/validations/settings.schema"

/**
 * Reads for the BusinessSettings singleton — the single source of truth for
 * everything the dealership configures.
 *
 * Three readers, for three audiences:
 *
 *   getBusinessSettings()    the Settings screens. Upserts the row, so a
 *                            database restored without it still opens. Never
 *                            called from a public page (a write per visit).
 *   getPublicSiteSettings()  every public surface: identity, contact, hours,
 *                            branding, SEO, catalogue display, tracking
 *                            stages. Cached under a tag.
 *   getOperationalSettings() server-side switches that are not public —
 *                            notifications and security controls. Cached
 *                            under the same tag.
 *
 * ── Why cached, and why with a tag ────────────────────────────────────
 * The public layout reads identity and contact on every page. An uncached
 * query there would opt the whole site into dynamic rendering and put a
 * database round trip in front of a customer on a slow connection, for
 * values that change a few times a year. Every settings action calls
 * `updateTag(BUSINESS_SETTINGS_CACHE_TAG)`, so a save is live on the next
 * request rather than at the next deploy.
 *
 * `unstable_cache` rather than `use cache`: the latter needs the
 * `cacheComponents` flag, an application-wide rendering change.
 */

export const BUSINESS_SETTINGS_CACHE_TAG = "business-settings"

/**
 * The spare-part steps stored in the Json column, or null when never
 * configured (or malformed, which is logged). Null and `[]` mean different
 * things: null shows the built-in steps, `[]` hides the section.
 */
function parseStoredDeliverySteps(value: unknown): SparePartDeliveryStep[] | null {
  if (value === null || value === undefined) return null

  const parsed = sparePartDeliveryStepsSchema.safeParse(value)
  if (!parsed.success) {
    console.error("[settings] stored spare-part delivery steps are malformed; falling back to the defaults")
    return null
  }

  return parsed.data
}

function assetUrl(path: string | null): string | null {
  return path ? brandingAssetPublicUrl(path) : null
}

// ─────────────────────────────────────────────────────────────────────
// The Settings screens
// ─────────────────────────────────────────────────────────────────────

export interface NotificationSettings {
  notifyAdminsOfNewQuotes: boolean
  customerEmailsEnabled: boolean
  adminEmailNotificationsEnabled: boolean
  dashboardNotificationsEnabled: boolean
}

export interface SecuritySettings {
  requireTwoFactor: boolean
  allowPasswordRecovery: boolean
  sessionTimeoutHours: number
}

/** What the Settings screens get. Decimals are converted so it can cross to a client component. */
export interface BusinessSettingsDTO {
  businessName: string
  businessDescription: string
  defaultCountry: string
  primaryPhone: string
  whatsappNumber: string
  businessEmail: string
  businessAddress: string
  businessHours: BusinessHours | null
  social: Record<SocialNetworkField, string | null>

  siteTitle: string | null
  defaultDashboardTheme: AdminTheme
  brandingAssets: Record<BrandingAssetKind, string | null>

  defaultInitialPercentage: number
  defaultMombasaPercentage: number
  defaultFinalPercentage: number

  trackingNumberPrefix: string
  trackingStages: TrackingStageConfig
  sparePartDeliverySteps: SparePartDeliveryStep[] | null

  catalogDisplay: CatalogDisplaySettings
  notifications: NotificationSettings

  seoDefaultTitle: string | null
  seoDefaultDescription: string | null
  sitemapEnabled: boolean
  searchIndexingEnabled: boolean

  security: SecuritySettings
  updatedAt: Date
}

function toBusinessSettingsDTO(row: BusinessSettings): BusinessSettingsDTO {
  return {
    businessName: row.businessName,
    businessDescription: row.businessDescription,
    defaultCountry: row.defaultCountry,
    primaryPhone: row.primaryPhone,
    whatsappNumber: row.whatsappNumber,
    businessEmail: row.businessEmail,
    businessAddress: row.businessAddress,
    businessHours: resolveBusinessHours(row.businessHours),
    social: {
      socialFacebook: row.socialFacebook,
      socialInstagram: row.socialInstagram,
      socialTiktok: row.socialTiktok,
      socialYoutube: row.socialYoutube,
      socialLinkedin: row.socialLinkedin,
      socialX: row.socialX,
    },

    siteTitle: row.siteTitle,
    defaultDashboardTheme: row.defaultDashboardTheme,
    brandingAssets: Object.fromEntries(
      BRANDING_ASSET_KINDS.map((kind) => [kind, assetUrl(row[BRANDING_ASSET_RULES[kind].column])])
    ) as Record<BrandingAssetKind, string | null>,

    // Decimal(5,2) tops out at 999.99, well inside what a number holds exactly.
    defaultInitialPercentage: row.defaultInitialPercentage.toNumber(),
    defaultMombasaPercentage: row.defaultMombasaPercentage.toNumber(),
    defaultFinalPercentage: row.defaultFinalPercentage.toNumber(),

    trackingNumberPrefix: row.trackingNumberPrefix,
    trackingStages: resolveTrackingStageConfig(row.trackingStages),
    sparePartDeliverySteps: parseStoredDeliverySteps(row.sparePartDeliverySteps),

    catalogDisplay: resolveCatalogDisplay(row.catalogDisplay),
    notifications: {
      notifyAdminsOfNewQuotes: row.notifyAdminsOfNewQuotes,
      customerEmailsEnabled: row.customerEmailsEnabled,
      adminEmailNotificationsEnabled: row.adminEmailNotificationsEnabled,
      dashboardNotificationsEnabled: row.dashboardNotificationsEnabled,
    },

    seoDefaultTitle: row.seoDefaultTitle,
    seoDefaultDescription: row.seoDefaultDescription,
    sitemapEnabled: row.sitemapEnabled,
    searchIndexingEnabled: row.searchIndexingEnabled,

    security: {
      requireTwoFactor: row.requireTwoFactor,
      allowPasswordRecovery: row.allowPasswordRecovery,
      sessionTimeoutHours: row.sessionTimeoutHours,
    },
    updatedAt: row.updatedAt,
  }
}

/**
 * The full settings row for the Settings screens and for admin actions that
 * snapshot a default (quote conversion reads the payment split here).
 *
 * Creates the singleton when it is missing: `id = 1` is a singleton by
 * convention, not constraint, and a restored database or a fresh machine
 * where the seed was skipped must still open Settings. Every other column
 * takes its database default.
 */
export const getBusinessSettings = cache(async (): Promise<BusinessSettingsDTO> => {
  const row = await prisma.businessSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, whatsappNumber: "" },
  })

  return toBusinessSettingsDTO(row)
})

// ─────────────────────────────────────────────────────────────────────
// Public surfaces
// ─────────────────────────────────────────────────────────────────────

export interface PublicSocialLink {
  network: SocialNetworkField
  label: string
  url: string
}

export interface PublicSiteSettings {
  businessName: string
  businessDescription: string
  /** The browser-tab suffix: the configured site title, else the business name. */
  siteTitle: string
  defaultCountry: string
  contact: {
    phone: string
    email: string
    address: string
    /**
     * The number every public WhatsApp action uses — empty when none is
     * configured *or* when WhatsApp buttons are switched off in Catalogue
     * display. Every consumer already renders nothing for an empty number, so
     * the switch is honoured in one place rather than at forty call sites.
     */
    whatsappNumber: string
    /** Tap-to-call is switched on and there is a number to call. */
    callUsEnabled: boolean
  }
  /** One line per run of days, or null when hours are not published. */
  hours: string[] | null
  social: PublicSocialLink[]
  branding: {
    logoLightUrl: string | null
    logoDarkUrl: string | null
    faviconUrl: string | null
  }
  seo: {
    title: string
    description: string
    ogImageUrl: string | null
    sitemapEnabled: boolean
    indexingEnabled: boolean
  }
  catalogDisplay: CatalogDisplaySettings
  trackingNumberPrefix: string
  trackingStages: TrackingStageConfig
  sparePartDeliverySteps: SparePartDeliveryStep[] | null
}

/** Columns a public page may see. Supplier notes, security flags and the like are absent. */
const PUBLIC_COLUMNS = {
  businessName: true,
  businessDescription: true,
  defaultCountry: true,
  siteTitle: true,
  primaryPhone: true,
  businessEmail: true,
  businessAddress: true,
  whatsappNumber: true,
  businessHours: true,
  socialFacebook: true,
  socialInstagram: true,
  socialTiktok: true,
  socialYoutube: true,
  socialLinkedin: true,
  socialX: true,
  logoLightStoragePath: true,
  logoDarkStoragePath: true,
  faviconStoragePath: true,
  ogImageStoragePath: true,
  seoDefaultTitle: true,
  seoDefaultDescription: true,
  sitemapEnabled: true,
  searchIndexingEnabled: true,
  catalogDisplay: true,
  trackingNumberPrefix: true,
  trackingStages: true,
  sparePartDeliverySteps: true,
} as const

type PublicRow = { [K in keyof typeof PUBLIC_COLUMNS]: BusinessSettings[K] }

/** The values a public page renders when the row is missing or unreadable. */
const PUBLIC_DEFAULT_ROW: PublicRow = {
  businessName: siteConfig.name,
  businessDescription: siteConfig.description,
  defaultCountry: "SS",
  siteTitle: null,
  primaryPhone: "",
  businessEmail: "",
  businessAddress: "",
  whatsappNumber: "",
  businessHours: null,
  socialFacebook: null,
  socialInstagram: null,
  socialTiktok: null,
  socialYoutube: null,
  socialLinkedin: null,
  socialX: null,
  logoLightStoragePath: null,
  logoDarkStoragePath: null,
  faviconStoragePath: null,
  ogImageStoragePath: null,
  seoDefaultTitle: null,
  seoDefaultDescription: null,
  sitemapEnabled: true,
  searchIndexingEnabled: true,
  catalogDisplay: null,
  trackingNumberPrefix: "CLM",
  trackingStages: null,
  sparePartDeliverySteps: null,
}

function toPublicSiteSettings(row: PublicRow): PublicSiteSettings {
  const catalogDisplay = resolveCatalogDisplay(row.catalogDisplay)
  const hours = resolveBusinessHours(row.businessHours)

  // The stored number wins; NEXT_PUBLIC_WHATSAPP_NUMBER covers the window
  // between a first deploy and someone filling in Settings.
  const configuredWhatsApp = row.whatsappNumber.trim() || siteConfig.whatsappNumber

  const social = (Object.keys(SOCIAL_NETWORKS) as SocialNetworkField[]).flatMap((network) => {
    const url = row[network]
    return url ? [{ network, label: SOCIAL_NETWORKS[network].label, url }] : []
  })

  return {
    businessName: row.businessName,
    businessDescription: row.businessDescription,
    siteTitle: row.siteTitle ?? row.businessName,
    defaultCountry: row.defaultCountry,
    contact: {
      phone: row.primaryPhone,
      email: row.businessEmail,
      address: row.businessAddress,
      whatsappNumber: catalogDisplay.actions.whatsapp ? configuredWhatsApp : "",
      callUsEnabled: catalogDisplay.actions.callUs && row.primaryPhone.trim().length > 0,
    },
    hours: hours ? summariseBusinessHours(hours) : null,
    social,
    branding: {
      logoLightUrl: assetUrl(row.logoLightStoragePath),
      logoDarkUrl: assetUrl(row.logoDarkStoragePath),
      faviconUrl: assetUrl(row.faviconStoragePath),
    },
    seo: {
      title: row.seoDefaultTitle ?? `${row.businessName} — ${siteConfig.tagline}`,
      description: row.seoDefaultDescription ?? row.businessDescription,
      ogImageUrl: assetUrl(row.ogImageStoragePath),
      sitemapEnabled: row.sitemapEnabled,
      indexingEnabled: row.searchIndexingEnabled,
    },
    catalogDisplay,
    trackingNumberPrefix: row.trackingNumberPrefix,
    trackingStages: resolveTrackingStageConfig(row.trackingStages),
    sparePartDeliverySteps: parseStoredDeliverySteps(row.sparePartDeliverySteps),
  }
}

/**
 * Derived inside the cache, so a malformed Json column is logged once per
 * cache fill rather than on every request that reads it.
 */
const readPublicSiteSettings = unstable_cache(
  async (): Promise<PublicSiteSettings> => {
    const row = await prisma.businessSettings.findUnique({ where: { id: 1 }, select: PUBLIC_COLUMNS })
    return toPublicSiteSettings(row ?? PUBLIC_DEFAULT_ROW)
  },
  ["business-settings", "public-site-settings"],
  { tags: [BUSINESS_SETTINGS_CACHE_TAG] }
)

export const getPublicSiteSettings = cache(async (): Promise<PublicSiteSettings> => {
  try {
    return await readPublicSiteSettings()
  } catch (error) {
    // The site's name and contact details are not worth a 500. Logged rather
    // than swallowed (CLAUDE.md rule 13); the page renders with the defaults,
    // so a database blip costs configurability, not the page.
    console.error("[settings] failed to read public site settings; using defaults", error)
    return toPublicSiteSettings(PUBLIC_DEFAULT_ROW)
  }
})

/** The dealership's WhatsApp number for public pages — empty when not offered. */
export async function getWhatsAppNumber(): Promise<string> {
  return (await getPublicSiteSettings()).contact.whatsappNumber
}

/** The parts fulfilment steps for the public spare-part page. */
export async function getSparePartDeliverySteps(): Promise<SparePartDeliveryStep[]> {
  const stored = (await getPublicSiteSettings()).sparePartDeliverySteps
  return stored ?? [...DEFAULT_SPARE_PART_DELIVERY_STEPS]
}

/**
 * The next tracking number the system will issue this year, for display in
 * Settings. Read-only by design: the sequence is allocated atomically by
 * `generateReference` and is never set by hand.
 */
export async function getTrackingSequencePreview(): Promise<{ year: number; nextValue: number }> {
  const year = new Date().getFullYear()
  const sequence = await prisma.referenceSequence.findUnique({
    where: { sequenceKey: `TRACKING-${year}` },
    select: { lastValue: true },
  })

  return { year, nextValue: (sequence?.lastValue ?? 0) + 1 }
}

// ─────────────────────────────────────────────────────────────────────
// Server-side switches
// ─────────────────────────────────────────────────────────────────────

export interface OperationalSettings {
  notifications: NotificationSettings
  security: SecuritySettings
  trackingNumberPrefix: string
  trackingStages: TrackingStageConfig
  defaultDashboardTheme: AdminTheme
}

const OPERATIONAL_DEFAULTS: OperationalSettings = {
  notifications: {
    notifyAdminsOfNewQuotes: true,
    customerEmailsEnabled: true,
    adminEmailNotificationsEnabled: true,
    dashboardNotificationsEnabled: true,
  },
  security: { requireTwoFactor: false, allowPasswordRecovery: true, sessionTimeoutHours: 24 },
  trackingNumberPrefix: "CLM",
  trackingStages: resolveTrackingStageConfig(null),
  defaultDashboardTheme: AdminTheme.LIGHT,
}

const readOperationalSettings = unstable_cache(
  async (): Promise<OperationalSettings> => {
    const row = await prisma.businessSettings.findUnique({
      where: { id: 1 },
      select: {
        notifyAdminsOfNewQuotes: true,
        customerEmailsEnabled: true,
        adminEmailNotificationsEnabled: true,
        dashboardNotificationsEnabled: true,
        requireTwoFactor: true,
        allowPasswordRecovery: true,
        sessionTimeoutHours: true,
        trackingNumberPrefix: true,
        trackingStages: true,
        defaultDashboardTheme: true,
      },
    })

    if (!row) return OPERATIONAL_DEFAULTS

    return {
      notifications: {
        notifyAdminsOfNewQuotes: row.notifyAdminsOfNewQuotes,
        customerEmailsEnabled: row.customerEmailsEnabled,
        adminEmailNotificationsEnabled: row.adminEmailNotificationsEnabled,
        dashboardNotificationsEnabled: row.dashboardNotificationsEnabled,
      },
      security: {
        requireTwoFactor: row.requireTwoFactor,
        allowPasswordRecovery: row.allowPasswordRecovery,
        sessionTimeoutHours: row.sessionTimeoutHours,
      },
      trackingNumberPrefix: row.trackingNumberPrefix,
      trackingStages: resolveTrackingStageConfig(row.trackingStages),
      defaultDashboardTheme: row.defaultDashboardTheme,
    }
  },
  ["business-settings", "operational-settings"],
  { tags: [BUSINESS_SETTINGS_CACHE_TAG] }
)

/**
 * Notifications, security controls and tracking configuration.
 *
 * ── The failure mode is deliberate, and differs by setting ────────────
 * A read failure returns the schema defaults. For notifications that means
 * emails still go out; for security it means the *less* strict defaults
 * (no forced 2FA, 24-hour sessions). That is acceptable only because the
 * same database outage also fails the DAL's AdminProfile lookup, which
 * denies the request outright — there is no state in which this fallback
 * lets someone in who would otherwise be refused.
 */
export const getOperationalSettings = cache(async (): Promise<OperationalSettings> => {
  try {
    return await readOperationalSettings()
  } catch (error) {
    console.error("[settings] failed to read operational settings; using defaults", error)
    return OPERATIONAL_DEFAULTS
  }
})
