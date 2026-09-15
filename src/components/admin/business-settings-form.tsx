"use client"

import { useActionState, useId, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { SparePartDeliveryStepsEditor } from "@/components/admin/spare-part-delivery-steps-editor"
import {
  updateBusinessSettingsAction,
  type SettingsFormState,
} from "@/lib/actions/settings.actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { BusinessSettingsDTO } from "@/lib/queries/settings.queries"

const INITIAL_STATE: SettingsFormState = { status: "idle" }

interface BusinessSettingsFormProps {
  settings: BusinessSettingsDTO
}

/** Formats a running total the same way the server will read it. */
function toHundredths(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export function BusinessSettingsForm({ settings }: BusinessSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateBusinessSettingsAction,
    INITIAL_STATE
  )

  /**
   * Local copies of the three percentages, purely to show a running total.
   *
   * This is presentation, not validation — the server's Zod schema is what
   * decides whether a split is acceptable, and it re-checks regardless of
   * what this component believes. The total is here because "must add up to
   * 100%" is a rule an operator should be able to satisfy while typing,
   * rather than discovering after a failed save.
   */
  const [initial, setInitial] = useState(String(settings.defaultInitialPercentage))
  const [mombasa, setMombasa] = useState(String(settings.defaultMombasaPercentage))
  const [final, setFinal] = useState(String(settings.defaultFinalPercentage))

  const totalHundredths =
    toHundredths(initial) + toHundredths(mombasa) + toHundredths(final)
  const balances = totalHundredths === 10_000

  const whatsappId = useId()
  const initialId = useId()
  const mombasaId = useId()
  const finalId = useId()

  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0]

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      {state.status === "success" ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" className="text-gold-ink" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {/* ── Contact ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-heading text-h3 font-semibold">Customer contact</h2>

        <div className="flex max-w-md flex-col gap-2">
          <Label htmlFor={whatsappId}>WhatsApp number</Label>
          <Input
            id={whatsappId}
            name="whatsappNumber"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="+211900000000"
            defaultValue={settings.whatsappNumber}
            aria-invalid={fieldError("whatsappNumber") ? true : undefined}
            aria-describedby={`${whatsappId}-hint`}
          />
          <p id={`${whatsappId}-hint`} className="text-small text-muted-foreground">
            Leave empty to hide WhatsApp buttons sitewide.
          </p>
          {fieldError("whatsappNumber") ? (
            <p className="text-small text-destructive">
              {fieldError("whatsappNumber")}
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Payment structure ───────────────────────────────── */}
      <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-h3 font-semibold">Payment stages</h2>
          <p className="text-small text-muted-foreground">
            Applies to new orders only — existing orders keep their original split.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              id: initialId,
              name: "defaultInitialPercentage",
              label: "Initial payment",
              hint: "On order confirmation, before procurement",
              value: initial,
              onChange: setInitial,
            },
            {
              id: mombasaId,
              name: "defaultMombasaPercentage",
              label: "Mombasa payment",
              hint: "On arrival at Mombasa",
              value: mombasa,
              onChange: setMombasa,
            },
            {
              id: finalId,
              name: "defaultFinalPercentage",
              label: "Final payment",
              hint: "Before release to the customer",
              value: final,
              onChange: setFinal,
            },
          ].map((field) => (
            <div key={field.name} className="flex flex-col gap-2">
              <Label htmlFor={field.id}>{field.label}</Label>
              <div className="relative">
                <Input
                  id={field.id}
                  name={field.name}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.01"
                  required
                  className="pr-8"
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  aria-invalid={fieldError(field.name) ? true : undefined}
                  aria-describedby={`${field.id}-hint`}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-small text-muted-foreground"
                >
                  %
                </span>
              </div>
              <p id={`${field.id}-hint`} className="text-small text-muted-foreground">
                {field.hint}
              </p>
              {fieldError(field.name) ? (
                <p className="text-small text-destructive">{fieldError(field.name)}</p>
              ) : null}
            </div>
          ))}
        </div>

        {/*
          Live total. `aria-live="polite"` so a screen-reader user hears the
          running figure change as they type, rather than only discovering
          the imbalance when the save is rejected.
        */}
        <div
          aria-live="polite"
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-small",
            balances
              ? "border-border bg-secondary/50 text-muted-foreground"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          )}
        >
          <span>Total across the three stages</span>
          <span className="font-semibold tabular-nums">
            {(totalHundredths / 100).toFixed(2)}%
            {balances ? "" : " — must be 100%"}
          </span>
        </div>
      </section>

      {/* ── How a spare part reaches the customer ───────────── */}
      <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-h3 font-semibold">
            How a spare part reaches the customer
          </h2>
          <p className="text-small text-muted-foreground">Shown on every spare-part page.</p>
        </div>

        <SparePartDeliveryStepsEditor
          steps={settings.sparePartDeliverySteps}
          error={fieldError("sparePartDeliverySteps")}
        />
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 aria-hidden="true" className="animate-spin" />
              Saving
            </>
          ) : (
            "Save settings"
          )}
        </Button>
        {/*
          Not disabled when the total is wrong. A disabled submit with no
          explanation is the most common way a form becomes unusable — the
          running total above already says what is wrong, and the server
          gives a precise message if they submit anyway.
        */}
      </div>
    </form>
  )
}
