"use client"

import { useActionState, useEffect, type ReactNode } from "react"
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react"

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
const FIELD = "h-9 rounded-md border-input px-2.5 text-small placeholder:text-muted-foreground/70"
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
      <section id="pricing" className="flex flex-col gap-2 rounded-xl bg-card p-6 shadow-[var(--shadow-subtle)] ring-1 ring-foreground/10">
        <h2 className="font-heading text-h3 font-semibold">Details</h2>
        <p className="text-small text-muted-foreground">Locked.</p>
      </section>
    )
  }

  return (
    <section id="pricing" className="flex flex-col gap-6 rounded-xl bg-card p-5 shadow-[var(--shadow-subtle)] ring-1 ring-foreground/10 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-h3 font-semibold">Details</h2>
        <QuotePdfDialog quoteId={quoteId} />
      </div>

      {state.status === "success" && state.message ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" className="text-gold-ink" />
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

        {/* ── Line items ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-lg ring-1 ring-border/70">
            {/* Column headings — table-style on tablet/desktop. Below sm each
                row exposes its own field labels instead, since six columns
                cannot fit a phone width. */}
            <div
              className={cn(
                "hidden items-center gap-2 border-b border-border/60 bg-secondary/40 px-3 py-2 sm:grid",
                "sm:grid-cols-[1fr_7.5rem_3.25rem_6rem_6rem_1.75rem]"
              )}
            >
              <span className="text-meta text-muted-foreground">Item</span>
              <span className="text-meta text-muted-foreground">Reference</span>
              <span className="text-meta text-right text-muted-foreground">Qty</span>
              <span className="text-meta text-right text-muted-foreground">Unit price</span>
              <span className="text-meta text-right text-muted-foreground">Total</span>
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
                        <span className="text-meta text-muted-foreground sm:hidden">Total</span>
                        <span className="text-small font-semibold tabular-nums">{lineTotal}</span>
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
        <div className="flex flex-col gap-4 border-t border-border/50 pt-6">
          <div className="grid gap-3 sm:grid-cols-3">
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

        {/* ── What they're looking for ────────────────────────────────── */}
        {hasLookingFor ? (
          <div className="flex flex-col gap-2 border-t border-border/50 pt-6">
            <span className="text-small font-medium">What they&apos;re looking for</span>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-small sm:grid-cols-4">
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
              <p className="whitespace-pre-wrap text-small text-muted-foreground">
                {additionalRequirements}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ── Text that reaches the customer ──────────────────────────── */}
        <div className="flex flex-col gap-4 border-t border-border/50 pt-6">
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
        <div className="flex flex-col gap-1.5 border-t border-border/50 pt-6">
          <Label htmlFor="adminNotes" className="text-small font-medium">
            Internal notes
          </Label>
          <Textarea
            id="adminNotes"
            name="adminNotes"
            value={adminNotes}
            onChange={(event) => setAdminNotes(event.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Internal only, never sent to the customer — call notes, sourcing details…"
            className={AREA}
          />
        </div>

        <div className="border-t border-border/50 pt-6">
          <Button type="submit" disabled={isPending}>
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
      <span className="text-meta text-muted-foreground sm:hidden">{label}</span>
      {children}
    </div>
  )
}

function LookingForRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
