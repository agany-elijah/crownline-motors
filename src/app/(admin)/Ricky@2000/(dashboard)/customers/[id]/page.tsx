import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { QuoteStatusBadge } from "@/components/admin/quote-status-badge"
import { StatusBadge } from "@/components/admin/status-badge"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { requirePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from "@/lib/constants/payment"
import { QUOTE_TYPE_LABELS } from "@/lib/constants/quote-status"
import { FINANCIAL_STATUS_LABELS } from "@/lib/orders/order-finance"
import { getCustomerById } from "@/lib/queries/customer.queries"
import { formatCurrency } from "@/lib/utils/format-currency"
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp"

export async function generateMetadata(props: PageProps<"/Ricky@2000/customers/[id]">): Promise<Metadata> {
  const { id } = await props.params
  const customer = await getCustomerById(id)

  return { title: customer ? customer.fullName : "Customer" }
}

const PANEL = "flex flex-col gap-4 rounded-xl bg-card p-6 shadow-[var(--shadow-subtle)] ring-1 ring-foreground/10"
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })
const ROW_LINK =
  "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 -mx-3 transition-colors duration-fast hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

/** One customer: who they are, and every quote, order and payment they have. */
export default async function AdminCustomerDetailPage(props: PageProps<"/Ricky@2000/customers/[id]">) {
  await requirePermission("customer:read")

  const { id } = await props.params
  const customer = await getCustomerById(id)

  if (!customer) {
    notFound()
  }

  const whatsappUrl = customer.whatsapp
    ? buildWhatsAppUrl({ phoneNumber: customer.whatsapp, message: `Hello ${customer.fullName.split(" ")[0]}, this is ${(await getPublicSiteSettings()).businessName}.` })
    : null

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href={`${ADMIN_BASE_PATH}/customers`}
          className="inline-flex w-fit items-center gap-1.5 text-small text-muted-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          All customers
        </Link>

        <AdminPageHeader
          title={customer.fullName}
          description={<span className="text-small">Customer since {DATE_FORMAT.format(customer.createdAt)}</span>}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className={PANEL}>
            <PanelHeading title="Quotes" count={customer.quotes.length} />
            {customer.quotes.length === 0 ? (
              <Empty>No quotes.</Empty>
            ) : (
              <ul className="flex flex-col">
                {customer.quotes.map((quote) => (
                  <li key={quote.id}>
                    <Link href={`${ADMIN_BASE_PATH}/quotes/${quote.id}`} className={ROW_LINK}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium">{quote.subject ?? QUOTE_TYPE_LABELS[quote.type]}</span>
                        <span className="text-xs text-muted-foreground">
                          <span className="font-mono">{quote.quoteNumber}</span> · {DATE_FORMAT.format(quote.createdAt)}
                        </span>
                      </span>
                      <QuoteStatusBadge status={quote.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={PANEL}>
            <PanelHeading title="Orders" count={customer.orders.length} />
            {customer.orders.length === 0 ? (
              <Empty>No orders.</Empty>
            ) : (
              <ul className="flex flex-col">
                {customer.orders.map((order) => (
                  <li key={order.id}>
                    <Link href={`${ADMIN_BASE_PATH}/orders/${order.id}`} className={ROW_LINK}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-mono text-small font-medium">{order.orderNumber}</span>
                        <span className="text-xs text-muted-foreground">
                          {order.status.replaceAll("_", " ").toLowerCase()} · {DATE_FORMAT.format(order.createdAt)}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-0.5 text-right">
                        <span className="font-semibold tabular-nums">{formatCurrency(order.finance.totalAmount)}</span>
                        <span className="text-xs text-muted-foreground">
                          {FINANCIAL_STATUS_LABELS[order.finance.financialStatus]}
                          {order.finance.balance > 0 ? ` · ${formatCurrency(order.finance.balance)} due` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={PANEL}>
            <PanelHeading title="Payments" count={customer.payments.length} />
            {customer.payments.length === 0 ? (
              <Empty>No payments.</Empty>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {customer.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-semibold tabular-nums">{formatCurrency(payment.amount)}</span>
                      <span className="text-xs text-muted-foreground">
                        {payment.milestoneLabel ?? PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                        <Link href={`${ADMIN_BASE_PATH}/orders/${payment.orderId}`} className="font-mono hover:text-gold-ink">
                          {payment.orderNumber}
                        </Link>{" "}
                        · {DATE_FORMAT.format(payment.date)}
                      </span>
                    </span>
                    <StatusBadge tone={PAYMENT_STATUS_TONES[payment.status]}>{PAYMENT_STATUS_LABELS[payment.status]}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className={PANEL}>
            <h2 className="font-heading text-h3 font-semibold">Contact</h2>
            <dl className="flex flex-col gap-3 text-small">
              <ContactRow icon={<Phone aria-hidden="true" className="size-4" />} label="Phone">
                <a href={`tel:${customer.phone}`} className="hover:text-gold-ink">
                  {customer.phone}
                </a>
              </ContactRow>
              {customer.whatsapp ? (
                <ContactRow icon={<WhatsAppGlyph className="size-4" />} label="WhatsApp">
                  {whatsappUrl ? (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold-ink">
                      {customer.whatsapp}
                    </a>
                  ) : (
                    customer.whatsapp
                  )}
                </ContactRow>
              ) : null}
              <ContactRow icon={<Mail aria-hidden="true" className="size-4" />} label="Email">
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="break-all hover:text-gold-ink">
                    {customer.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </ContactRow>
              <ContactRow icon={<MapPin aria-hidden="true" className="size-4" />} label="Location">
                {[customer.city, customer.country].filter(Boolean).join(", ") || (
                  <span className="text-muted-foreground">—</span>
                )}
              </ContactRow>
            </dl>

            {customer.otherContacts.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
                <h3 className="text-xs font-medium text-muted-foreground">Also used on enquiries</h3>
                <ul className="flex flex-col gap-1 text-small">
                  {customer.otherContacts.map((contact) => (
                    <li key={`${contact.label}:${contact.value}`} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{contact.label}</span>
                      <span className="break-all text-right">{contact.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {customer.relatedCustomers.length > 0 ? (
            <section className={PANEL} aria-labelledby="related-customers-heading">
              <div className="flex flex-col gap-1">
                <h2 id="related-customers-heading" className="font-heading text-h3 font-semibold">
                  Shared contact details
                </h2>
                <p className="text-small text-muted-foreground">
                  Separate customers who used this customer&rsquo;s phone, WhatsApp or email.
                </p>
              </div>
              <ul className="flex flex-col">
                {customer.relatedCustomers.map((related) => (
                  <li key={related.id}>
                    <Link href={`${ADMIN_BASE_PATH}/customers/${related.id}`} className={ROW_LINK}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium">{related.fullName}</span>
                        <span className="text-xs text-muted-foreground">Same {related.sharedDetails.join(" and ")}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {related.quoteCount} {related.quoteCount === 1 ? "quote" : "quotes"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={PANEL}>
            <h2 className="font-heading text-h3 font-semibold">Account</h2>
            <dl className="flex flex-col gap-2 text-small">
              <SummaryRow label="Ordered" value={formatCurrency(customer.totals.ordered)} />
              <SummaryRow label="Paid" value={formatCurrency(customer.totals.paid)} />
              <SummaryRow label="Balance" value={formatCurrency(customer.totals.balance)} strong />
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

function PanelHeading({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="font-heading text-h3 font-semibold">
      {title}
      <span className="ml-2 text-body font-normal text-muted-foreground tabular-nums">{count}</span>
    </h2>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-small text-muted-foreground">{children}</p>
}

function ContactRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="flex min-w-0 flex-col">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t border-border/60 pt-2 font-semibold" : "flex justify-between"}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
