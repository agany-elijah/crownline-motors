import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  Car,
  FileText,
  Package,
  Plus,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { AdminEmptyState } from "@/components/admin/admin-empty-state"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminPanel, AdminStat } from "@/components/admin/admin-panel"
import { QuoteStatusBadge } from "@/components/admin/quote-status-badge"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import { QuoteStatus } from "@/generated/prisma/enums"
import { requireAdmin } from "@/lib/auth/admin-guard"
import { can } from "@/lib/auth/permissions"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/lib/constants/order-status"
import { QUOTE_TYPE_LABELS } from "@/lib/constants/quote-status"
import { listCustomers } from "@/lib/queries/customer.queries"
import { listOrders } from "@/lib/queries/order.queries"
import { getQuoteStatusCounts, listQuotes } from "@/lib/queries/quote.queries"
import { getSparePartStatusCounts } from "@/lib/queries/spare-part.queries"
import { getVehicleStatusCounts } from "@/lib/queries/vehicle.queries"
import { formatCurrency, formatNumber } from "@/lib/utils/format-currency"
import { formatRelativeTime } from "@/lib/utils/format-date-time"

export const metadata: Metadata = {
  title: "Dashboard",
}

/** The dealership's own clock — see lib/utils/format-date-time.ts. */
const TIME_ZONE = "Africa/Juba"

const TODAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
})

const HOUR = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE })

function greetingFor(now: Date): string {
  const hour = Number(HOUR.format(now))
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

/** How many rows each preview list shows before handing over to the full list. */
const PREVIEW_ROWS = 5

/**
 * The dashboard's opening screen: where the business stands, and the work
 * waiting on someone.
 *
 * Every figure is exact. Each comes from a count query or a list's own total,
 * never from a page of rows added up here — a number on this screen that was
 * quietly "the first twenty orders" would be read as the business, and be
 * wrong the day there are twenty-one.
 *
 * Each section is shown only to a role that may read what it summarises. That
 * is presentation, as everywhere in the dashboard: the lists it links to check
 * their own permission on arrival.
 */
export default async function AdminDashboardPage() {
  // Runs even though the layout also calls it — a layout cannot gate a route.
  const admin = await requireAdmin()

  const show = {
    quotes: can(admin.role, "quote:read"),
    orders: can(admin.role, "order:read"),
    vehicles: can(admin.role, "vehicle:read"),
    parts: can(admin.role, "sparePart:read"),
    customers: can(admin.role, "customer:read"),
    addVehicle: can(admin.role, "vehicle:write"),
    addPart: can(admin.role, "sparePart:write"),
    settings: can(admin.role, "settings:read"),
  }

  const [quoteCounts, newQuotes, orders, vehicleCounts, partCounts, customers] = await Promise.all([
    show.quotes ? getQuoteStatusCounts() : null,
    show.quotes ? listQuotes({ status: QuoteStatus.NEW, page: 1 }) : null,
    show.orders ? listOrders({ page: 1 }) : null,
    show.vehicles ? getVehicleStatusCounts() : null,
    show.parts ? getSparePartStatusCounts() : null,
    show.customers ? listCustomers({ page: 1 }) : null,
  ])

  const now = new Date()
  const firstName = admin.displayName.split(" ")[0]
  const newQuoteCount = quoteCounts?.[QuoteStatus.NEW] ?? 0
  const inProgressQuotes =
    (quoteCounts?.[QuoteStatus.CONTACTED] ?? 0) +
    (quoteCounts?.[QuoteStatus.SENT] ?? 0) +
    (quoteCounts?.[QuoteStatus.ACCEPTED] ?? 0)

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={`${greetingFor(now)}, ${firstName}`}
        description={`${TODAY.format(now)} · Here is where the business stands today.`}
        actions={
          <>
            {show.addVehicle ? (
              <Button render={<Link href={`${ADMIN_BASE_PATH}/vehicles/new`} />} variant="outline">
                <Plus aria-hidden="true" />
                Add vehicle
              </Button>
            ) : null}
            {show.quotes ? (
              <Button render={<Link href={`${ADMIN_BASE_PATH}/quotes`} />}>
                Review quotes
                <ArrowRight aria-hidden="true" />
              </Button>
            ) : null}
          </>
        }
      />

      {/* ── The one thing waiting on someone ───────────────────────── */}
      {show.quotes && newQuoteCount > 0 ? (
        <Link
          href={`${ADMIN_BASE_PATH}/quotes?status=${QuoteStatus.NEW}`}
          className="group/alert relative flex items-center gap-4 overflow-hidden rounded-xl border border-gold-ink/25 bg-accent/60 py-4 pr-5 pl-6 transition-colors duration-fast hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gold" />
          <span
            aria-hidden="true"
            className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-card text-gold-ink ring-1 ring-gold-ink/20 sm:flex"
          >
            <FileText className="size-4.5" strokeWidth={1.75} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body font-medium text-foreground">
              {newQuoteCount === 1
                ? "1 new quote request is waiting for a reply"
                : `${formatNumber(newQuoteCount)} new quote requests are waiting for a reply`}
            </span>
            <span className="text-small text-muted-foreground">
              The sooner a customer hears back, the likelier the sale.
            </span>
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 text-small font-medium text-gold-ink sm:inline-flex">
            Open queue
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-fast ease-crownline group-hover/alert:translate-x-0.5"
            />
          </span>
        </Link>
      ) : null}

      {/* ── Instrument cluster ─────────────────────────────────────── */}
      {/*
        One sheet divided into cells, not five cards: the figures are read
        together, and hairlines between them say so. The dividers are the
        sheet's own colour showing through a 1px gap, so they stay exact
        however the grid reflows.
      */}
      <section
        aria-label="At a glance"
        className="overflow-hidden rounded-xl border border-border bg-border shadow-[var(--shadow-subtle)]"
      >
        <div className="grid grid-cols-2 gap-px sm:grid-cols-3 xl:grid-cols-5">
          {show.quotes ? (
            <StatCell href={`${ADMIN_BASE_PATH}/quotes?status=${QuoteStatus.NEW}`}>
              <AdminStat
                icon={FileText}
                label="New quotes"
                value={formatNumber(newQuoteCount)}
                hint={`${formatNumber(inProgressQuotes)} in progress`}
                tone={newQuoteCount > 0 ? "attention" : "default"}
              />
            </StatCell>
          ) : null}
          {orders ? (
            <StatCell href={`${ADMIN_BASE_PATH}/orders`}>
              <AdminStat icon={Package} label="Orders" value={formatNumber(orders.total)} hint="All time" />
            </StatCell>
          ) : null}
          {vehicleCounts ? (
            <StatCell href={`${ADMIN_BASE_PATH}/vehicles?status=PUBLISHED`}>
              <AdminStat
                icon={Car}
                label="Vehicles on site"
                value={formatNumber(vehicleCounts.PUBLISHED ?? 0)}
                hint={`${formatNumber(vehicleCounts.RESERVED ?? 0)} reserved · ${formatNumber(vehicleCounts.DRAFT ?? 0)} drafts`}
              />
            </StatCell>
          ) : null}
          {partCounts ? (
            <StatCell href={`${ADMIN_BASE_PATH}/spare-parts?status=PUBLISHED`}>
              <AdminStat
                icon={Wrench}
                label="Parts on site"
                value={formatNumber(partCounts.PUBLISHED ?? 0)}
                hint={`${formatNumber(partCounts.DRAFT ?? 0)} drafts`}
              />
            </StatCell>
          ) : null}
          {customers ? (
            <StatCell href={`${ADMIN_BASE_PATH}/customers`}>
              <AdminStat icon={Users} label="Customers" value={formatNumber(customers.total)} hint="On file" />
            </StatCell>
          ) : null}
        </div>
      </section>

      {/* ── Work in hand ───────────────────────────────────────────── */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {orders ? (
          <AdminPanel
            title="Recent orders"
            description="The latest orders, with what is still owed on each."
            flush
            actions={
              <Button render={<Link href={`${ADMIN_BASE_PATH}/orders`} />} variant="ghost" size="sm">
                View all
                <ArrowRight aria-hidden="true" />
              </Button>
            }
          >
            {orders.orders.length === 0 ? (
              <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                <AdminEmptyState
                  icon={Package}
                  title="No orders yet"
                  description="An order is created when a customer accepts a quotation."
                  className="py-10 sm:py-10"
                />
              </div>
            ) : (
              <ul className="divide-y divide-border/70 border-t border-border">
                {orders.orders.slice(0, PREVIEW_ROWS).map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`${ADMIN_BASE_PATH}/orders/${order.id}`}
                      className="group/row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors duration-fast hover:bg-sunken/60 focus-visible:bg-sunken focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-6"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-small font-medium text-foreground transition-colors duration-fast group-hover/row:text-gold-ink">
                          {order.customerName}
                        </span>
                        <span className="truncate font-mono text-xs text-muted-foreground">{order.orderNumber}</span>
                      </span>
                      <span className="hidden sm:block">
                        <StatusBadge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
                      </span>
                      <span className="flex flex-col items-end gap-0.5">
                        <span className="text-small font-medium text-foreground tabular-nums">
                          {formatCurrency(order.totalAmount)}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {order.finance.balance > 0 ? `${formatCurrency(order.finance.balance)} due` : "Paid"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>
        ) : null}

        <div className="flex min-w-0 flex-col gap-6">
          {newQuotes ? (
            <AdminPanel
              title="Waiting for a reply"
              description="New enquiries nobody has picked up yet."
              flush
              actions={
                <Button
                  render={<Link href={`${ADMIN_BASE_PATH}/quotes?status=${QuoteStatus.NEW}`} />}
                  variant="ghost"
                  size="sm"
                >
                  View all
                  <ArrowRight aria-hidden="true" />
                </Button>
              }
            >
              {newQuotes.quotes.length === 0 ? (
                <p className="border-t border-border px-5 py-6 text-small text-muted-foreground sm:px-6">
                  All caught up — every enquiry has been picked up.
                </p>
              ) : (
                <ul className="divide-y divide-border/70 border-t border-border">
                  {newQuotes.quotes.slice(0, PREVIEW_ROWS).map((quote) => (
                    <li key={quote.id}>
                      <Link
                        href={`${ADMIN_BASE_PATH}/quotes/${quote.id}`}
                        className="group/row flex items-center justify-between gap-4 px-5 py-3.5 transition-colors duration-fast hover:bg-sunken/60 focus-visible:bg-sunken focus-visible:outline-none sm:px-6"
                      >
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-small font-medium text-foreground transition-colors duration-fast group-hover/row:text-gold-ink">
                            {quote.customerName}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            <span className="font-mono">{quote.quoteNumber}</span> · {QUOTE_TYPE_LABELS[quote.type]}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <QuoteStatusBadge status={quote.status} />
                          <span className="text-xs text-muted-foreground">{formatRelativeTime(quote.createdAt, now)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AdminPanel>
          ) : null}

          <AdminPanel title="Shortcuts" flush>
            <ul className="grid grid-cols-1 border-t border-border sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {show.addVehicle ? (
                <Shortcut href={`${ADMIN_BASE_PATH}/vehicles/new`} icon={Car} label="List a vehicle" />
              ) : null}
              {show.addPart ? (
                <Shortcut href={`${ADMIN_BASE_PATH}/spare-parts/new`} icon={Wrench} label="Add a spare part" />
              ) : null}
              {show.settings ? (
                <Shortcut href={`${ADMIN_BASE_PATH}/settings`} icon={Settings} label="Business settings" />
              ) : null}
              <Shortcut href="/" icon={ArrowUpRight} label="View the website" external />
            </ul>
          </AdminPanel>
        </div>
      </div>
    </div>
  )
}

/**
 * One gauge in the cluster. The whole cell is the link to the list it counts,
 * so the number an operator notices is the thing they can press.
 */
function StatCell({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      // The last cell widens to close the row it ends, so no gap is left
      // showing the divider colour.
      className="group/stat block bg-card px-5 py-5 transition-colors duration-fast last:col-span-2 hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none sm:px-6 sm:last:col-span-2 xl:last:col-span-1"
    >
      {children}
    </Link>
  )
}

function Shortcut({
  href,
  icon: Icon,
  label,
  external = false,
}: {
  href: string
  icon: LucideIcon
  label: string
  external?: boolean
}) {
  return (
    <li className="border-b border-border/70 last:border-b-0 sm:odd:border-r xl:odd:border-r-0 2xl:odd:border-r">
      <Link
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="group/shortcut flex h-12 items-center gap-3 px-5 text-small font-medium text-foreground transition-colors duration-fast hover:bg-sunken/60 focus-visible:bg-sunken focus-visible:outline-none sm:px-6"
      >
        <Icon
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 text-muted-foreground transition-colors duration-fast group-hover/shortcut:text-gold-ink"
        />
        <span className="flex-1">{label}</span>
        {external ? <span className="sr-only">(opens in a new tab)</span> : null}
        <ArrowRight
          aria-hidden="true"
          className="size-3.5 text-muted-foreground opacity-0 transition-[opacity,translate] duration-fast ease-crownline group-hover/shortcut:translate-x-0.5 group-hover/shortcut:opacity-100"
        />
      </Link>
    </li>
  )
}
