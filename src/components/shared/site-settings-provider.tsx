"use client"

import * as React from "react"

import { DEFAULT_CATALOG_DISPLAY, type CatalogDisplaySettings } from "@/lib/settings/catalog-display"

/**
 * The public site settings, for client components.
 *
 * Everything here comes from BusinessSettings and is read once, on the
 * server, by the root layout (`getPublicSiteSettings`, cached per tag).
 * Server components read that function directly; client components — the
 * header, the mobile drawer, the wordmark, the catalogue cards, the quote
 * form — read it here, rather than having it threaded through every
 * component in between.
 *
 * Only public values: the root layout builds this from the public DTO, which
 * never selects notification or security settings.
 */
export interface ClientSiteSettings {
  businessName: string
  /** Empty when not configured or when WhatsApp buttons are switched off. */
  whatsappNumber: string
  /** ISO country whose dialling code public phone fields start from. */
  defaultCountry: string
  phone: string
  callUsEnabled: boolean
  logoLightUrl: string | null
  logoDarkUrl: string | null
  catalogDisplay: CatalogDisplaySettings
}

const DEFAULT_SETTINGS: ClientSiteSettings = {
  businessName: "Crownline Motors",
  whatsappNumber: "",
  defaultCountry: "SS",
  phone: "",
  callUsEnabled: false,
  logoLightUrl: null,
  logoDarkUrl: null,
  catalogDisplay: DEFAULT_CATALOG_DISPLAY,
}

const SiteSettingsContext = React.createContext<ClientSiteSettings>(DEFAULT_SETTINGS)

export function SiteSettingsProvider({
  value,
  children,
}: {
  value: ClientSiteSettings
  children: React.ReactNode
}) {
  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>
}

export function useSiteSettings(): ClientSiteSettings {
  return React.useContext(SiteSettingsContext)
}
