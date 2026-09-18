"use client"

import { useActionState, useId, useState, type ReactNode } from "react"
import { AlertCircle, CheckCircle2, Loader2, Plus } from "lucide-react"

import { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums"
import {
  recordPaymentAction,
  reversePaymentAction,
  type PaymentActionState,
} from "@/lib/actions/payment.actions"
import { NATIVE_SELECT_CLASS } from "@/components/admin/settings/settings-ui"
import { StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from "@/lib/constants/payment"
import type { MilestoneFinance } from "@/lib/orders/order-finance"
import type { OrderPaymentRecord } from "@/lib/queries/order.queries"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format-currency"

const IDLE: PaymentActionState = { status: "idle" }

const FIELD = "h-9 rounded-md border-input bg-card px-2.5 text-small placeholder:text-muted-foreground/70"
const SELECT = cn(NATIVE_SELECT_CLASS, "h-9 rounded-md text-small md:text-small")
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" })
const METHODS = Object.values(PaymentMethod)

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

function amountInputValue(amount: number): string {
  return amount > 0 ? amount.toFixed(2) : ""
}

interface OrderPaymentsPanelProps {
  orderId: string
  milestones: MilestoneFinance[]
  currentlyDueId: string | null
  payments: OrderPaymentRecord[]
  /** Why payments cannot be recorded on this order, or null when they can. */
  lockedReason: string | null
}

/**
 * The order page's payment ledger: record a payment as it arrives, see every
 * payment ever recorded, and reverse one that was wrong or refunded.
 *
 * The balances shown come from the server on every render; the form only
 * pre-fills the amount with what is still owed on the chosen stage, as a
 * convenience the server re-checks.
 */
export function OrderPaymentsPanel({
  orderId,
  milestones,
  currentlyDueId,
  payments,
  lockedReason,
}: OrderPaymentsPanelProps) {
  const [state, formAction, isPending] = useActionState(recordPaymentAction, IDLE)
  const openStages = milestones.filter((milestone) => milestone.balance > 0)

  return (
    <div className="flex flex-col gap-5">
      {state.status === "success" && state.message ? (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-success/25 bg-success/8 px-3 py-2.5 text-small text-foreground">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          {state.message}
        </p>
      ) : null}

      {lockedReason ? (
        <p className="rounded-lg border border-border bg-sunken/60 px-4 py-3 text-small text-muted-foreground">{lockedReason}</p>
      ) : openStages.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/8 px-4 py-3 text-small text-foreground">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />
          Every payment stage is paid in full.
        </p>
      ) : (
        <RecordPaymentForm
          // A new payment row remounts the form, clearing it for the next one;
          // a failed attempt keeps what was typed.
          key={payments.length}
          orderId={orderId}
          stages={openStages}
          defaultStageId={currentlyDueId}
          state={state}
          formAction={formAction}
          isPending={isPending}
        />
      )}

      <PaymentHistory payments={payments} />
    </div>
  )
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function RecordPaymentForm({
  orderId,
  stages,
  defaultStageId,
  state,
  formAction,
  isPending,
}: {
  orderId: string
  stages: MilestoneFinance[]
  defaultStageId: string | null
  state: PaymentActionState
  formAction: (formData: FormData) => void
  isPending: boolean
}) {
  const initialStage = stages.find((stage) => stage.id === defaultStageId) ?? stages[0]

  const [stageId, setStageId] = useState(initialStage.id)
  const [amount, setAmount] = useState(() => amountInputValue(initialStage.balance))
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER)
  const [reference, setReference] = useState("")
  const [paymentDate, setPaymentDate] = useState(todayInputValue)
  const [notes, setNotes] = useState("")

  const stageFieldId = useId()
  const amountId = useId()
  const methodId = useId()
  const dateId = useId()
  const referenceId = useId()
  const notesId = useId()

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {}
  const describedBy = (id: string, field: string) => (errors[field]?.[0] ? `${id}-error` : undefined)

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-sunken/60 p-4">
      <input type="hidden" name="orderId" value={orderId} />

      <h3 className="text-small font-medium text-foreground">Record a payment</h3>

      {state.status === "error" && state.message ? (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field id={stageFieldId} label="Payment for" error={errors.milestoneId?.[0]}>
          <select
            id={stageFieldId}
            name="milestoneId"
            value={stageId}
            onChange={(event) => {
              setStageId(event.target.value)
              const next = stages.find((stage) => stage.id === event.target.value)
              if (next) setAmount(amountInputValue(next.balance))
            }}
            className={SELECT}
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label} — {formatCurrency(stage.balance)} owed
              </option>
            ))}
          </select>
        </Field>

        <Field id={amountId} label="Amount received (USD)" error={errors.amount?.[0]}>
          <Input
            id={amountId}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={Boolean(errors.amount?.[0])}
            aria-describedby={describedBy(amountId, "amount")}
            className={cn(FIELD, "tabular-nums")}
          />
        </Field>

        <Field id={methodId} label="Method" error={errors.method?.[0]}>
          <select
            id={methodId}
            name="method"
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            className={SELECT}
          >
            {METHODS.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_METHOD_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field id={dateId} label="Date received" error={errors.paymentDate?.[0]}>
          <Input
            id={dateId}
            name="paymentDate"
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
            aria-invalid={Boolean(errors.paymentDate?.[0])}
            aria-describedby={describedBy(dateId, "paymentDate")}
            className={FIELD}
          />
        </Field>

        <Field
          id={referenceId}
          label="Transaction reference"
          error={errors.transactionReference?.[0]}
          className="sm:col-span-2"
        >
          <Input
            id={referenceId}
            name="transactionReference"
            maxLength={120}
            autoComplete="off"
            placeholder="Optional"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className={cn(FIELD, "font-mono")}
          />
        </Field>
      </div>

      <Field id={notesId} label="Notes" error={errors.notes?.[0]}>
        <Textarea
          id={notesId}
          name="notes"
          rows={2}
          maxLength={1000}
          placeholder="Internal"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-16 rounded-md border-input bg-card px-2.5 py-2 text-small placeholder:text-muted-foreground/70"
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}
          Record payment
        </Button>
      </div>
    </form>
  )
}

function PaymentHistory({ payments }: { payments: OrderPaymentRecord[] }) {
  if (payments.length === 0) {
    return (
      <p className="text-small text-muted-foreground">No payments recorded yet.</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-small font-medium text-foreground">Payment history</h3>
      <ol className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-lg border border-border">
        {payments.map((payment) => (
          <PaymentRow key={payment.id} payment={payment} />
        ))}
      </ol>
    </div>
  )
}

function PaymentRow({ payment }: { payment: OrderPaymentRecord }) {
  const counts = payment.status === PaymentStatus.CONFIRMED

  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-small font-medium tabular-nums",
              counts ? "text-foreground" : "text-muted-foreground line-through"
            )}
          >
            {formatCurrency(payment.amount)}
          </span>
          <StatusBadge tone={PAYMENT_STATUS_TONES[payment.status]}>{PAYMENT_STATUS_LABELS[payment.status]}</StatusBadge>
        </div>
        <p className="text-xs text-muted-foreground">
          {payment.milestoneLabel ?? "Not attributed to a stage"} · {PAYMENT_METHOD_LABELS[payment.method]}
          {payment.paymentDate ? ` · ${DATE_FORMAT.format(payment.paymentDate)}` : ""}
        </p>
        {payment.transactionReference ? (
          <p className="text-xs text-muted-foreground">
            Ref <span className="font-mono text-foreground">{payment.transactionReference}</span>
          </p>
        ) : null}
        {payment.adminNotes ? (
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">{payment.adminNotes}</p>
        ) : null}
        {payment.verifiedByAdminName ? (
          <p className="text-xs text-muted-foreground">Recorded by {payment.verifiedByAdminName}</p>
        ) : null}
      </div>

      {counts ? <ReversePaymentDialog payment={payment} /> : null}
    </li>
  )
}

function ReversePaymentDialog({ payment }: { payment: OrderPaymentRecord }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(reversePaymentAction, IDLE)
  const reasonId = useId()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>Reverse</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse {formatCurrency(payment.amount)}?</DialogTitle>
        </DialogHeader>

        {state.status === "error" && state.message ? (
          <p role="alert" className="text-small text-destructive">
            {state.message}
          </p>
        ) : null}

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="paymentId" value={payment.id} />

          <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
            <legend className="mb-2 text-xs font-medium text-muted-foreground">Outcome</legend>
            <label className="flex items-center gap-2 text-small">
              <input
                type="radio"
                name="outcome"
                value={PaymentStatus.REJECTED}
                defaultChecked
                className="size-4 accent-foreground"
              />
              Recorded in error
            </label>
            <label className="flex items-center gap-2 text-small">
              <input type="radio" name="outcome" value={PaymentStatus.REFUNDED} className="size-4 accent-foreground" />
              Refunded to customer
            </label>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={reasonId} className="text-xs font-medium text-muted-foreground">
              Reason
            </Label>
            <Textarea
              id={reasonId}
              name="reason"
              rows={2}
              minLength={3}
              maxLength={500}
              required
              placeholder="Duplicate entry"
              className="min-h-16 rounded-md border-input px-2.5 py-2 text-small"
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              Reverse payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
