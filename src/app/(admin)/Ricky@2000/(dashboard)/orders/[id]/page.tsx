import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { OrderCancelDialog } from "@/components/admin/order-cancel-dialog"
import { OrderDeliveryDateForm } from "@/components/admin/order-delivery-date-form"
import { OrderFinanceSummaryCard } from "@/components/admin/order-finance-summary"
import { OrderPaymentsPanel } from "@/components/admin/order-payments-panel"
import { OrderTrackingPanel } from "@/components/admin/order-tracking-panel"
import { StatusBadge } from "@/components/admin/status-badge"
import { siteConfig } from "@/config/site"
import { requirePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { trackingActivationProblem } from "@/lib/orders/order-lifecycle"
import { getOrderById } from "@/lib/queries/order.queries"
import { firstNameOf } from "@/lib/quotes/quote-messages"
import { trackingPagePath } from "@/lib/tracking/tracking-number"
import { formatCurrency, formatCurrencyOrDash } from "@/lib/utils/format-currency"
import { buildTrackingNumberShareMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

export async function generateMetadata(
  props: PageProps<"/Ricky@2000/orders/[id]">
): Promise<Metadata> {
  const { id } = await props.params
  const order = await getOrderById(id)

  return { title: order ? `Order ${order.orderNumber}` : "Order" }
}

/** Light panel styling shared by every section on this page — a soft ring
 *  and shadow instead of a hard border, so the page reads as smooth surfaces
 *  rather than boxed cards. See the equivalent recipe in `components/ui/card.tsx`. */
const PANEL = "flex flex-col gap-4 rounded-xl bg-card p-6 shadow-[var(--shadow-subtle)] ring-1 ring-foreground/10"

/**
 * A single order, and everywhere it is worked: what was sold, the payments
 * recorded against it, its delivery estimate, and its shipment timeline.
 *
 * There is no separate payments or tracking screen. Recording a deposit and
 * posting a tracking update both happen here, beside the balance and the
 * customer they belong to — and both email the customer automatically.
 */
export default async function AdminOrderDetailPage(props: PageProps<"/Ricky@2000/orders/[id]">) {
  await requirePermission("order:read")

  const { id } = await props.params
  const order = await getOrderById(id)

  if (!order) {
    notFound()
  }

  const trackingShareUrl =
    order.shipment && order.customerWhatsapp
      ? buildWhatsAppUrl({
          phoneNumber: order.customerWhatsapp,
          message: buildTrackingNumberShareMessage({
            siteName: siteConfig.name,
            customerFirstName: firstNameOf(order.customerName),
            orderNumber: order.orderNumber,
            trackingNumber: order.shipment.trackingNumber,
            trackUrl: `${siteConfig.url}${trackingPagePath(order.shipment.trackingNumber)}`,
          }),
        })
      : null

  const isCancelled = order.status === "CANCELLED"
  const canCancel = !isCancelled && order.status !== "COMPLETED"
  // Shown instead of the "Activate tracking" button; the action enforces it.
  const activationProblem = trackingActivationProblem({
    type: order.type,
    status: order.status,
    stages: order.finance.milestones,
  })

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href={`${ADMIN_BASE_PATH}/orders`}
          className="inline-flex w-fit items-center gap-1.5 text-small text-muted-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          All orders
        </Link>

        <AdminPageHeader
          title={order.customerName}
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-small">{order.orderNumber}</span>
              <span aria-hidden="true" className="text-muted-foreground">·</span>
              <Link
                href={`${ADMIN_BASE_PATH}/quotes/${order.quoteId}`}
                className="text-small text-gold-ink hover:underline"
              >
                From quote {order.quoteNumber}
              </Link>
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="neutral" className="text-[11px] px-2 py-0.5">
                {order.status.replaceAll("_", " ").toLowerCase()}
              </StatusBadge>
              {canCancel ? <OrderCancelDialog orderId={order.id} orderNumber={order.orderNumber} /> : null}
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className={PANEL}>
            <h2 className="font-heading text-h3 font-semibold">Items</h2>
            <ul className="flex flex-col divide-y divide-border/60">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{item.description}</span>
                    <span className="text-small text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums">{formatCurrency(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <dl className="flex flex-col gap-1.5 border-t border-border/60 pt-4 text-small">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{formatCurrencyOrDash(order.shippingCost)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Clearing</dt>
                <dd>{formatCurrencyOrDash(order.clearingCost)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Import duty</dt>
                <dd>{formatCurrencyOrDash(order.importDuty)}</dd>
              </div>
              {order.otherCharges ? (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Accessories &amp; extras</dt>
                  <dd>{formatCurrencyOrDash(order.otherCharges)}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-border/60 pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCurrency(order.finance.totalAmount)}</dd>
              </div>
            </dl>
          </section>

          {order.notes ? (
            <section className={PANEL}>
              <h2 className="font-heading text-h3 font-semibold">Notes</h2>
              <p className="whitespace-pre-wrap text-small text-muted-foreground">{order.notes}</p>
            </section>
          ) : null}

          <section className={PANEL}>
            <h2 className="font-heading text-h3 font-semibold">Payments</h2>
            <OrderPaymentsPanel
              orderId={order.id}
              milestones={order.finance.milestones}
              currentlyDueId={order.finance.currentlyDue?.id ?? null}
              payments={order.payments}
              lockedReason={
                isCancelled ? "This order is cancelled, so no further payments can be recorded." : null
              }
            />
          </section>

          <section className={PANEL}>
            <h2 className="font-heading text-h3 font-semibold">Tracking</h2>
            <OrderTrackingPanel
              orderId={order.id}
              shipment={order.shipment}
              customerEmail={order.customerEmail}
              shareUrl={trackingShareUrl}
              activationProblem={activationProblem}
              lockedReason={isCancelled ? "This order is cancelled, so its tracking can no longer be updated." : null}
            />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <OrderFinanceSummaryCard finance={order.finance} />

          <section className={PANEL}>
            <h2 className="font-heading text-h3 font-semibold">Delivery</h2>
            <OrderDeliveryDateForm orderId={order.id} deliveryDate={order.estimatedDeliveryDate} />
          </section>

          <section className={PANEL}>
            <h2 className="font-heading text-h3 font-semibold">Customer</h2>
            <div className="flex flex-col gap-1 text-small">
              <Link
                href={`${ADMIN_BASE_PATH}/customers/${order.customerId}`}
                className="font-medium hover:text-gold-ink"
              >
                {order.customerName}
              </Link>
              {order.customerPhone ? (
                <span className="text-muted-foreground">{order.customerPhone}</span>
              ) : null}
              {order.customerWhatsapp && order.customerWhatsapp !== order.customerPhone ? (
                <span className="text-muted-foreground">WhatsApp {order.customerWhatsapp}</span>
              ) : null}
              <span className="break-all text-muted-foreground">{order.customerEmail ?? "No email on file"}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
