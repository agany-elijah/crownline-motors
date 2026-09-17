"use client"

import * as React from "react"
import { Info } from "lucide-react"

import {
  SettingsFormAlert,
  SettingsSaveBar,
  useSettingsForm,
} from "@/components/admin/settings/settings-form-controls"
import { SettingsPanel } from "@/components/admin/settings/settings-ui"
import { Input } from "@/components/ui/input"
import { updateCommerceSettingsAction } from "@/lib/actions/settings.actions"
import { planMilestones, vehicleMilestoneTemplates } from "@/lib/orders/milestones"
import type { BusinessSettingsDTO } from "@/lib/queries/settings.queries"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format-currency"

/** The vehicle price the worked example is calculated on. */
const EXAMPLE_TOTAL = 20_000

function toHundredths(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

const STAGES = [
  {
    name: "defaultInitialPercentage",
    label: "Deposit",
    due: "Once the order is confirmed. Procurement and shipping start after it is paid.",
  },
  {
    name: "defaultMombasaPercentage",
    label: "Mombasa payment",
    due: "When the vehicle arrives at Mombasa.",
  },
  {
    name: "defaultFinalPercentage",
    label: "Final payment",
    due: "When the vehicle is ready for collection, before it is handed over.",
  },
] as const

type Props = {
  settings: Pick<
    BusinessSettingsDTO,
    | "defaultInitialPercentage"
    | "defaultMombasaPercentage"
    | "defaultFinalPercentage"
  >
  canEdit: boolean
}

/**
 * Settings → Commerce & payments.
 *
 * The running total and the worked example are presentation, not
 * validation: the server's schema decides whether a split is acceptable. They
 * are here because "must add up to 100%" is a rule an operator should be able
 * to satisfy while typing, and because a percentage is much easier to check
 * as the dollar amount a customer will actually be asked for.
 */
export function CommerceSettingsForm({ settings, canEdit }: Props) {
  const { state, pending, dirty, markDirty, fieldError, formProps } = useSettingsForm(updateCommerceSettingsAction)

  const [values, setValues] = React.useState({
    defaultInitialPercentage: String(settings.defaultInitialPercentage),
    defaultMombasaPercentage: String(settings.defaultMombasaPercentage),
    defaultFinalPercentage: String(settings.defaultFinalPercentage),
  })

  const totalHundredths =
    toHundredths(values.defaultInitialPercentage) +
    toHundredths(values.defaultMombasaPercentage) +
    toHundredths(values.defaultFinalPercentage)
  const balances = totalHundredths === 10_000

  // The same planner orders use, so the example is exactly what an order
  // on this split would ask for — including where the rounding cent lands.
  const example = React.useMemo(() => {
    if (!balances) return null
    try {
      const templates = vehicleMilestoneTemplates({
        initial: toHundredths(values.defaultInitialPercentage) / 100,
        mombasa: toHundredths(values.defaultMombasaPercentage) / 100,
        final: toHundredths(values.defaultFinalPercentage) / 100,
      })
      return new Map(
        planMilestones(EXAMPLE_TOTAL, templates).map((milestone) => [milestone.triggerStatus ?? "INITIAL", milestone.amountDue])
      )
    } catch {
      return null
    }
  }, [balances, values])

  const exampleFor = (name: (typeof STAGES)[number]["name"]) => {
    const key = name === "defaultInitialPercentage" ? "INITIAL" : name === "defaultMombasaPercentage" ? "ARRIVED_AT_MOMBASA" : "READY_FOR_COLLECTION"
    return example?.get(key) ?? 0
  }

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <SettingsFormAlert state={state} />

      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-6">
        <SettingsPanel
          id="payment-schedule"
          title="Vehicle payment schedule"
          description="The share of the agreed vehicle price due at each stage. The three must total 100% — a vehicle is only released once it is paid in full."
        >
          {/*
            A list of rows rather than a table, so it holds on a phone without
            scrolling sideways: the stage and its trigger on the left, the
            percentage and what it comes to on the right.
          */}
          <ul className="flex min-w-0 flex-col divide-y divide-border rounded-lg border border-border">
            {STAGES.map((stage) => (
              <li key={stage.name} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <div className="flex min-w-0 flex-1 flex-col">
                  <label htmlFor={stage.name} className="text-small font-medium">
                    {stage.label}
                  </label>
                  <p className="text-xs text-muted-foreground">{stage.due}</p>
                  {example ? (
                    <p className="mt-0.5 text-xs font-medium tabular-nums sm:hidden">
                      {formatCurrency(exampleFor(stage.name))} on {formatCurrency(EXAMPLE_TOTAL)}
                    </p>
                  ) : null}
                </div>
                <div className="relative w-[5.5rem] shrink-0">
                  <Input
                    id={stage.name}
                    name={stage.name}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.01"
                    className="h-9 pr-7 tabular-nums"
                    value={values[stage.name]}
                    onChange={(event) => {
                      setValues((current) => ({ ...current, [stage.name]: event.target.value }))
                      markDirty()
                    }}
                    aria-invalid={fieldError(stage.name) ? true : undefined}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-small text-muted-foreground"
                  >
                    %
                  </span>
                </div>
                <span className="hidden w-20 shrink-0 text-right text-small font-medium tabular-nums sm:block">
                  {example ? formatCurrency(exampleFor(stage.name)) : "—"}
                </span>
              </li>
            ))}
            <li className="flex items-center gap-3 bg-muted/40 px-3 py-2.5 text-small font-semibold sm:px-4">
              <span className="flex-1">Total</span>
              <span
                aria-live="polite"
                className={cn("w-[5.5rem] shrink-0 pl-3 tabular-nums", balances ? "text-foreground" : "text-destructive")}
              >
                {(totalHundredths / 100).toFixed(2)}%
              </span>
              <span className="hidden w-20 shrink-0 text-right tabular-nums sm:block">
                {balances ? formatCurrency(EXAMPLE_TOTAL) : null}
              </span>
            </li>
          </ul>

          {!balances ? <p className="text-xs text-destructive">Must be 100%</p> : null}

          {fieldError("defaultInitialPercentage") ? (
            <p className="text-small text-destructive">{fieldError("defaultInitialPercentage")}</p>
          ) : null}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            <span>
              Amounts shown on a {formatCurrency(EXAMPLE_TOTAL)} vehicle. Applies to new orders only — existing orders
              keep the schedule they were confirmed with. Spare-parts orders are always paid in full before packing.
            </span>
          </p>
        </SettingsPanel>
      </fieldset>

      {canEdit ? <SettingsSaveBar state={state} pending={pending} dirty={dirty} /> : null}
    </form>
  )
}
