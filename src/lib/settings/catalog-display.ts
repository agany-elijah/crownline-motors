import {
  DEFAULT_SPARE_PART_VISIBILITY,
  DEFAULT_VEHICLE_VISIBILITY,
  type SparePartInfoField,
  type VehicleInfoField,
  type Visibility,
} from "@/lib/visibility/product-visibility"

/**
 * Settings → Catalogue display: what the public site shows about listings,
 * and which calls to action appear.
 *
 * Stored as one Json value on BusinessSettings and merged over the defaults
 * on every read (see `resolveCatalogDisplay` in the settings schema), so a
 * key added later falls back to its default for existing rows instead of
 * reading as `undefined` — which a `{flag ? … : null}` would treat as "hide".
 *
 * ── Site-wide, not card-only ──────────────────────────────────────────
 * A fact switched off here is hidden everywhere a customer can see it — the
 * cards, the listing pages, metadata, structured data and messages. See
 * `@/lib/visibility/product-visibility` for the per-listing half of the rule.
 *
 * Rows saved before this was site-wide stored `vehicleCard` / `sparePartCard`
 * groups with the same keys. Those are read as the site-wide values when the
 * new groups are absent, so a fact an operator had switched off stays off.
 */

export const CATALOG_ACTIONS = ["getQuote", "whatsapp", "callUs"] as const

export type CatalogAction = (typeof CATALOG_ACTIONS)[number]

export interface CatalogDisplaySettings {
  vehicle: Visibility<VehicleInfoField>
  sparePart: Visibility<SparePartInfoField>
  actions: Record<CatalogAction, boolean>
}

export const DEFAULT_CATALOG_DISPLAY: CatalogDisplaySettings = {
  vehicle: DEFAULT_VEHICLE_VISIBILITY,
  sparePart: DEFAULT_SPARE_PART_VISIBILITY,
  actions: {
    getQuote: true,
    whatsapp: true,
    callUs: true,
  },
}

interface ToggleCopy {
  label: string
  description?: string
}

export const CATALOG_ACTION_COPY: Record<CatalogAction, ToggleCopy> = {
  getQuote: {
    label: "“Get a Quote” buttons",
    description: "Header, menu and catalogue prompts. Requesting a specific listing still works.",
  },
  whatsapp: {
    label: "WhatsApp buttons",
    description: "Every WhatsApp button on the public site, including the floating one.",
  },
  callUs: {
    label: "“Call us” buttons",
    description: "Tap-to-call links to the primary phone number.",
  },
}
