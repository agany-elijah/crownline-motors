import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import {
  MilestoneStatus,
  OrderStatus,
  QuoteLineKind,
  VehicleStatus,
  type OrderType,
} from "@/generated/prisma/enums"
import { recordAuditLog } from "@/lib/audit"
import {
  planMilestones,
  sparePartMilestoneTemplates,
  vehicleMilestoneTemplates,
} from "@/lib/orders/milestones"
import { computeQuoteTotals, type PricedQuoteLine, type QuoteFees } from "@/lib/quotes/quote-pricing"
import { fromCents, toCents } from "@/lib/utils/money"
import { generateReference } from "@/lib/utils/generate-reference"

/**
 * Builds the Order (and reserves the inventory behind it) from an accepted
 * Quote.
 *
 * ── Why this is not inlined into the Server Action ────────────────────
 * `convertQuoteToOrderAction` still owns authorisation, status checks and
 * error translation — this is the one place that actually moves stock and
 * money, kept small enough to reason about and to unit test in isolation.
 *
 * ── The invariant this enforces that the schema cannot ────────────────
 * `OrderItem` requires exactly one of `vehicleId`/`sparePartId` (schema
 * §7's CHECK). A `QuoteItem` does not: a free-text enquiry line ("a rear
 * bumper for a 2018 Prado") may carry neither, which is the entire reason
 * Get a Quote exists. So every ITEM line must be linked to a real listing
 * before it can become an order line — `UnlinkedQuoteLineError` is thrown
 * rather than letting the database's CHECK reject the whole transaction with
 * a message an operator cannot act on.
 *
 * ── Why inventory is reserved before anything is created ──────────────
 * Every reservation is a conditional write — `UPDATE ... WHERE status IN
 * (...)` for a vehicle, `UPDATE ... WHERE stockQuantity >= quantity` for a
 * part — exactly the pattern the schema documentation requires to avoid a
 * read-then-write oversell race. A single Prisma interactive transaction
 * makes the whole thing atomic: if any line fails, everything reserved by
 * earlier lines in the same call is rolled back with it, so a quote can
 * never end up "half converted".
 */

export class UnlinkedQuoteLineError extends Error {
  constructor(public readonly description: string) {
    super(
      `The line "${description}" is not linked to a vehicle or spare-part listing. Add a listing reference to it before converting to an order.`
    )
  }
}

export class VehicleUnavailableError extends Error {
  constructor(public readonly description: string) {
    super(`"${description}" is no longer available — it may already be reserved or sold.`)
  }
}

export class InsufficientStockError extends Error {
  constructor(public readonly description: string) {
    super(`Not enough stock remains for "${description}".`)
  }
}

export interface QuoteItemForConversion {
  kind: QuoteLineKind
  description: string
  quantity: number
  quotedUnitPrice: number | null
  vehicleId: string | null
  sparePartId: string | null
}

export interface CreateOrderFromQuoteInput {
  quoteId: string
  quoteType: OrderType
  customerId: string
  items: readonly QuoteItemForConversion[]
  shippingCost: number | null
  clearingCost: number | null
  importDuty: number | null
  otherCosts: number | null
  /** Carried over verbatim from the quote's internal notes, so whoever picks
   *  up the order next does not have to reopen the quote to see context an
   *  earlier operator already recorded. A snapshot, not a live link — the
   *  quote's notes can keep changing after conversion without rewriting the
   *  order's. */
  adminNotes: string | null
  milestonePercentages: { initial: number; mombasa: number; final: number }
  actorId: string
}

export interface CreatedOrder {
  id: string
  orderNumber: string
  totalAmount: number
}

export async function createOrderFromQuote(
  tx: Prisma.TransactionClient,
  input: CreateOrderFromQuoteInput
): Promise<CreatedOrder> {
  const itemLines = input.items.filter((item) => item.kind === QuoteLineKind.ITEM)
  const accessoryLines = input.items.filter((item) => item.kind === QuoteLineKind.ACCESSORY)

  for (const line of itemLines) {
    if (!line.vehicleId && !line.sparePartId) {
      throw new UnlinkedQuoteLineError(line.description)
    }
  }

  // Reserved before the order exists, so a failed reservation leaves nothing
  // half-created behind it (see the file note above).
  for (const line of itemLines) {
    if (line.vehicleId) {
      const reserved = await tx.vehicle.updateMany({
        where: {
          id: line.vehicleId,
          status: { in: [VehicleStatus.PUBLISHED, VehicleStatus.RESERVED] },
        },
        data: { status: VehicleStatus.RESERVED },
      })

      if (reserved.count === 0) {
        throw new VehicleUnavailableError(line.description)
      }

      await recordAuditLog(
        {
          actorId: input.actorId,
          action: "VEHICLE_STATUS_CHANGED",
          entityType: "Vehicle",
          entityId: line.vehicleId,
          metadata: {
            newStatus: VehicleStatus.RESERVED,
            reason: "ORDER_CREATED",
            quoteId: input.quoteId,
          },
        },
        tx
      )
    } else if (line.sparePartId) {
      const decremented = await tx.sparePart.updateMany({
        where: { id: line.sparePartId, stockQuantity: { gte: line.quantity } },
        data: { stockQuantity: { decrement: line.quantity } },
      })

      if (decremented.count === 0) {
        throw new InsufficientStockError(line.description)
      }

      await recordAuditLog(
        {
          actorId: input.actorId,
          action: "SPARE_PART_STOCK_RESERVED",
          entityType: "SparePart",
          entityId: line.sparePartId,
          metadata: { quantity: line.quantity, quoteId: input.quoteId },
        },
        tx
      )
    }
  }

  const priced: PricedQuoteLine[] = input.items.map((item) => ({
    kind: item.kind,
    quantity: item.quantity,
    unitPrice: item.quotedUnitPrice,
  }))
  const fees: QuoteFees = {
    shippingCost: input.shippingCost,
    clearingCost: input.clearingCost,
    importDuty: input.importDuty,
    otherCosts: input.otherCosts,
  }
  const totals = computeQuoteTotals(priced, fees)

  const orderNumber = await generateReference(tx, "ORDER")

  const templates =
    input.quoteType === "VEHICLE"
      ? vehicleMilestoneTemplates(input.milestonePercentages)
      : sparePartMilestoneTemplates()
  const planned = planMilestones(totals.total, templates)

  const order = await tx.order.create({
    data: {
      orderNumber,
      quoteId: input.quoteId,
      customerId: input.customerId,
      type: input.quoteType,
      status:
        input.quoteType === "VEHICLE" ? OrderStatus.PENDING_DEPOSIT : OrderStatus.AWAITING_PAYMENT,
      shippingCost: input.shippingCost,
      clearingCost: input.clearingCost,
      importDuty: input.importDuty,
      otherCharges: totals.accessoriesTotal > 0 ? totals.accessoriesTotal : null,
      totalAmount: totals.total,
      notes: input.adminNotes,
      items: {
        create: itemLines.map((line) => ({
          vehicleId: line.vehicleId,
          sparePartId: line.sparePartId,
          description: line.description,
          unitPrice: line.quotedUnitPrice ?? 0,
          quantity: line.quantity,
          lineTotal: fromCents(toCents(line.quotedUnitPrice ?? 0) * line.quantity),
          // Zero for a vehicle, which is reserved by status rather than by
          // count; the quantity itself for a part, so a later cancellation
          // knows exactly how much stock to put back.
          stockReserved: line.sparePartId ? line.quantity : 0,
        })),
      },
      milestones: {
        create: planned.map((milestone) => ({
          sequence: milestone.sequence,
          label: milestone.label,
          percentage: milestone.percentage,
          amountDue: milestone.amountDue,
          status: milestone.sequence === 1 ? MilestoneStatus.DUE : MilestoneStatus.PENDING,
          triggerStatus: milestone.triggerStatus,
        })),
      },
    },
    select: { id: true, orderNumber: true, totalAmount: true },
  })

  await recordAuditLog(
    {
      actorId: input.actorId,
      action: "ORDER_CREATED",
      entityType: "Order",
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        quoteId: input.quoteId,
        totalAmount: totals.total,
        type: input.quoteType,
        itemCount: itemLines.length,
        accessoryCount: accessoryLines.length,
      },
    },
    tx
  )

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount.toNumber(),
  }
}
