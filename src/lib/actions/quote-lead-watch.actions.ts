"use server"

import { authorizePermission } from "@/lib/auth/admin-guard"
import { getNewQuoteLeadCount } from "@/lib/queries/quote.queries"

/**
 * How many quote requests are sitting in NEW, for `QuoteLeadWatcher`'s poll.
 *
 * A Server Action rather than a route handler: it needs nothing a route
 * would give it (no custom headers, no non-JSON body), and a client
 * component may call an exported "use server" function directly without a
 * `<form>` around it. Authorised the same as any other read of quote
 * data — polling is not a way around `quote:read`.
 *
 * Returns 0 rather than throwing when the caller lacks permission or the
 * database read fails, because a failed poll should degrade silently to "no
 * new leads shown" rather than surface an error banner for a background
 * refresh nobody asked to watch closely.
 */
export async function getQuoteLeadCountAction(): Promise<number> {
  const auth = await authorizePermission("quote:read")
  if (!auth.ok) return 0

  try {
    return await getNewQuoteLeadCount()
  } catch (error) {
    console.error("[quote-lead-watch] failed to read the new-lead count", error)
    return 0
  }
}
