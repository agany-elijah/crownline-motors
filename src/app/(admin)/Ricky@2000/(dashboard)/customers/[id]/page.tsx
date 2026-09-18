import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, Mail, MapPin, Phone } from "lucide-react"

import { AdminMetaDivider, AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminPanel, AdminStat } from "@/components/admin/admin-panel"
import { QuoteStatusBadge } from "@/components/admin/quote-status-badge"
import { StatusBadge } from "@/components/admin/status-badge"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { requirePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/lib/constants/order-status"
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

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })
const ROW_LINK =
  "group/row flex items-center justify-between gap-4 px-5 py-3.5 transition-colors duration-fast hover:bg-sunken/60 focus-visible:bg-sunken focus-visible:outline-none sm:px-6"

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

  const location = [customer.city, customer.country].filter(Boolean).join(", ")

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        back={{ href: `${ADMIN_BASE_PATH}/customers`, label: "All customers" }}
        title={customer.fullName}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              Customer since {DATE_FORMAT.format(customer.createdAt)}
            </span>
            {location ? (
              <>
                <AdminMetaDivider />
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden="true" className="size-3.5" />
                  {location}
                </span>
              </>
            ) : null}
          </>
        }
      />

      {/* ── Account at a glance ───────────────────────────────────── */}
      <section
        aria-label="Account"
        className="overflow-hidden rounded-xl border border-border bg-border shadow-[var(--shadow-subtle)]"
      >
        <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
          <AccountCell label="Ordered" value={formatCurrency(customer.totals.ordered)} />
          <AccountCell label="Paid" value={formatCurrency(customer.totals.paid)} />
          <AccountCell
            label="Balance"
            value={formatCurrency(customer.totals.balance)}
            attention={customer.totals.balance > 0}
          />
          <AccountCell
            label="Enquiries"
            value={String(customer.quotes.length)}
            hint={`${customer.orders.length} ${customer.orders.length === 1 ? "order" : "orders"}`}
          />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <AdminPanel title={<PanelTitle title="Quotes" count={customer.quotes.length} />} flush>
            {customer.quotes.length === 0 ? (
              <Empty>No quotes.</Empty>
            ) : (
              <ul className="flex flex-col divide-y divide-border/70 border-t border-border">
                {customer.quotes.map((quote) => (
                  <li key={quote.id}>
                    <Link href={`${ADMIN_BASE_PATH}/quotes/${quote.id}`} className={ROW_LINK}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-small font-medium text-foreground transition-colors duration-fast group-hover/row:text-gold-ink">
                          {quote.subject ?? QUOTE_TYPE_LABELS[quote.type]}
                        </span>
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
          </AdminPanel>

          <AdminPanel title={<PanelTitle title="Orders" count={customer.orders.length} />} flush>
            {customer.orders.length === 0 ? (
              <Empty>No orders.</Empty>
            ) : (
              <ul className="flex flex-col divide-y divide-border/70 border-t border-border">
                {customer.orders.map((order) => (
                  <li key={order.id}>
                    <Link href={`${ADMIN_BASE_PATH}/orders/${order.id}`} className={ROW_LINK}>
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="font-mono text-small font-medium text-foreground transition-colors duration-fast group-hover/row:text-gold-ink">
                          {order.orderNumber}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
                          {DATE_FORMAT.format(order.createdAt)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                        <span className="text-small font-medium text-foreground tabular-nums">
                          {formatCurrency(order.finance.totalAmount)}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {FINANCIAL_STATUS_LABELS[order.finance.financialStatus]}
                          {order.finance.balance > 0 ? ` · ${formatCurrency(order.finance.balance)} due` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>

          <AdminPanel title={<PanelTitle title="Payments" count={customer.payments.length} />} flush>
            {customer.payments.length === 0 ? (
              <Empty>No payments.</Empty>
            ) : (
              <ul className="flex flex-col divide-y divide-border/70 border-t border-border">
                {customer.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-small font-medium text-foreground tabular-nums">{formatCurrency(payment.amount)}</span>
                      <span className="text-xs text-muted-foreground">
                        {payment.milestoneLabel ?? PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                        <Link
                          href={`${ADMIN_BASE_PATH}/orders/${payment.orderId}`}
                          className="font-mono underline-offset-4 hover:text-gold-ink hover:underline"
                        >
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
          </AdminPanel>
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-20">
          <AdminPanel title="Contact" as="aside">
            <dl className="flex flex-col gap-4 text-small">
              <ContactRow icon={<Phone aria-hidden="true" className="size-4" />} label="Phone">
                <a href={`tel:${customer.phone}`} className="font-mono text-xs hover:text-gold-ink">
                  {customer.phone}
                </a>
              </ContactRow>
              {customer.whatsapp ? (
                <ContactRow icon={<WhatsAppGlyph className="size-4" />} label="WhatsApp">
                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs hover:text-gold-ink"
                    >
                      {customer.whatsapp}
                    </a>
                  ) : (
                    <span className="font-mono text-xs">{customer.whatsapp}</span>
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
                {location || <span className="text-muted-foreground">—</span>}
              </ContactRow>
            </dl>

            {customer.otherContacts.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="text-xs font-medium text-muted-foreground">Also used on enquiries</h3>
                <ul className="flex flex-col gap-1.5 text-small">
                  {customer.otherContacts.map((contact) => (
                    <li key={`${contact.label}:${contact.value}`} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{contact.label}</span>
                      <span className="break-all text-right text-foreground">{contact.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </AdminPanel>

          {customer.relatedCustomers.length > 0 ? (
            <AdminPanel
              id="related-customers"
              title="Shared contact details"
              description="Separate customers who used this customer’s phone, WhatsApp or email."
              flush
            >
              <ul className="flex flex-col divide-y divide-border/70 border-t border-border">
                {customer.relatedCustomers.map((related) => (
                  <li key={related.id}>
                    <Link href={`${ADMIN_BASE_PATH}/customers/${related.id}`} className={ROW_LINK}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-small font-medium text-foreground transition-colors duration-fast group-hover/row:text-gold-ink">
                          {related.fullName}
                        </span>
                        <span className="text-xs text-muted-foreground">Same {related.sharedDetails.join(" and ")}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {related.quoteCount} {related.quoteCount === 1 ? "quote" : "quotes"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </AdminPanel>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PanelTitle({ title, count }: { title: string; count: number }) {
  return (
    <span className="flex items-center gap-2">
      {title}
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-secondary px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
        {count}
      </span>
    </span>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="border-t border-border px-5 py-5 text-small text-muted-foreground sm:px-6">{children}</p>
}

function AccountCell({
  label,
  value,
  hint,
  attention = false,
}: {
  label: string
  value: string
  hint?: string
  attention?: boolean
}) {
  return (
    <div className="bg-card px-5 py-4 sm:px-6">
      <AdminStat label={label} value={value} hint={hint} tone={attention ? "attention" : "default"} />
    </div>
  )
}

function ContactRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-foreground">{children}</dd>
      </div>
    </div>
  )
}
