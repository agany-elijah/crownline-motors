import "server-only"

import { SparePartAvailability } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { publicSparePartWhere } from "@/lib/queries/public-spare-part.queries"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"

/**
 * Units in hand for published parts — only where the dealership has chosen to
 * publish them: switched on in Settings → Catalogue display, and not hidden
 * on the part itself. Everything else is simply absent from the map.
 *
 * ── Why this is its own module ────────────────────────────────────────
 * The catalogue's card and detail reads (public-spare-part.queries.ts)
 * deliberately never select the stock count, and a unit test holds them to
 * that: a count carried in a card DTO is one careless render away from being
 * published. Settings → Catalogue display → "Show stock quantity" lets an
 * operator decide otherwise, so the count needs *a* public read — but a
 * separate one that checks the switch itself, and returns a slug-to-count map
 * a component has to be handed on purpose.
 *
 * Only parts the listing itself describes as held (in stock or low stock)
 * report a count. A count beside "On order" or "Discontinued" would contradict
 * the promise printed next to it.
 */
export async function getPublishedSparePartStock(slugs: readonly string[]): Promise<Record<string, number>> {
  if (slugs.length === 0) return {}

  const { catalogDisplay } = await getPublicSiteSettings()
  // A count is never shown beside an availability the customer cannot see.
  if (!catalogDisplay.sparePart.stockQuantity || !catalogDisplay.sparePart.availability) return {}

  const rows = await prisma.sparePart.findMany({
    where: publicSparePartWhere({
      slug: { in: [...slugs] },
      availability: { in: [SparePartAvailability.IN_STOCK, SparePartAvailability.LOW_STOCK] },
      NOT: { hiddenFields: { hasSome: ["stockQuantity", "availability"] } },
    }),
    select: { slug: true, stockQuantity: true },
  })

  return Object.fromEntries(rows.map((row) => [row.slug, row.stockQuantity]))
}
