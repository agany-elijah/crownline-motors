"use client"

import { useActionState, useEffect, type ReactNode } from "react"
import { AlertCircle, CheckCircle2, Loader2, Lock, Plus, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { QuotePdfDialog } from "@/components/admin/quote-pdf-dialog"
import { updateQuoteDetailsAction, type QuoteDetailsFormState } from "@/lib/actions/quote.actions"
import { useQuotePricing } from "@/lib/quotes/quote-pricing-context"
import { cn } from "@/lib/utils"
import { formatCurrency, formatCurrencyOrDash } from "@/lib/utils/format-currency"
import { parseMoneyInput } from "@/lib/utils/money"

const INITIAL_STATE: QuoteDetailsFormState = { status: "idle" }

/** Compact control sizing for this dense, desktop-oriented form — distinct
 *  from the 44px `Input` default, which exists for the public site's
 *  phone-first forms (see input.tsx). An operator working a quote at a desk
 *  needs density, not a larger tap target. */
const FIELD = "h-9 rounded-md border-input bg-card px-2.5 text-small placeholder:text-muted-foreground/70"
const AREA = "min-h-20 rounded-md border-input px-2.5 py-2 text-small leading-relaxed placeholder:text-muted-foreground/70"

interface LookingFor {
  requestedMake: string | null
  requestedModel: string | null
  preferredYear: number | null
  maxBudget: number | null
  requestedPartName: string | null
  requestedPartNumber: string | null
  additionalRequirements: string | null
}

interface QuoteDetailsFormProps extends LookingFor {
  quoteId: string
  updatedAt: Date
  isEditable: boolean
}

/**
 * Everything an operator edits on a quote, in one form with one save button:
 * the line-item table, fees (shipping, clearing, duty, and a miscellaneous
 * fourth one), validity, what the customer originally asked for, the text
 * that ends up in the PDF and dispatch message, and staff-only notes.
 *
 * Line-item and fee state lives in `QuotePricingProvider` (see
 * quote-pricing-context.tsx), shared with the sidebar's summary and issues
 * cards so all three stay in agreement as the operator types.
 */
export function QuoteDetailsForm({
  quoteId,
  updatedAt,
  isEditable,
  requestedMake,
  requestedModel,
  preferredYear,
  maxBudget,
  requestedPartName,
  requestedPartNumber,
  additionalRequirements,
}: QuoteDetailsFormProps) {
  const [state, formAction, isPending] = useActionState(updateQuoteDetailsAction, INITIAL_STATE)
  const {
    lines,
    updateLine,
    removeLine,
    addLine,
    shipping,
    setShipping,
    clearing,
    setClearing,
    duty,
    setDuty,
    otherCostsLabel,
    setOtherCostsLabel,
    otherCostsAmount,
    setOtherCostsAmount,
    validUntil,
    setValidUntil,
    paymentInstructions,
    setPaymentInstructions,
    terms,
    setTerms,
    adminNotes,
    setAdminNotes,
    linesJson,
    markSaved,
  } = useQuotePricing()

  // The draft only stops being "unsaved" once this specific save actually
  // lands — see the file note on `isDirty` in quote-pricing-context.tsx for
  // why that distinction matters to Send/Convert, not just to this form.
  useEffect(() => {
    if (state.status === "success") {
      markSaved()
    }
    // `markSaved` is stable for the life of one QuotePricingProvider — the
    // effect should only re-run when a new save result arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const hasLookingFor = Boolean(
    requestedMake || requestedModel || requestedPartName || additionalRequirements
  )

  if (!isEditable) {
    return (
      <section
        id="pricing"
        className="flex scroll-mt-24 items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-subtle)] sm:p-6"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-sunken text-muted-foreground"
        >
          <Lock className="size-4" strokeWidth={1.75} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-h3">Quotation locked</h2>
          <p className="text-small text-muted-foreground">
            Its items and prices can no longer be edited in this status.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section id="pricing" className="flex scroll-mt-24 flex-col gap-6 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-subtle)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-h3">Quotation</h2>
          <p className="text-small text-muted-foreground">
            What is being offered, at what price, and the words that go to the customer.
          </p>
        </div>
        <QuotePdfDialog quoteId={quoteId} />
      </div>

      {state.status === "success" && state.message ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" className="text-success" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="flex flex-col gap-7">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="expectedUpdatedAt" value={state.updatedAt ?? updatedAt.toISOString()} />
        <input type="hidden" name="lines" value={linesJson} />

        {/* ── What they're looking for ────────────────────────────────── */}
        {hasLookingFor ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-sunken/60 p-4">
            <SubsectionHeading title="What they're looking for" description="From the customer's request." />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-small sm:grid-cols-4">
              {requestedMake ? <LookingForRow label="Make" value={requestedMake} /> : null}
              {requestedModel ? <LookingForRow label="Model" value={requestedModel} /> : null}
              {preferredYear ? <LookingForRow label="Year" value={String(preferredYear)} /> : null}
              {maxBudget !== null ? (
                <LookingForRow label="Budget" value={formatCurrencyOrDash(maxBudget)} />
              ) : null}
              {requestedPartName ? <LookingForRow label="Part" value={requestedPartName} /> : null}
              {requestedPartNumber ? (
                <LookingForRow label="Part number" value={requestedPartNumber} />
              ) : null}
            </dl>
            {additionalRequirements ? (
              <p className="border-t border-border pt-3 whitespace-pre-wrap text-small text-muted-foreground">
                {additionalRequirements}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ── Line items ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <SubsectionHeading title="Line items" description="Each line becomes a row of the quotation." />
          <div className="overflow-hidden rounded-lg border border-border">
            {/* Column headings — table-style on tablet/desktop. Below sm each
                row exposes its own field labels instead, since six columns
                cannot fit a phone width. */}
            <div
              className={cn(
                "hidden items-center gap-2 border-b border-border bg-sunken/70 px-3 py-2 sm:grid",
                "sm:grid-cols-[1fr_7.5rem_3.25rem_6rem_6rem_1.75rem]"
              )}
            >
              <span className="text-xs font-medium text-muted-foreground">Item</span>
              <span className="text-xs font-medium text-muted-foreground">Reference</span>
              <span className="text-right text-xs font-medium text-muted-foreground">Qty</span>
              <span className="text-right text-xs font-medium text-muted-foreground">Unit price</span>
              <span className="text-right text-xs font-medium text-muted-foreground">Total</span>
              <span aria-hidden="true" />
            </div>

            <div className="divide-y divide-border/60">
              {lines.map((line) => {
                const price = parseMoneyInput(line.unitPrice)
                const qty = Number.parseInt(line.quantity, 10) || 0
                const lineTotal = price === null ? "—" : formatCurrency(price * qty)

                return (
                  <div
                    key={line.key}
                    className={cn(
                      "grid grid-cols-2 gap-x-2 gap-y-2 px-3 py-2.5",
                      "sm:grid-cols-[1fr_7.5rem_3.25rem_6rem_6rem_1.75rem] sm:items-center sm:gap-2"
                    )}
                  >
                    <FieldSlot label="Item" className="col-span-2 sm:col-span-1">
                      <Input
                        value={line.description}
                        onChange={(event) => updateLine(line.key, { description: event.target.value })}
                        placeholder="2021 Toyota Harrier, 2.0L"
                        className={FIELD}
                      />
                    </FieldSlot>

                    <FieldSlot label="Reference">
                      <Input
                        value={line.reference}
                        onChange={(event) => updateLine(line.key, { reference: event.target.value })}
                        placeholder="CLM-V-2026-…"
                        className={FIELD}
                      />
                    </FieldSlot>

                    <FieldSlot label="Qty">
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                        className={cn(FIELD, "text-right sm:text-left")}
                      />
                    </FieldSlot>

                    <FieldSlot label="Unit price">
                      <Input
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                        placeholder="0.00"
                        className={cn(FIELD, "text-right tabular-nums")}
                      />
                    </FieldSlot>

                    {/* Total and delete share one row on mobile — delete sits
                        at its bottom-right corner rather than stranded alone
                        in the grid. `sm:contents` unwraps this div at sm+ so
                        its two children fall back into their own explicit
                        grid columns, matching the desktop table layout. */}
                    <div className="col-span-2 flex items-center justify-between gap-2 sm:contents">
                      <div className="flex items-center gap-2 sm:justify-self-end">
                        <span className="text-xs font-medium text-muted-foreground sm:hidden">Total</span>
                        <span className="text-small font-medium tabular-nums">{lineTotal}</span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeLine(line.key)}
                        aria-label="Remove line"
                        className="justify-self-end"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus aria-hidden="true" />
              Add line
            </Button>
          </div>
        </div>

        {/* ── Fees ────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <SubsectionHeading title="Costs and validity" description="Leave a cost empty if it is not part of this quotation." />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shippingCost" className="text-small font-medium">
                Shipping estimate
              </Label>
              <Input
                id="shippingCost"
                name="shippingCost"
                inputMode="decimal"
                value={shipping}
                onChange={(event) => setShipping(event.target.value)}
                placeholder="Not quoted"
                className={FIELD}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clearingCost" className="text-small font-medium">
                Clearing estimate
              </Label>
              <Input
                id="clearingCost"
                name="clearingCost"
                inputMode="decimal"
                value={clearing}
                onChange={(event) => setClearing(event.target.value)}
                placeholder="Not quoted"
                className={FIELD}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="importDuty" className="text-small font-medium">
                Import duty
              </Label>
              <Input
                id="importDuty"
                name="importDuty"
                inputMode="decimal"
                value={duty}
                onChange={(event) => setDuty(event.target.value)}
                placeholder="Not quoted"
                className={FIELD}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium">Other costs</span>
            <div className="grid grid-cols-[1fr_9rem] gap-2">
              <Input
                name="otherCostsLabel"
                aria-label="Other cost label"
                value={otherCostsLabel}
                onChange={(event) => setOtherCostsLabel(event.target.value)}
                placeholder="e.g. Registration fee"
                className={FIELD}
              />
              <Input
                name="otherCostsAmount"
                aria-label="Other cost amount"
                inputMode="decimal"
                value={otherCostsAmount}
                onChange={(event) => setOtherCostsAmount(event.target.value)}
                placeholder="0.00"
                className={cn(FIELD, "text-right tabular-nums")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:w-44">
            <Label htmlFor="validUntil" className="text-small font-medium">
              Valid until
            </Label>
            <Input
              id="validUntil"
              name="validUntil"
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              className={FIELD}
            />
          </div>
        </div>

        {/* ── Text that reaches the customer ──────────────────────────── */}
        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <SubsectionHeading title="For the customer" description="Printed on the quotation they receive." />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paymentInstructions" className="text-small font-medium">
              Payment instructions
            </Label>
            <Textarea
              id="paymentInstructions"
              name="paymentInstructions"
              value={paymentInstructions}
              onChange={(event) => setPaymentInstructions(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Bank name, account name, account number, SWIFT/branch code…"
              className={AREA}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="terms" className="text-small font-medium">
              Terms
            </Label>
            <Textarea
              id="terms"
              name="terms"
              value={terms}
              onChange={(event) => setTerms(event.target.value)}
              rows={3}
              maxLength={3000}
              placeholder="Validity, deposit requirements, anything specific to this quotation…"
              className={AREA}
            />
          </div>
        </div>

        {/* ── Internal notes ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-sunken/60 p-4">
          <SubsectionHeading title="Internal notes" description="Only the team sees these. Never sent to the customer." />
          <Textarea
            id="adminNotes"
            name="adminNotes"
            value={adminNotes}
            onChange={(event) => setAdminNotes(event.target.value)}
            rows={3}
            maxLength={5000}
            aria-label="Internal notes"
            placeholder="Call notes, sourcing details…"
            className={AREA}
          />
        </div>

        <div className="flex items-center justify-end border-t border-border pt-5">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto sm:min-w-32">
            {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            Save details
          </Button>
        </div>
      </form>
    </section>
  )
}

/** A field plus its mobile-only label — the sm+ header row carries the same
 *  information once, so the label hides there rather than repeating it on
 *  every row. */
function FieldSlot({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-muted-foreground sm:hidden">{label}</span>
      {children}
    </div>
  )
}

function LookingForRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words text-foreground">{value}</dd>
    </div>
  )
}

/** A heading for one part of the quotation form, with its one line of context. */
function SubsectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-small font-medium text-foreground">{title}</h3>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}
