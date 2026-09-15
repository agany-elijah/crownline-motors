"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

import type { QuoteDetailItem } from "@/lib/queries/quote.queries"
import { computeQuoteTotals, quoteReadinessProblem, type QuoteTotals } from "@/lib/quotes/quote-pricing"
import { parseMoneyInput } from "@/lib/utils/money"

/**
 * Shared, live pricing state for one quote's editing session.
 *
 * The pricing table (main column) and the summary/issues cards (sticky
 * sidebar) are separate components that both need to reflect the operator's
 * in-progress edits before they are saved — a context is what lets them
 * agree on one draft instead of the sidebar showing figures from the last
 * page load while the table shows what is actually being typed.
 *
 * This holds *draft* state only. Saving is still `QuoteDetailsForm`'s own
 * `useActionState` call against `updateQuoteDetailsAction` — this context
 * never talks to the server.
 *
 * ── Why `isDirty` lives here too ───────────────────────────────────────
 * `sendQuoteDispatchAction` and `convertQuoteToOrderAction` both re-read the
 * quote from the *database*, never from this draft — they have to, because a
 * money-moving action can never trust unvalidated client state. But that
 * means a client-side readiness check computed purely from this draft can
 * say "ready to send" the instant an operator finishes typing a price,
 * while the server would still refuse the send because the database still
 * has the old figures. An operator who has not clicked "Save details" yet
 * would fill in the missing field, try again, and hit what reads as the
 * exact same error — because it *is* the same error, just re-served from
 * stale saved data neither the button nor its message admitted was stale.
 *
 * `isDirty` is what closes that gap: true the moment any field in this
 * draft changes, cleared only by `markSaved()`, which `QuoteDetailsForm`
 * calls once `updateQuoteDetailsAction` actually succeeds. Every action
 * that reads from the database — send, convert, and the PDF preview —
 * checks it before trusting `readinessProblem`'s "ready" verdict at all.
 */

export interface QuoteLineDraft {
  /** Client-side identity for React's key and for removing a row — distinct
   *  from `id`, which is only present once the line exists in the database. */
  key: string
  id?: string
  kind: "ITEM" | "ACCESSORY"
  description: string
  quantity: string
  unitPrice: string
  reference: string
}

let draftKeySeed = 0
function nextDraftKey(): string {
  draftKeySeed += 1
  return `draft-${draftKeySeed}`
}

function toDraft(item: QuoteDetailItem): QuoteLineDraft {
  return {
    key: item.id,
    id: item.id,
    kind: item.kind,
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: item.quotedUnitPrice === null ? "" : String(item.quotedUnitPrice),
    reference: item.reference ?? "",
  }
}

export function emptyQuoteLineDraft(): QuoteLineDraft {
  return { key: nextDraftKey(), kind: "ITEM", description: "", quantity: "1", unitPrice: "", reference: "" }
}

function toDateInputValue(date: Date | null): string {
  if (!date) return ""
  return date.toISOString().slice(0, 10)
}

interface QuotePricingContextValue {
  lines: QuoteLineDraft[]
  updateLine: (key: string, patch: Partial<QuoteLineDraft>) => void
  removeLine: (key: string) => void
  addLine: () => void
  shipping: string
  setShipping: (value: string) => void
  clearing: string
  setClearing: (value: string) => void
  duty: string
  setDuty: (value: string) => void
  otherCostsLabel: string
  setOtherCostsLabel: (value: string) => void
  otherCostsAmount: string
  setOtherCostsAmount: (value: string) => void
  validUntil: string
  setValidUntil: (value: string) => void
  paymentInstructions: string
  setPaymentInstructions: (value: string) => void
  terms: string
  setTerms: (value: string) => void
  adminNotes: string
  setAdminNotes: (value: string) => void
  /** The current lines, serialized for the hidden `lines` form field. */
  linesJson: string
  totals: QuoteTotals
  /** Why this quote isn't ready to send, from the same rule the server
   *  enforces — or null if it is. See `quoteReadinessProblem`. Answers "is
   *  the *draft* complete", not "does the database agree with it yet" —
   *  see `isDirty` for that second question. */
  readinessProblem: string | null
  /** True from the moment any field in this draft changes, until
   *  `markSaved()` is called. See the file note above. */
  isDirty: boolean
  /** Call once a save has actually succeeded — clears `isDirty`. */
  markSaved: () => void
}

const QuotePricingContext = createContext<QuotePricingContextValue | null>(null)

interface QuotePricingProviderProps {
  items: QuoteDetailItem[]
  shippingCost: number | null
  clearingCost: number | null
  importDuty: number | null
  otherCostsLabel: string | null
  otherCostsAmount: number | null
  validUntil: Date | null
  paymentInstructions: string | null
  terms: string | null
  adminNotes: string | null
  children: ReactNode
}

export function QuotePricingProvider({
  items,
  shippingCost,
  clearingCost,
  importDuty,
  otherCostsLabel,
  otherCostsAmount,
  validUntil,
  paymentInstructions,
  terms,
  adminNotes,
  children,
}: QuotePricingProviderProps) {
  const [lines, setLines] = useState<QuoteLineDraft[]>(() =>
    items.length > 0 ? items.map(toDraft) : [emptyQuoteLineDraft()]
  )
  const [shipping, setShippingValue] = useState(shippingCost === null ? "" : String(shippingCost))
  const [clearing, setClearingValue] = useState(clearingCost === null ? "" : String(clearingCost))
  const [duty, setDutyValue] = useState(importDuty === null ? "" : String(importDuty))
  const [otherCostsLabelValue, setOtherCostsLabelValueState] = useState(otherCostsLabel ?? "")
  const [otherCostsAmountValue, setOtherCostsAmountValueState] = useState(
    otherCostsAmount === null ? "" : String(otherCostsAmount)
  )
  const [validUntilValue, setValidUntilValueState] = useState(toDateInputValue(validUntil))
  const [paymentInstructionsValue, setPaymentInstructionsValueState] = useState(paymentInstructions ?? "")
  const [termsValue, setTermsValueState] = useState(terms ?? "")
  const [adminNotesValue, setAdminNotesValueState] = useState(adminNotes ?? "")
  const [isDirty, setIsDirty] = useState(false)

  function updateLine(key: string, patch: Partial<QuoteLineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
    setIsDirty(true)
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key))
    setIsDirty(true)
  }

  function addLine() {
    setLines((current) => [...current, emptyQuoteLineDraft()])
    setIsDirty(true)
  }

  /** Every other draft field follows the same shape: update the value, flag
   *  the draft dirty. Wrapping them here keeps that pairing from being a
   *  rule an individual `onChange` handler could forget. */
  function dirtySetter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setIsDirty(true)
    }
  }

  const setShipping = dirtySetter(setShippingValue)
  const setClearing = dirtySetter(setClearingValue)
  const setDuty = dirtySetter(setDutyValue)
  const setOtherCostsLabel = dirtySetter(setOtherCostsLabelValueState)
  const setOtherCostsAmount = dirtySetter(setOtherCostsAmountValueState)
  const setValidUntil = dirtySetter(setValidUntilValueState)
  const setPaymentInstructions = dirtySetter(setPaymentInstructionsValueState)
  const setTerms = dirtySetter(setTermsValueState)
  const setAdminNotes = dirtySetter(setAdminNotesValueState)

  function markSaved() {
    setIsDirty(false)
  }

  const activeLines = useMemo(
    () => lines.filter((line) => line.description.trim().length > 0),
    [lines]
  )

  const linesJson = useMemo(
    () =>
      JSON.stringify(
        activeLines.map((line) => ({
          id: line.id,
          kind: line.kind,
          description: line.description.trim(),
          quantity: line.quantity,
          unitPrice: line.unitPrice.trim() === "" ? null : line.unitPrice.trim(),
          reference: line.reference.trim() || undefined,
        }))
      ),
    [activeLines]
  )

  const pricedLines = useMemo(
    () =>
      activeLines.map((line) => ({
        kind: line.kind,
        quantity: Number.parseInt(line.quantity, 10) || 0,
        unitPrice: parseMoneyInput(line.unitPrice),
      })),
    [activeLines]
  )

  const fees = useMemo(
    () => ({
      shippingCost: parseMoneyInput(shipping),
      clearingCost: parseMoneyInput(clearing),
      importDuty: parseMoneyInput(duty),
      otherCosts: parseMoneyInput(otherCostsAmountValue),
    }),
    [shipping, clearing, duty, otherCostsAmountValue]
  )

  const totals = useMemo(() => computeQuoteTotals(pricedLines, fees), [pricedLines, fees])

  const readinessProblem = useMemo(
    () =>
      quoteReadinessProblem({
        lines: pricedLines,
        fees,
        validUntil: validUntilValue ? new Date(`${validUntilValue}T00:00:00.000Z`) : null,
      }),
    [pricedLines, fees, validUntilValue]
  )

  const value: QuotePricingContextValue = {
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
    otherCostsLabel: otherCostsLabelValue,
    setOtherCostsLabel,
    otherCostsAmount: otherCostsAmountValue,
    setOtherCostsAmount,
    validUntil: validUntilValue,
    setValidUntil,
    paymentInstructions: paymentInstructionsValue,
    setPaymentInstructions,
    terms: termsValue,
    setTerms,
    adminNotes: adminNotesValue,
    setAdminNotes,
    linesJson,
    totals,
    readinessProblem,
    isDirty,
    markSaved,
  }

  return <QuotePricingContext.Provider value={value}>{children}</QuotePricingContext.Provider>
}

export function useQuotePricing(): QuotePricingContextValue {
  const context = useContext(QuotePricingContext)

  if (!context) {
    throw new Error("useQuotePricing must be used within a QuotePricingProvider")
  }

  return context
}
