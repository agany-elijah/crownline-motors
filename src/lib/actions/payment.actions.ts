"use server"

import { revalidatePath } from "next/cache"

import type { Prisma } from "@/generated/prisma/client"
import { MilestoneStatus, OrderStatus, PaymentStatus } from "@/generated/prisma/enums"
import { recordAuditLog } from "@/lib/audit"
import { authorizePermission } from "@/lib/auth/admin-guard"
import { can } from "@/lib/auth/permissions"
import { revalidateVehicleSurfaces } from "@/lib/cache/vehicle-surfaces"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants/payment"
import {
  notificationNotice,
  notifyCustomerPaymentConfirmed,
  notifyCustomerPaymentRefunded,
  resolveOrderContact,
} from "@/lib/email/notifications"
import { nextMilestoneStatus, type OrderFinanceSummary } from "@/lib/orders/order-finance"
import { ledgerFinance, lockOrderLedger, type OrderLedger } from "@/lib/orders/order-ledger"
import { syncOrderStatus } from "@/lib/orders/order-status-sync"
import {
  assessMilestonePayment,
  hasMilestoneOpened,
  milestoneToOpenAfterSettlement,
} from "@/lib/orders/payment-recording"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils/format-currency"
import { recordPaymentSchema, reversePaymentSchema } from "@/lib/validations/payment.schema"

/**
 * Recording and reversing payments, from an order's own page.
 *
 * Wave A takes money by bank transfer and mobile money. The customer pays,
 * an operator sees the money arrive, and records it here against the stage it
 * pays for — which is why a recorded payment is CONFIRMED immediately and
 * carries the recording administrator as its verifier.
 *
 * ── Every write is one transaction, with the order's stages locked ────
 * A payment, the stage status it changes, the next stage it may open, the
 * order status it may advance and the audit record all commit together or
 * not at all. The order is locked `FOR UPDATE` first (see order-ledger.ts),
 * so two operators recording against the same order at once — or a payment
 * racing a tracking update — are serialised rather than both passing the
 * "does this fit the balance" check.
 *
 * Nothing is ever deleted: a mistaken or refunded payment is reversed by
 * status, and stops counting toward any balance (schema §8).
 */

export interface PaymentActionState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Record<string, string[]>
}

class OverpaymentError extends Error {
  constructor(public readonly balance: number) {
    super("Payment exceeds the stage balance.")
  }
}

class StageNotOnOrderError extends Error {}
class PaymentNoLongerConfirmedError extends Error {}

interface SettledLedger {
  finance: OrderFinanceSummary
  previousOrderStatus: OrderStatus
  orderStatus: OrderStatus
  openedMilestoneId: string | null
  changedVehicles: { id: string; slug: string }[]
}

/**
 * Brings the maintained columns — the changed stage's status, any stage that
 * change opens, and the order's status — into line with the ledger as it now
 * stands. Runs in the same transaction as the payment write.
 */
async function settleLedger(
  tx: Prisma.TransactionClient,
  orderId: string,
  ledger: OrderLedger,
  changedMilestoneId: string | null,
  context: { actorId: string; cause: string }
): Promise<SettledLedger> {
  const rows = ledger.rows.map((row) => ({ ...row }))
  const before = ledgerFinance({ ...ledger, rows })
  let openedMilestoneId: string | null = null

  const changed = changedMilestoneId ? rows.find((row) => row.id === changedMilestoneId) : undefined
  const changedFinance = changed ? before.milestones.find((milestone) => milestone.id === changed.id) : undefined

  if (changed && changedFinance) {
    const status = nextMilestoneStatus({
      amountDue: changedFinance.amountDue,
      amountPaid: changedFinance.amountPaid,
      wasDue: hasMilestoneOpened(changed),
    })

    if (status !== changed.status) {
      await tx.paymentMilestone.update({
        where: { id: changed.id },
        data: { status, completedAt: status === MilestoneStatus.PAID ? new Date() : null },
      })
      changed.status = status
    }

    if (status === MilestoneStatus.PAID) {
      openedMilestoneId = milestoneToOpenAfterSettlement(
        before.milestones.map((milestone) => ({
          id: milestone.id,
          sequence: milestone.sequence,
          amountDue: milestone.amountDue,
          amountPaid: milestone.amountPaid,
          status: rows.find((row) => row.id === milestone.id)?.status ?? milestone.status,
          triggerStatus: rows.find((row) => row.id === milestone.id)?.triggerStatus ?? null,
        }))
      )

      if (openedMilestoneId) {
        const becameDueAt = new Date()
        await tx.paymentMilestone.update({
          where: { id: openedMilestoneId },
          data: { status: MilestoneStatus.DUE, becameDueAt },
        })
        const opened = rows.find((row) => row.id === openedMilestoneId)
        if (opened) {
          opened.status = MilestoneStatus.DUE
          opened.becameDueAt = becameDueAt
        }
      }
    }
  }

  const finance = ledgerFinance({ ...ledger, rows })
  const order = await syncOrderStatus(tx, { orderId, actorId: context.actorId, cause: context.cause })

  return {
    finance,
    previousOrderStatus: order.previous,
    orderStatus: order.next,
    openedMilestoneId,
    changedVehicles: order.changedVehicles,
  }
}

function orderStatusLabel(status: OrderStatus): string {
  return status.replaceAll("_", " ").toLowerCase()
}

function revalidateOrder(orderId: string, settled: SettledLedger): void {
  revalidatePath(`${ADMIN_BASE_PATH}/orders`)
  revalidatePath(`${ADMIN_BASE_PATH}/orders/${orderId}`)

  for (const vehicle of settled.changedVehicles) {
    revalidateVehicleSurfaces(vehicle.id, vehicle.slug)
  }
}

const ORDER_CONTACT_SELECT = {
  quote: { select: { contactEmail: true, contactName: true } },
  customer: { select: { email: true, fullName: true, deletedAt: true } },
} satisfies Prisma.OrderSelect

// ─────────────────────────────────────────────────────────────────────
// Record
// ─────────────────────────────────────────────────────────────────────

export async function recordPaymentAction(
  _prevState: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const parsed = recordPaymentSchema.safeParse({
    orderId: formData.get("orderId"),
    milestoneId: formData.get("milestoneId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    transactionReference: formData.get("transactionReference"),
    paymentDate: formData.get("paymentDate"),
    notes: formData.get("notes"),
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const auth = await authorizePermission("payment:record")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  // Recorded payments are confirmed on entry, so recording one is also a
  // verification decision.
  if (!can(auth.admin.role, "payment:verify")) {
    return { status: "error", message: "You do not have permission to confirm payments." }
  }

  const { orderId, milestoneId, amount, method, transactionReference, paymentDate, notes } = parsed.data

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      milestones: { where: { id: milestoneId }, select: { label: true } },
      ...ORDER_CONTACT_SELECT,
    },
  })

  if (!order) {
    return { status: "error", message: "That order no longer exists." }
  }

  if (order.status === OrderStatus.CANCELLED) {
    return { status: "error", message: "This order is cancelled and cannot take payments." }
  }

  const stageLabel = order.milestones[0]?.label
  if (!stageLabel) {
    return { status: "error", message: "That payment stage does not belong to this order." }
  }

  const effectiveDate = paymentDate ?? new Date()
  let paymentId: string
  let settled: SettledLedger

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ledger = await lockOrderLedger(tx, orderId)
      const stage = ledgerFinance(ledger).milestones.find((milestone) => milestone.id === milestoneId)

      if (!stage) throw new StageNotOnOrderError()

      const assessment = assessMilestonePayment({ amountDue: stage.amountDue, amountPaid: stage.amountPaid, amount })
      if (!assessment.ok) throw new OverpaymentError(assessment.balance)

      const verifiedAt = new Date()
      const payment = await tx.payment.create({
        data: {
          orderId,
          milestoneId,
          amount,
          method,
          transactionReference: transactionReference ?? null,
          paymentDate: effectiveDate,
          status: PaymentStatus.CONFIRMED,
          verifiedByAdminId: auth.admin.id,
          verifiedAt,
          adminNotes: notes ?? null,
        },
        select: { id: true },
      })

      const outcome = await settleLedger(
        tx,
        orderId,
        { ...ledger, confirmed: [...ledger.confirmed, { amount, milestoneId }] },
        milestoneId,
        { actorId: auth.admin.id, cause: "PAYMENT_RECORDED" }
      )

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "PAYMENT_RECORDED",
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            orderId,
            milestoneId,
            amount,
            method,
            transactionReference: transactionReference ?? null,
            paymentDate: effectiveDate.toISOString(),
            ...(outcome.openedMilestoneId ? { openedMilestoneId: outcome.openedMilestoneId } : {}),
            ...(outcome.orderStatus !== outcome.previousOrderStatus
              ? { previousOrderStatus: outcome.previousOrderStatus, newOrderStatus: outcome.orderStatus }
              : {}),
          },
        },
        tx
      )

      return { paymentId: payment.id, outcome }
    })

    paymentId = result.paymentId
    settled = result.outcome
  } catch (error) {
    if (error instanceof OverpaymentError) {
      const message =
        error.balance > 0
          ? `That is more than the ${formatCurrency(error.balance)} still owed on this stage. Record any excess against the next stage.`
          : "This stage is already paid in full. Record the payment against the next stage."
      return { status: "error", message, fieldErrors: { amount: [message] } }
    }

    if (error instanceof StageNotOnOrderError) {
      return { status: "error", message: "That payment stage does not belong to this order." }
    }

    console.error("[payment] failed to record payment", error)
    return { status: "error", message: "Could not record this payment. Please try again." }
  }

  revalidateOrder(orderId, settled)

  const contact = resolveOrderContact(order)
  const next = settled.finance.milestones.find((milestone) => milestone.balance > 0) ?? null
  const emailOutcome = await notifyCustomerPaymentConfirmed({
    to: contact.email,
    customerName: contact.name,
    paymentId,
    orderNumber: order.orderNumber,
    amount,
    milestoneLabel: stageLabel,
    methodLabel: PAYMENT_METHOD_LABELS[method],
    reference: transactionReference ?? null,
    paymentDate: effectiveDate,
    totalPaid: settled.finance.amountPaid,
    balance: settled.finance.balance,
    next: next ? { label: next.label, amount: next.balance, dueNow: next.status === MilestoneStatus.DUE } : null,
  })

  const statusChange =
    settled.orderStatus !== settled.previousOrderStatus
      ? ` The order is now ${orderStatusLabel(settled.orderStatus)}.`
      : ""

  return {
    status: "success",
    message: `Recorded ${formatCurrency(amount)} against ${stageLabel}.${statusChange} ${notificationNotice(emailOutcome)}`,
  }
}

// ─────────────────────────────────────────────────────────────────────
// Reverse
// ─────────────────────────────────────────────────────────────────────

export async function reversePaymentAction(
  _prevState: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const parsed = reversePaymentSchema.safeParse({
    paymentId: formData.get("paymentId"),
    outcome: formData.get("outcome"),
    reason: formData.get("reason"),
  })

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
    return {
      status: "error",
      message: fieldErrors.reason?.[0] ?? fieldErrors.outcome?.[0] ?? "That payment could not be found.",
      fieldErrors,
    }
  }

  const { paymentId, outcome, reason } = parsed.data

  const auth = await authorizePermission(outcome === PaymentStatus.REFUNDED ? "payment:refund" : "payment:verify")
  if (!auth.ok) {
    return { status: "error", message: auth.message }
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      status: true,
      orderId: true,
      milestoneId: true,
      order: { select: { orderNumber: true, ...ORDER_CONTACT_SELECT } },
    },
  })

  if (!payment) {
    return { status: "error", message: "That payment no longer exists." }
  }

  if (payment.status !== PaymentStatus.CONFIRMED) {
    return { status: "error", message: "Only a confirmed payment can be reversed." }
  }

  const amount = payment.amount.toNumber()
  let settled: SettledLedger

  try {
    settled = await prisma.$transaction(async (tx) => {
      const ledgerBefore = await lockOrderLedger(tx, payment.orderId)

      const current = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        select: { adminNotes: true },
      })

      const reversalNote = `${PAYMENT_STATUS_LABELS[outcome]} by ${auth.admin.displayName} on ${new Date().toISOString().slice(0, 10)}: ${reason}`

      // Conditional on still being CONFIRMED, so a reversal racing another
      // reversal of the same payment changes nothing the second time.
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: PaymentStatus.CONFIRMED },
        data: {
          status: outcome,
          adminNotes: current.adminNotes ? `${current.adminNotes}\n${reversalNote}` : reversalNote,
        },
      })

      if (updated.count === 0) throw new PaymentNoLongerConfirmedError()

      const confirmed = await tx.payment.findMany({
        where: { orderId: payment.orderId, status: PaymentStatus.CONFIRMED },
        select: { amount: true, milestoneId: true },
      })

      const result = await settleLedger(
        tx,
        payment.orderId,
        {
          ...ledgerBefore,
          confirmed: confirmed.map((row) => ({ amount: row.amount.toNumber(), milestoneId: row.milestoneId })),
        },
        payment.milestoneId,
        { actorId: auth.admin.id, cause: "PAYMENT_REVERSED" }
      )

      await recordAuditLog(
        {
          actorId: auth.admin.id,
          action: "PAYMENT_REVERSED",
          entityType: "Payment",
          entityId: paymentId,
          metadata: {
            orderId: payment.orderId,
            milestoneId: payment.milestoneId,
            amount,
            outcome,
            reason,
            ...(result.orderStatus !== result.previousOrderStatus
              ? { previousOrderStatus: result.previousOrderStatus, newOrderStatus: result.orderStatus }
              : {}),
          },
        },
        tx
      )

      return result
    })
  } catch (error) {
    if (error instanceof PaymentNoLongerConfirmedError) {
      return { status: "error", message: "This payment has already been reversed." }
    }

    console.error("[payment] failed to reverse payment", error)
    return { status: "error", message: "Could not reverse this payment. Please try again." }
  }

  revalidateOrder(payment.orderId, settled)

  let notice = ""
  if (outcome === PaymentStatus.REFUNDED) {
    const contact = resolveOrderContact(payment.order)
    const emailOutcome = await notifyCustomerPaymentRefunded({
      to: contact.email,
      customerName: contact.name,
      paymentId,
      orderNumber: payment.order.orderNumber,
      amount,
      balance: settled.finance.balance,
    })
    notice = ` ${notificationNotice(emailOutcome)}`
  }

  const statusChange =
    settled.orderStatus !== settled.previousOrderStatus
      ? ` The order is now ${orderStatusLabel(settled.orderStatus)}.`
      : ""

  return {
    status: "success",
    message: `Payment of ${formatCurrency(amount)} marked ${PAYMENT_STATUS_LABELS[outcome].toLowerCase()}.${statusChange}${notice}`,
  }
}
