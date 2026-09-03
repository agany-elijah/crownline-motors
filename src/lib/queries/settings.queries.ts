import "server-only"

import { cache } from "react"
import { unstable_cache } from "next/cache"

import { siteConfig } from "@/config/site"
import { prisma } from "@/lib/prisma"

/**
 * Reads for the BusinessSettings singleton.
 *
 * ── Why the row is created on read ────────────────────────────────────
 * `id = 1` is a singleton by application convention, not a database
 * constraint. The seed creates it, but a database restored from an older
 * backup — or a fresh developer machine where `db:seed` was skipped — would
 * not have it, and every admin page reading settings would then throw. An
 * upsert makes the read total: the defaults it writes are the payment
 * structure from the brief, which is what the business would have configured
 * anyway.
 *
 * This is deliberately NOT the place to be clever about "has an admin
 * configured this yet" — that question is answered by the values
 * themselves (an empty whatsappNumber means not set), not by the row's
 * existence.
 */

/** What callers get. Decimals are converted so this can cross to a client component. */
export interface BusinessSettingsDTO {
  whatsappNumber: string
  defaultInitialPercentage: number
  defaultMombasaPercentage: number
  defaultFinalPercentage: number
  updatedAt: Date
}

/**
 * Prisma returns Decimal objects, which are not serialisable across the
 * server/client boundary and would throw if handed to a form component.
 * Converting here — once, at the edge of the data layer — keeps every caller
 * from having to remember. Decimal(5,2) tops out at 999.99, comfortably
 * inside what a JavaScript number represents exactly, so nothing is lost.
 */
export const getBusinessSettings = cache(async (): Promise<BusinessSettingsDTO> => {
  const settings = await prisma.businessSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      whatsappNumber: "",
      defaultInitialPercentage: 50,
      defaultMombasaPercentage: 25,
      defaultFinalPercentage: 25,
    },
  })

  return {
    whatsappNumber: settings.whatsappNumber,
    defaultInitialPercentage: settings.defaultInitialPercentage.toNumber(),
    defaultMombasaPercentage: settings.defaultMombasaPercentage.toNumber(),
    defaultFinalPercentage: settings.defaultFinalPercentage.toNumber(),
    updatedAt: settings.updatedAt,
  }
})

/**
 * Cache tag for everything derived from BusinessSettings.
 *
 * `updateBusinessSettingsAction` revalidates it, so an operator who changes
 * the WhatsApp number sees it live on the public site immediately rather
 * than at the next deploy or cache expiry.
 */
export const BUSINESS_SETTINGS_CACHE_TAG = "business-settings"

/**
 * The dealership's WhatsApp number, for public pages.
 *
 * ── Why this is not `getBusinessSettings` ─────────────────────────────
 * That function *upserts*. It is written for the admin settings screen,
 * where creating the singleton on first read is the right behaviour and one
 * write per operator page-load costs nothing. Every public page carries a
 * WhatsApp call to action, so reusing it would mean a database write on
 * every visit to the homepage — by anonymous traffic, on a read-only page.
 *
 * ── Why it is cached, and why with a tag ──────────────────────────────
 * The floating button lives in the public layout, so this read sits on the
 * path of every public page. An uncached query there would opt all of them
 * into dynamic rendering and put a database round trip in front of a
 * customer on a slow connection, for a value that changes perhaps twice a
 * year. `unstable_cache` keeps the pages statically renderable, and the tag
 * is what stops that becoming "the number is wrong until someone
 * redeploys".
 *
 * `unstable_cache` rather than the `use cache` directive: the latter
 * requires the `cacheComponents` flag, which is an application-wide
 * rendering change and not something to switch on as a side effect of a
 * WhatsApp button. It is the natural migration when that flag is adopted.
 *
 * ── The fallback ──────────────────────────────────────────────────────
 * An empty stored value falls back to NEXT_PUBLIC_WHATSAPP_NUMBER, which
 * covers the window between deploying and an operator first opening
 * Settings. If both are empty the callers render no WhatsApp action at all
 * — `buildWhatsAppUrl` returns null — which is the correct outcome. A link
 * to a wrong number is worse than no link.
 */
const readStoredWhatsAppNumber = unstable_cache(
  async (): Promise<string> => {
    const settings = await prisma.businessSettings.findUnique({
      where: { id: 1 },
      select: { whatsappNumber: true },
    })

    return settings?.whatsappNumber ?? ""
  },
  ["business-settings", "whatsapp-number"],
  { tags: [BUSINESS_SETTINGS_CACHE_TAG] }
)

export async function getWhatsAppNumber(): Promise<string> {
  try {
    const stored = (await readStoredWhatsAppNumber()).trim()

    if (stored.length > 0) return stored
  } catch (error) {
    // A WhatsApp button is not worth a 500. Logged rather than swallowed
    // (CLAUDE.md rule 13), and the env fallback below still applies — so a
    // database blip degrades the number's configurability, not the page.
    console.error("[settings] failed to read the WhatsApp number", error)
  }

  return siteConfig.whatsappNumber
}
