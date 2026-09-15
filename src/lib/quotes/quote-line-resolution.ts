import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { QuoteLineKind } from "@/generated/prisma/enums"
import type { QuoteLineInput } from "@/lib/validations/quote.schema"

/**
 * Resolves the `reference` an operator typed on a quotation line into the
 * catalogue row it names.
 *
 * ── Why this exists separately from the pricing action ────────────────
 * `quoteLineSchema` accepts a reference as a plain string — it cannot do
 * more than match the shape `CLM-V-2026-000123` / `CLM-SP-2026-000045`,
 * because validating it against the catalogue needs a database read. This
 * is that read, done once for every line in a save rather than once per
 * line, and it is the only place a line's `vehicleId`/`sparePartId` is ever
 * decided — the browser never sends one directly.
 *
 * A reference that does not resolve is refused outright (`saveQuotePricing`
 * a stale page, or a typo an operator has not corrected yet) rather than
 * silently stored as an unlinked line — a wrong reference dropped silently
 * would fail invisibly at conversion, when the mistake is much harder to see.
 */

export class UnknownListingReferenceError extends Error {
  constructor(public readonly reference: string) {
    super(`No listing found for reference ${reference}. Check the reference and try again.`)
  }
}

export interface ResolvedQuoteLine {
  /** Present for a line that already exists; absent for a new one. */
  id?: string
  kind: QuoteLineKind
  displayOrder: number
  description: string
  quantity: number
  quotedUnitPrice: number | null
  vehicleId: string | null
  sparePartId: string | null
}

const VEHICLE_REFERENCE_PREFIX = "CLM-V-"

export async function resolveQuoteLines(
  tx: Prisma.TransactionClient,
  lines: readonly QuoteLineInput[]
): Promise<ResolvedQuoteLine[]> {
  const vehicleRefs = new Set<string>()
  const partRefs = new Set<string>()

  for (const line of lines) {
    if (!line.reference) continue
    if (line.reference.startsWith(VEHICLE_REFERENCE_PREFIX)) {
      vehicleRefs.add(line.reference)
    } else {
      partRefs.add(line.reference)
    }
  }

  const [vehicles, parts] = await Promise.all([
    vehicleRefs.size > 0
      ? tx.vehicle.findMany({
          where: { referenceNumber: { in: [...vehicleRefs] } },
          select: { id: true, referenceNumber: true },
        })
      : Promise.resolve([]),
    partRefs.size > 0
      ? tx.sparePart.findMany({
          where: { referenceNumber: { in: [...partRefs] } },
          select: { id: true, referenceNumber: true },
        })
      : Promise.resolve([]),
  ])

  const vehicleByRef = new Map(vehicles.map((vehicle) => [vehicle.referenceNumber, vehicle.id]))
  const partByRef = new Map(parts.map((part) => [part.referenceNumber, part.id]))

  return lines.map((line, index) => {
    let vehicleId: string | null = null
    let sparePartId: string | null = null

    if (line.reference) {
      if (line.reference.startsWith(VEHICLE_REFERENCE_PREFIX)) {
        const id = vehicleByRef.get(line.reference)
        if (!id) throw new UnknownListingReferenceError(line.reference)
        vehicleId = id
      } else {
        const id = partByRef.get(line.reference)
        if (!id) throw new UnknownListingReferenceError(line.reference)
        sparePartId = id
      }
    }

    return {
      id: line.id,
      kind: line.kind === "ACCESSORY" ? QuoteLineKind.ACCESSORY : QuoteLineKind.ITEM,
      displayOrder: index,
      description: line.description,
      quantity: line.quantity,
      quotedUnitPrice: line.unitPrice,
      vehicleId,
      sparePartId,
    }
  })
}
