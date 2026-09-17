import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Mail, Phone } from "lucide-react"

import { AdminMetaDivider, AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminPanel } from "@/components/admin/admin-panel"
import { OrderCancelDialog } from "@/components/admin/order-cancel-dialog"
import { OrderDeliveryDateForm } from "@/components/admin/order-delivery-date-form"
import { OrderFinanceSummaryCard } from "@/components/admin/order-finance-summary"
import { OrderPaymentsPanel } from "@/components/admin/order-payments-panel"
import { OrderTrackingPanel } from "@/components/admin/order-tracking-panel"
import { StatusBadge } from "@/components/admin/status-badge"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { siteConfig } from "@/config/site"
import { requirePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/lib/constants/order-status"
import { trackingActivationProblem } from "@/lib/orders/order-lifecycle"
import { getOrderById } from "@/lib/queries/order.queries"
import { getOperationalSettings, getPublicSiteSettings } from "@/lib/queries/settings.queries"
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
            siteName: (await getPublicSiteSettings()).businessName,
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
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        back={{ href: `${ADMIN_BASE_PATH}/orders`, label: "All orders" }}
        title={order.customerName}
        meta={
          <>
            <span className="font-mono text-foreground">{order.orderNumber}</span>
            <AdminMetaDivider />
            <Link
              href={`${ADMIN_BASE_PATH}/quotes/${order.quoteId}`}
              className="rounded-sm underline-offset-4 transition-colors duration-fast hover:text-gold-ink hover:underline"
            >
              From quote <span className="font-mono">{order.quoteNumber}</span>
            </Link>
            <AdminMetaDivider />
            <StatusBadge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
          </>
        }
        actions={canCancel ? <OrderCancelDialog orderId={order.id} orderNumber={order.orderNumber} /> : null}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <AdminPanel title="Items" description="What was sold, and the costs agreed on the quotation." flush>
            <ul className="flex flex-col divide-y divide-border/70 border-t border-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-small font-medium text-foreground">{item.description}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </span>
                  </div>
                  <span className="shrink-0 text-small font-medium text-foreground tabular-nums">
                    {formatCurrency(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="flex flex-col gap-2 border-t border-border bg-sunken/50 px-5 py-4 text-small sm:px-6">
              <CostRow label="Shipping" value={formatCurrencyOrDash(order.shippingCost)} />
              <CostRow label="Clearing" value={formatCurrencyOrDash(order.clearingCost)} />
              <CostRow label="Import duty" value={formatCurrencyOrDash(order.importDuty)} />
              {order.otherCharges ? (
                <CostRow label="Accessories & extras" value={formatCurrencyOrDash(order.otherCharges)} />
              ) : null}
              <div className="mt-1 flex items-baseline justify-between border-t border-border pt-3">
                <dt className="font-medium text-foreground">Total</dt>
                <dd className="text-body font-semibold text-foreground tabular-nums">
                  {formatCurrency(order.finance.totalAmount)}
                </dd>
              </div>
            </dl>
          </AdminPanel>

          {order.notes ? (
            <AdminPanel title="Notes">
              <p className="text-small whitespace-pre-wrap text-muted-foreground">{order.notes}</p>
            </AdminPanel>
          ) : null}

          <AdminPanel
            id="payments"
            title="Payments"
            description="Record each payment as it arrives, against the stage it pays."
          >
            <OrderPaymentsPanel
              orderId={order.id}
              milestones={order.finance.milestones}
              currentlyDueId={order.finance.currentlyDue?.id ?? null}
              payments={order.payments}
              lockedReason={
                isCancelled ? "This order is cancelled, so no further payments can be recorded." : null
              }
            />
          </AdminPanel>

          <AdminPanel
            id="tracking"
            title="Tracking"
            description="Where the order is on its journey, as the customer sees it on Track My Order."
          >
            <OrderTrackingPanel
              stages={(await getOperationalSettings()).trackingStages}
              orderId={order.id}
              shipment={order.shipment}
              customerEmail={order.customerEmail}
              shareUrl={trackingShareUrl}
              activationProblem={activationProblem}
              lockedReason={isCancelled ? "This order is cancelled, so its tracking can no longer be updated." : null}
            />
            <OrderDeliveryDateForm
              orderId={order.id}
              deliveryDate={order.estimatedDeliveryDate}
              deliveryDateLatest={order.estimatedDeliveryLatest}
            />
          </AdminPanel>
        </div>

        {/* First on a phone: what is owed is the question an order is opened
            to answer, and on a narrow screen it would otherwise sit under
            every form on the page. */}
        <div className="flex min-w-0 flex-col gap-6 max-lg:order-first lg:sticky lg:top-20">
          <OrderFinanceSummaryCard finance={order.finance} />

          <AdminPanel title="Customer" as="aside">
            <div className="flex flex-col gap-3 text-small">
              <Link
                href={`${ADMIN_BASE_PATH}/customers/${order.customerId}`}
                className="w-fit font-medium text-foreground underline-offset-4 transition-colors duration-fast hover:text-gold-ink hover:underline"
              >
                {order.customerName}
              </Link>
              <ul className="flex flex-col gap-2 text-muted-foreground">
                {order.customerPhone ? (
                  <li className="flex items-center gap-2">
                    <Phone aria-hidden="true" className="size-3.5 shrink-0" />
                    <span className="font-mono text-xs text-foreground tabular-nums">{order.customerPhone}</span>
                  </li>
                ) : null}
                {order.customerWhatsapp && order.customerWhatsapp !== order.customerPhone ? (
                  <li className="flex items-center gap-2">
                    <WhatsAppGlyph className="size-3.5 shrink-0" />
                    <span>
                      WhatsApp{" "}
                      <span className="font-mono text-xs text-foreground tabular-nums">{order.customerWhatsapp}</span>
                    </span>
                  </li>
                ) : null}
                <li className="flex items-center gap-2">
                  <Mail aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="break-all">{order.customerEmail ?? "No email on file"}</span>
                </li>
              </ul>
            </div>
          </AdminPanel>
        </div>
      </div>
    </div>
  )
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground tabular-nums">{value}</dd>
    </div>
  )
}
