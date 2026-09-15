import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import {
  OrderStatus,
  PaymentStatus,
  QuoteLineKind,
  type OrderType,
  type PaymentMethod,
  type QuoteStatus,
  type QuoteType,
} from "@/generated/prisma/enums"
import { summarizeOrderFinance, type OrderFinanceSummary } from "@/lib/orders/order-finance"
import { prisma } from "@/lib/prisma"
import { fromCents, toCents } from "@/lib/utils/money"
import type { CustomerListFilters } from "@/lib/validations/customer.schema"

/**
 * Reads for the Customers screens.
 *
 * Customer rows are created by the public quote request (see
 * customer-resolution.ts), so every enquirer appears here automatically.
 * Erased customers (`deletedAt`) are never listed.
 */

export const CUSTOMERS_PER_PAGE = 25

export interface CustomerListItem {
  id: string
  fullName: string
  phone: string
  email: string | null
  city: string | null
  quoteCount: number
  orderCount: number
  lastEnquiryAt: Date | null
  createdAt: Date
}

export interface CustomerListResult {
  customers: CustomerListItem[]
  total: number
  page: number
  pageCount: number
}

function buildWhere(filters: CustomerListFilters): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { deletedAt: null }

  if (filters.search) {
    const contains = { contains: filters.search, mode: "insensitive" as const }

    where.OR = [
      { fullName: contains },
      { phone: contains },
      { whatsapp: contains },
      { email: contains },
      { city: contains },
      { quotes: { some: { OR: [{ quoteNumber: contains }, { contactEmail: contains }, { contactPhone: contains }] } } },
      { orders: { some: { orderNumber: contains } } },
    ]
  }

  return where
}

const LIST_ORDER_BY = [
  { createdAt: "desc" },
  { id: "asc" },
] satisfies Prisma.CustomerOrderByWithRelationInput[]

const LIST_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  city: true,
  createdAt: true,
  _count: { select: { quotes: true, orders: true } },
  quotes: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.CustomerSelect

type ListRow = Prisma.CustomerGetPayload<{ select: typeof LIST_SELECT }>

function toListItem(row: ListRow): CustomerListItem {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    city: row.city,
    quoteCount: row._count.quotes,
    orderCount: row._count.orders,
    lastEnquiryAt: row.quotes[0]?.createdAt ?? null,
    createdAt: row.createdAt,
  }
}

export async function listCustomers(filters: CustomerListFilters): Promise<CustomerListResult> {
  const where = buildWhere(filters)
  const total = await prisma.customer.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / CUSTOMERS_PER_PAGE))
  const page = Math.min(Math.max(1, filters.page), pageCount)

  const rows = await prisma.customer.findMany({
    where,
    orderBy: LIST_ORDER_BY,
    skip: (page - 1) * CUSTOMERS_PER_PAGE,
    take: CUSTOMERS_PER_PAGE,
    select: LIST_SELECT,
  })

  return { customers: rows.map(toListItem), total, page, pageCount }
}

export interface CustomerQuoteSummary {
  id: string
  quoteNumber: string
  type: QuoteType
  status: QuoteStatus
  subject: string | null
  createdAt: Date
}

export interface CustomerOrderSummary {
  id: string
  orderNumber: string
  type: OrderType
  status: OrderStatus
  finance: OrderFinanceSummary
  createdAt: Date
}

export interface CustomerPaymentSummary {
  id: string
  orderId: string
  orderNumber: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  milestoneLabel: string | null
  date: Date
}

export interface CustomerDetail {
  id: string
  fullName: string
  phone: string
  whatsapp: string | null
  email: string | null
  city: string | null
  country: string | null
  createdAt: Date
  /** Contact details typed on individual enquiries that differ from the record. */
  otherContacts: { label: string; value: string }[]
  /** Other customers sharing this one's phone, WhatsApp or email. */
  relatedCustomers: RelatedCustomer[]
  quotes: CustomerQuoteSummary[]
  orders: CustomerOrderSummary[]
  payments: CustomerPaymentSummary[]
  totals: { ordered: number; paid: number; balance: number }
}

export type SharedContactDetail = "phone" | "WhatsApp" | "email"

export interface RelatedCustomer {
  id: string
  fullName: string
  /** Which of *this* customer's details the other record also uses. */
  sharedDetails: SharedContactDetail[]
  quoteCount: number
}

const RELATED_CUSTOMERS_LIMIT = 20

/**
 * Customers are identified by name, email, phone and WhatsApp together (see
 * quotes/customer-identity.ts), so one household phone or office inbox can
 * sit on several records. This surfaces them, so an operator replying to one
 * can see who else has used the same number or address.
 */
async function findRelatedCustomers(customer: {
  id: string
  phone: string
  whatsapp: string | null
  email: string | null
}): Promise<RelatedCustomer[]> {
  const numbers = [...new Set([customer.phone, customer.whatsapp].filter((value): value is string => Boolean(value)))]
  const email = customer.email?.toLowerCase() ?? null

  const rows = await prisma.customer.findMany({
    where: {
      id: { not: customer.id },
      deletedAt: null,
      OR: [
        { phone: { in: numbers } },
        { whatsapp: { in: numbers } },
        // Emails are lower-cased on the way in, so an exact match stays indexed.
        ...(email ? [{ email }] : []),
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: RELATED_CUSTOMERS_LIMIT,
    select: { id: true, fullName: true, phone: true, whatsapp: true, email: true, _count: { select: { quotes: true } } },
  })

  return rows.map((row) => {
    const rowNumbers = new Set([row.phone, row.whatsapp])
    const sharedDetails: SharedContactDetail[] = []

    if (rowNumbers.has(customer.phone)) sharedDetails.push("phone")
    if (customer.whatsapp && customer.whatsapp !== customer.phone && rowNumbers.has(customer.whatsapp)) {
      sharedDetails.push("WhatsApp")
    }
    if (email && row.email?.toLowerCase() === email) sharedDetails.push("email")

    return { id: row.id, fullName: row.fullName, sharedDetails, quoteCount: row._count.quotes }
  })
}

export async function getCustomerById(id: string): Promise<CustomerDetail | null> {
  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      phone: true,
      whatsapp: true,
      email: true,
      city: true,
      country: true,
      createdAt: true,
      quotes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quoteNumber: true,
          type: true,
          status: true,
          createdAt: true,
          requestedMake: true,
          requestedModel: true,
          requestedPartName: true,
          contactPhone: true,
          contactWhatsapp: true,
          contactEmail: true,
          items: {
            where: { kind: QuoteLineKind.ITEM },
            orderBy: { displayOrder: "asc" },
            select: { description: true },
          },
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          type: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          milestones: {
            orderBy: { sequence: "asc" },
            select: { id: true, sequence: true, label: true, amountDue: true, status: true },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
              milestoneId: true,
              paymentDate: true,
              createdAt: true,
              milestone: { select: { label: true } },
            },
          },
        },
      },
    },
  })

  if (!customer) return null

  const relatedCustomers = await findRelatedCustomers(customer)

  const orders: CustomerOrderSummary[] = customer.orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    createdAt: order.createdAt,
    finance: summarizeOrderFinance({
      totalAmount: order.totalAmount.toNumber(),
      milestones: order.milestones.map((milestone) => ({ ...milestone, amountDue: milestone.amountDue.toNumber() })),
      payments: order.payments.map((payment) => ({
        amount: payment.amount.toNumber(),
        status: payment.status,
        milestoneId: payment.milestoneId,
      })),
    }),
  }))

  const payments: CustomerPaymentSummary[] = customer.orders
    .flatMap((order) =>
      order.payments.map((payment) => ({
        id: payment.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: payment.amount.toNumber(),
        method: payment.method,
        status: payment.status,
        milestoneLabel: payment.milestone?.label ?? null,
        date: payment.paymentDate ?? payment.createdAt,
      }))
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  const live = orders.filter((order) => order.status !== OrderStatus.CANCELLED)
  const sumCents = (values: number[]) => values.reduce((sum, value) => sum + toCents(value), 0)

  const known = {
    phone: new Set([customer.phone, customer.whatsapp].filter(Boolean)),
    email: new Set([customer.email?.toLowerCase()].filter(Boolean)),
  }
  const otherContacts: { label: string; value: string }[] = []
  const seen = new Set<string>()

  for (const quote of customer.quotes) {
    const candidates: [string, string | null, "phone" | "email"][] = [
      ["Phone", quote.contactPhone, "phone"],
      ["WhatsApp", quote.contactWhatsapp, "phone"],
      ["Email", quote.contactEmail, "email"],
    ]

    for (const [label, value, kind] of candidates) {
      if (!value) continue
      const normalised = kind === "email" ? value.toLowerCase() : value
      if (known[kind].has(normalised) || seen.has(`${label}:${normalised}`)) continue
      seen.add(`${label}:${normalised}`)
      otherContacts.push({ label, value })
    }
  }

  return {
    id: customer.id,
    fullName: customer.fullName,
    phone: customer.phone,
    whatsapp: customer.whatsapp,
    email: customer.email,
    city: customer.city,
    country: customer.country,
    createdAt: customer.createdAt,
    otherContacts,
    relatedCustomers,
    quotes: customer.quotes.map((quote) => ({
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      type: quote.type,
      status: quote.status,
      createdAt: quote.createdAt,
      subject:
        quote.items.length > 0
          ? quote.items.length === 1
            ? quote.items[0].description
            : `${quote.items[0].description} +${quote.items.length - 1}`
          : quote.requestedPartName ??
            ([quote.requestedMake, quote.requestedModel].filter(Boolean).join(" ") || null),
    })),
    orders,
    payments,
    totals: {
      ordered: fromCents(sumCents(live.map((order) => order.finance.totalAmount))),
      paid: fromCents(
        sumCents(payments.filter((payment) => payment.status === PaymentStatus.CONFIRMED).map((p) => p.amount))
      ),
      balance: fromCents(sumCents(live.map((order) => order.finance.balance))),
    },
  }
}
