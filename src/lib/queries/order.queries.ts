import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type { OrderStatus, OrderType, ShipmentType, TrackingStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { summarizeOrderFinance, type OrderFinanceSummary } from "@/lib/orders/order-finance"

/**
 * Reads for the order screens.
 *
 * Deliberately minimal for now: this module exists to give the "Convert
 * Quote to Order" action somewhere real to send an operator, and to show
 * what that action created. The full order-management surface (recording
 * payments, cancelling, creating shipments) is a later phase's work; nothing
 * here should be extended to imply it already exists.
 */

export const ORDERS_PER_PAGE = 20

export interface OrderListItem {
  id: string
  orderNumber: string
  type: OrderType
  status: OrderStatus
  customerName: string
  totalAmount: number
  finance: OrderFinanceSummary
  createdAt: Date
}

export interface OrderListResult {
  orders: OrderListItem[]
  total: number
  page: number
  pageCount: number
}

const LIST_ORDER_BY = [
  { createdAt: "desc" },
  { id: "asc" },
] satisfies Prisma.OrderOrderByWithRelationInput[]

const LIST_SELECT = {
  id: true,
  orderNumber: true,
  type: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  customer: { select: { fullName: true } },
  milestones: { select: { id: true, sequence: true, label: true, amountDue: true, status: true } },
  payments: { select: { amount: true, status: true, milestoneId: true } },
} satisfies Prisma.OrderSelect

type ListRow = Prisma.OrderGetPayload<{ select: typeof LIST_SELECT }>

function toListItem(row: ListRow): OrderListItem {
  const totalAmount = row.totalAmount.toNumber()

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    type: row.type,
    status: row.status,
    customerName: row.customer.fullName,
    totalAmount,
    finance: summarizeOrderFinance({
      totalAmount,
      milestones: row.milestones.map((milestone) => ({
        id: milestone.id,
        sequence: milestone.sequence,
        label: milestone.label,
        amountDue: milestone.amountDue.toNumber(),
        status: milestone.status,
      })),
      payments: row.payments.map((payment) => ({
        amount: payment.amount.toNumber(),
        status: payment.status,
        milestoneId: payment.milestoneId,
      })),
    }),
    createdAt: row.createdAt,
  }
}

export async function listOrders(filters: { page: number }): Promise<OrderListResult> {
  const page = Math.max(1, filters.page)

  const [total, rows] = await prisma.$transaction([
    prisma.order.count(),
    prisma.order.findMany({
      orderBy: LIST_ORDER_BY,
      skip: (page - 1) * ORDERS_PER_PAGE,
      take: ORDERS_PER_PAGE,
      select: LIST_SELECT,
    }),
  ])

  const pageCount = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE))

  if (page > pageCount) {
    const lastPage = await prisma.order.findMany({
      orderBy: LIST_ORDER_BY,
      skip: (pageCount - 1) * ORDERS_PER_PAGE,
      take: ORDERS_PER_PAGE,
      select: LIST_SELECT,
    })

    return { orders: lastPage.map(toListItem), total, page: pageCount, pageCount }
  }

  return { orders: rows.map(toListItem), total, page, pageCount }
}

export interface OrderDetailItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  vehicleId: string | null
  sparePartId: string | null
}

export interface OrderTrackingEvent {
  id: string
  status: TrackingStatus
  location: string | null
  notes: string | null
  eventDate: Date
  isVoided: boolean
  voidReason: string | null
  createdByAdminName: string
}

export interface OrderShipment {
  id: string
  trackingNumber: string
  shipmentType: ShipmentType
  currentStatus: TrackingStatus
  currentLocation: string | null
  events: OrderTrackingEvent[]
}

export interface OrderDetail {
  id: string
  orderNumber: string
  type: OrderType
  status: OrderStatus
  customerId: string
  customerName: string
  customerPhone: string | null
  quoteId: string
  quoteNumber: string
  shippingCost: number | null
  clearingCost: number | null
  importDuty: number | null
  otherCharges: number | null
  notes: string | null
  estimatedDeliveryDate: Date | null
  items: OrderDetailItem[]
  finance: OrderFinanceSummary
  /** At most one in Wave A — see the schema note on `Order.shipments`. Null
   *  until an operator activates tracking with `createShipmentAction`. */
  shipment: OrderShipment | null
  createdAt: Date
  updatedAt: Date
}

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
      quote: { select: { id: true, quoteNumber: true } },
      items: true,
      milestones: {
        orderBy: { sequence: "asc" },
        select: { id: true, sequence: true, label: true, amountDue: true, status: true },
      },
      payments: { select: { amount: true, status: true, milestoneId: true } },
      shipments: {
        take: 1,
        select: {
          id: true,
          trackingNumber: true,
          shipmentType: true,
          currentStatus: true,
          currentLocation: true,
          events: {
            orderBy: { eventDate: "desc" },
            select: {
              id: true,
              status: true,
              location: true,
              notes: true,
              eventDate: true,
              isVoided: true,
              voidReason: true,
              createdByAdmin: { select: { displayName: true } },
            },
          },
        },
      },
    },
  })

  if (!order) return null

  const totalAmount = order.totalAmount.toNumber()
  const shipment = order.shipments[0]

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    customerId: order.customer.id,
    customerName: order.customer.fullName,
    customerPhone: order.customer.phone,
    quoteId: order.quote.id,
    quoteNumber: order.quote.quoteNumber,
    shippingCost: order.shippingCost?.toNumber() ?? null,
    clearingCost: order.clearingCost?.toNumber() ?? null,
    importDuty: order.importDuty?.toNumber() ?? null,
    otherCharges: order.otherCharges?.toNumber() ?? null,
    notes: order.notes,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    items: order.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toNumber(),
      lineTotal: item.lineTotal.toNumber(),
      vehicleId: item.vehicleId,
      sparePartId: item.sparePartId,
    })),
    finance: summarizeOrderFinance({
      totalAmount,
      milestones: order.milestones.map((milestone) => ({
        id: milestone.id,
        sequence: milestone.sequence,
        label: milestone.label,
        amountDue: milestone.amountDue.toNumber(),
        status: milestone.status,
      })),
      payments: order.payments.map((payment) => ({
        amount: payment.amount.toNumber(),
        status: payment.status,
        milestoneId: payment.milestoneId,
      })),
    }),
    shipment: shipment
      ? {
          id: shipment.id,
          trackingNumber: shipment.trackingNumber,
          shipmentType: shipment.shipmentType,
          currentStatus: shipment.currentStatus,
          currentLocation: shipment.currentLocation,
          events: shipment.events.map((event) => ({
            id: event.id,
            status: event.status,
            location: event.location,
            notes: event.notes,
            eventDate: event.eventDate,
            isVoided: event.isVoided,
            voidReason: event.voidReason,
            createdByAdminName: event.createdByAdmin.displayName,
          })),
        }
      : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}
