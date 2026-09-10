import { TrackingStatus } from "@/generated/prisma/enums"
import { fromCents, toCents } from "@/lib/utils/money"

/**
 * The payment schedule an order is created with.
 *
 * ── The business rule ─────────────────────────────────────────────────
 * A vehicle is paid for in stages (brief §12): a share once the order is
 * confirmed, a share when the car reaches Mombasa, and the rest before it is
 * released — 50/25/25 by default, configurable by the dealership in Settings.
 * A spare-parts order is paid in full before it is packed. Both are rows in
 * the same PaymentMilestone table against the same Payment ledger; only the
 * plan differs.
 *
 * ── Locked in, not looked up ──────────────────────────────────────────
 * The percentages and the amounts they produce are written onto the order's
 * milestone rows when it is created. Changing the defaults in Settings later
 * must never alter what an existing customer agreed to and may already have
 * paid against — the same principle Order.totalAmount follows.
 *
 * Pure, so the split is unit-tested rather than trusted.
 */

export interface MilestoneTemplate {
  label: string
  /** Two-decimal percentage, e.g. 50 or 33.33. */
  percentage: number
  /** The tracking event that makes this stage due. Informational — the
   *  schema is explicit that it does not fire anything on its own. */
  triggerStatus: TrackingStatus | null
}

export interface PlannedMilestone extends MilestoneTemplate {
  /** 1-based, contiguous. */
  sequence: number
  amountDue: number
}

/** "50%" or "33.33%" — never "50.00%". */
export function formatPercentage(value: number): string {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(2))}%`
}

/**
 * The vehicle schedule from the configured percentages.
 *
 * A stage configured at 0% is left out rather than created as a milestone
 * owing nothing: an operator who has set, say, 100/0/0 has decided there is
 * one payment, and a "Mombasa payment — $0" row would be a stage the
 * customer is shown and can never complete.
 */
export function vehicleMilestoneTemplates(percentages: {
  initial: number
  mombasa: number
  final: number
}): MilestoneTemplate[] {
  return [
    {
      label: `Initial payment (${formatPercentage(percentages.initial)})`,
      percentage: percentages.initial,
      triggerStatus: null,
    },
    {
      label: `Mombasa payment (${formatPercentage(percentages.mombasa)})`,
      percentage: percentages.mombasa,
      triggerStatus: TrackingStatus.ARRIVED_AT_MOMBASA,
    },
    {
      label: `Final payment (${formatPercentage(percentages.final)})`,
      percentage: percentages.final,
      triggerStatus: TrackingStatus.READY_FOR_COLLECTION,
    },
  ].filter((template) => template.percentage > 0)
}

export function sparePartMilestoneTemplates(): MilestoneTemplate[] {
  return [{ label: "Payment in full (100%)", percentage: 100, triggerStatus: null }]
}

/**
 * Splits `totalCents` by percentages so the parts add up to the whole,
 * exactly.
 *
 * Every share but the last is rounded *down* to the cent and the last takes
 * the remainder. Rounding each share to nearest would, on an awkward total,
 * produce three amounts that sum to one cent more or less than the price —
 * a customer who paid every milestone in full would still owe a cent, or
 * have overpaid one. Putting the remainder on the final payment keeps the
 * early stages at or under their stated percentage, never over.
 *
 * Percentages are compared in integer hundredths, and must sum to exactly
 * 100 — the settings form enforces it, and this refuses anything else rather
 * than producing a schedule that does not add up.
 */
export function allocateByPercentages(totalCents: number, percentages: readonly number[]): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new RangeError("The total must be a non-negative whole number of cents.")
  }

  if (percentages.length === 0) {
    throw new RangeError("At least one milestone is required.")
  }

  const hundredths = percentages.map((value) => Math.round(value * 100))

  if (hundredths.some((value) => value < 0)) {
    throw new RangeError("Milestone percentages cannot be negative.")
  }

  if (hundredths.reduce((sum, value) => sum + value, 0) !== 10_000) {
    throw new RangeError("Milestone percentages must add up to exactly 100%.")
  }

  const shares = hundredths.map((value) => Math.floor((totalCents * value) / 10_000))
  const allocatedBeforeLast = shares.slice(0, -1).reduce((sum, value) => sum + value, 0)

  shares[shares.length - 1] = totalCents - allocatedBeforeLast

  return shares
}

/** The templates, numbered and priced against `totalAmount`. */
export function planMilestones(
  totalAmount: number,
  templates: readonly MilestoneTemplate[]
): PlannedMilestone[] {
  const amounts = allocateByPercentages(
    toCents(totalAmount),
    templates.map((template) => template.percentage)
  )

  return templates.map((template, index) => ({
    ...template,
    sequence: index + 1,
    amountDue: fromCents(amounts[index]),
  }))
}
