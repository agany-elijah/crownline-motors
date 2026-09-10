"use client"

import * as React from "react"

/**
 * The dealership's contact details, for client components.
 *
 * The WhatsApp number lives in BusinessSettings and is read on the server
 * (`getWhatsAppNumber`, cached per tag). Server components read it directly;
 * client components — the quote form's "message us about CLM-Q-…" follow-up,
 * the parts list in the header — cannot, and threading it through every
 * intermediate prop would couple components that have nothing to do with it.
 *
 * The public layout reads it once and provides it here. An empty string means
 * "not configured", and every consumer renders no WhatsApp action at all in
 * that case — `buildWhatsAppUrl` returns null for it — rather than a link to a
 * number that does not answer.
 */
interface SiteContact {
  whatsappNumber: string
}

const SiteContactContext = React.createContext<SiteContact>({ whatsappNumber: "" })

export function SiteContactProvider({
  whatsappNumber,
  children,
}: {
  whatsappNumber: string
  children: React.ReactNode
}) {
  const value = React.useMemo(() => ({ whatsappNumber }), [whatsappNumber])

  return <SiteContactContext.Provider value={value}>{children}</SiteContactContext.Provider>
}

export function useSiteContact(): SiteContact {
  return React.useContext(SiteContactContext)
}
