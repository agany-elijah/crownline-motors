import type { ReactNode } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, PackageCheck } from "lucide-react"

import { AdminMetaDivider, AdminPageHeader } from "@/components/admin/admin-page-header"
import { OrderFinanceSummaryCard } from "@/components/admin/order-finance-summary"
import { QuoteActivityTimeline } from "@/components/admin/quote-activity-timeline"
import { QuoteConvertDialog } from "@/components/admin/quote-convert-dialog"
import { QuoteCustomerCard } from "@/components/admin/quote-customer-card"
import { QuoteDetailsForm } from "@/components/admin/quote-details-form"
import { QuoteDispatchDialog } from "@/components/admin/quote-dispatch-dialog"
import { QuoteIssuesPanel } from "@/components/admin/quote-issues-panel"
import { QuoteLinkPanel } from "@/components/admin/quote-link-panel"
import { QuoteStatusBadge } from "@/components/admin/quote-status-badge"
import { QuoteStatusControl } from "@/components/admin/quote-status-control"
import { QuoteSummaryCard } from "@/components/admin/quote-summary-card"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import { requirePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { QUOTE_TYPE_LABELS, isQuoteConvertible, isQuoteEditable, isQuoteSendable } from "@/lib/constants/quote-status"
import { getQuoteById } from "@/lib/queries/quote.queries"
import { QuotePricingProvider } from "@/lib/quotes/quote-pricing-context"

export async function generateMetadata(
  props: PageProps<"/Ricky@2000/quotes/[id]">
): Promise<Metadata> {
  const { id } = await props.params
  const quote = await getQuoteById(id)

  return { title: quote ? `Quote ${quote.quoteNumber}` : "Quote" }
}

export default async function AdminQuoteDetailPage(props: PageProps<"/Ricky@2000/quotes/[id]">) {
  await requirePermission("quote:read")

  const { id } = await props.params
  const quote = await getQuoteById(id)

  if (!quote) {
    notFound()
  }

  const sendable = isQuoteSendable(quote.status)
  const convertible = isQuoteConvertible(quote.status) && !quote.order

  return (
    <QuotePricingProvider
      items={quote.items}
      shippingCost={quote.shippingCost}
      clearingCost={quote.clearingCost}
      importDuty={quote.importDuty}
      otherCostsLabel={quote.otherCostsLabel}
      otherCostsAmount={quote.otherCostsAmount}
      validUntil={quote.validUntil}
      paymentInstructions={quote.paymentInstructions}
      terms={quote.terms}
      adminNotes={quote.adminNotes}
    >
      <div className="flex flex-col gap-6">
        {/* ── Header ────────────────────────────────────────────────────
            Back link, customer name, the quote's identity and status, and the
            two primary actions — nothing else. Wrapped in
            `QuotePricingProvider` (hoisted above this whole page) so
            `QuoteDispatchDialog` can read the same live readiness state the
            details form and issues panel already share, rather than only the
            quote's saved status. */}
        <AdminPageHeader
          back={{ href: `${ADMIN_BASE_PATH}/quotes`, label: "All quotes" }}
          title={quote.customerName}
          meta={
            <>
              <span className="font-mono text-foreground">{quote.quoteNumber}</span>
              <AdminMetaDivider />
              <span>{QUOTE_TYPE_LABELS[quote.type]} quote</span>
              <AdminMetaDivider />
              <QuoteStatusBadge status={quote.status} />
            </>
          }
          actions={
            // A quote that has become an order can be neither sent nor
            // converted, and the banner below is the way forward from it — two
            // dead buttons beside it would only need explaining.
            quote.order && !sendable ? null : (
            <>
              <QuoteDispatchDialog
                quoteId={quote.id}
                customerName={quote.contactName ?? quote.customerName}
                contactEmail={quote.contactEmail}
                contactWhatsapp={quote.contactWhatsapp}
                alreadySent={Boolean(quote.sentAt)}
                disabled={!sendable}
                disabledReason={sendable ? undefined : "This quote is not in a state that can be sent."}
              />
              <QuoteConvertDialog
                quoteId={quote.id}
                total={quote.totals.total}
                disabled={!convertible}
                disabledReason={
                  quote.order
                    ? "This quote has already been converted."
                    : "Send and accept this quote before converting it."
                }
              />
            </>
            )
          }
        />

        {quote.order ? (
          <div className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-gold-ink/25 bg-accent/50 py-4 pr-5 pl-6 sm:flex-row sm:items-center sm:justify-between">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gold" />
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-gold-ink ring-1 ring-gold-ink/20"
              >
                <PackageCheck className="size-4.5" strokeWidth={1.75} />
              </span>
              <div className="flex flex-col">
                <p className="text-small text-muted-foreground">This quote became an order</p>
                <p className="font-mono text-body font-medium text-foreground">{quote.order.orderNumber}</p>
              </div>
            </div>
            <Button render={<Link href={`${ADMIN_BASE_PATH}/orders/${quote.order.id}`} />} variant="outline">
              View order
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        {/* ── Workspace ─────────────────────────────────────────────────
            Two columns from lg: substantial, editable sections on the left;
            compact reference cards in a sticky sidebar on the right. Below
            lg the sidebar simply follows the main content in document order. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <QuoteDetailsForm
              quoteId={quote.id}
              updatedAt={quote.updatedAt}
              isEditable={isQuoteEditable(quote.status)}
              requestedMake={quote.requestedMake}
              requestedModel={quote.requestedModel}
              preferredYear={quote.preferredYear}
              maxBudget={quote.maxBudget}
              requestedPartName={quote.requestedPartName}
              requestedPartNumber={quote.requestedPartNumber}
              additionalRequirements={quote.additionalRequirements}
            />

            {quote.order ? <OrderFinanceSummaryCard finance={quote.order.finance} /> : null}
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
            <QuoteSummaryCard />

            <QuoteIssuesPanel
              hasEmail={Boolean(quote.contactEmail)}
              hasWhatsapp={Boolean(quote.contactWhatsapp)}
              isWon={Boolean(quote.order)}
            />

            <QuoteCustomerCard
              name={quote.contactName ?? quote.customerName}
              phone={quote.contactPhone}
              whatsapp={quote.contactWhatsapp}
              email={quote.contactEmail}
              city={quote.contactCity}
            />

            <QuoteStatusControl quoteId={quote.id} status={quote.status} />

            {quote.linkedVehicle ? (
              <ReferenceCard title="About this vehicle">
                <Link
                  href={`${ADMIN_BASE_PATH}/vehicles/${quote.linkedVehicle.id}`}
                  className="text-small font-medium text-gold-ink hover:underline"
                >
                  {quote.linkedVehicle.year} {quote.linkedVehicle.make} {quote.linkedVehicle.model}
                </Link>
                <span className="font-mono text-xs text-muted-foreground">
                  {quote.linkedVehicle.referenceNumber}
                </span>
              </ReferenceCard>
            ) : null}

            {quote.linkedSparePart ? (
              <ReferenceCard title="About this part">
                <Link
                  href={`${ADMIN_BASE_PATH}/spare-parts/${quote.linkedSparePart.id}`}
                  className="text-small font-medium text-gold-ink hover:underline"
                >
                  {quote.linkedSparePart.name}
                </Link>
                <span className="font-mono text-xs text-muted-foreground">
                  {quote.linkedSparePart.referenceNumber}
                </span>
              </ReferenceCard>
            ) : null}

            {quote.shareToken ? (
              <QuoteLinkPanel quoteId={quote.id} link={`${siteConfig.url}/quotation/${quote.shareToken}`} />
            ) : null}

            <QuoteActivityTimeline
              createdAt={quote.createdAt}
              sentAt={quote.sentAt}
              lastSentVia={quote.lastSentVia}
              order={quote.order ? { orderNumber: quote.order.orderNumber, createdAt: quote.order.createdAt } : null}
            />
          </div>
        </div>
      </div>
    </QuotePricingProvider>
  )
}

function ReferenceCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-subtle)]">
      <h2 className="text-small font-medium text-foreground">{title}</h2>
      {children}
    </section>
  )
}
