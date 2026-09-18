"use client"

import * as React from "react"
import { useActionState, useId } from "react"
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react"

import {
  addSparePartCompatibilityAction,
  removeSparePartCompatibilityAction,
  type FitmentFormState,
} from "@/lib/actions/spare-part-compatibility.actions"
import { AdminFormBadge, AdminFormSection } from "@/components/admin/admin-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { SparePartFitmentRow } from "@/lib/queries/spare-part.queries"

const INITIAL_STATE: FitmentFormState = { status: "idle" }

interface SparePartFitmentBoardProps {
  sparePartId: string
  fitment: SparePartFitmentRow[]
}

/**
 * What this part fits, as managed by the operator.
 *
 * ── Typed, never inferred ─────────────────────────────────────────────
 * Nothing here looks at the vehicle inventory. What a part fits is a fact
 * somebody at the dealership knows — off a parts catalogue, an auction sheet,
 * or the box it came in — and it is a fact about cars *in the world*, not
 * about what happens to be on the floor this week. A list derived from stock
 * would empty itself as cars were sold and would never cover the customer
 * whose own Harrier was never ours, which is nearly every parts customer.
 *
 * So every rule is entered by hand, and every field is optional.
 *
 * ── Every field empty is a real, useful rule ──────────────────────────
 * It means "fits any vehicle" — the honest listing for a universal
 * consumable, and the alternative to entering the same wiper blade once per
 * make and still missing whatever the customer drives. Each blank widens the
 * rule one level: no make means every make, no model means every model of
 * that make, an open year bound means unbounded in that direction.
 *
 * The one combination refused is a model without a make, which names nothing.
 *
 * ── Why fitment lives here and not in the details form ────────────────
 * A part has one price and many fitment rules. Folding a variable-length list
 * into that form would mean an operator could not add a rule without
 * re-submitting every other field, and a rejected price would take the
 * fitment down with it. These are added and removed one at a time, against a
 * part that already exists — which is also why the board only appears on a
 * saved part.
 */
export function SparePartFitmentBoard({
  sparePartId,
  fitment,
}: SparePartFitmentBoardProps) {
  const [state, formAction, isPending] = useActionState(
    addSparePartCompatibilityAction,
    INITIAL_STATE
  )

  /**
   * Clears the add form after a rule is accepted.
   *
   * Remounting rather than controlling six inputs: the fields are
   * uncontrolled so typing costs no re-render, and a `key` change is what
   * gives each one a fresh empty default. On a *rejected* submission it does
   * not change, so what the operator typed survives the error they are being
   * asked to fix.
   */
  const [formKey, setFormKey] = React.useState(0)
  const [lastState, setLastState] = React.useState(state)

  if (state !== lastState) {
    setLastState(state)
    if (state.status === "success") setFormKey((key) => key + 1)
  }

  const error = (name: string) => state.fieldErrors?.[name]?.[0]

  const makeId = useId()
  const modelId = useId()
  const yearFromId = useId()
  const yearToId = useId()
  const engineId = useId()
  const notesId = useId()

  return (
    <AdminFormSection
      id="fitment"
      title="Fits these vehicles"
      description="An empty field widens the rule: no model means every model of that make, no year means any year. Customers searching by their own car find the part through these."
      badge={
        <AdminFormBadge tone={fitment.length === 0 ? "warning" : "neutral"}>
          <span className="tabular-nums">{fitment.length}</span>
          {fitment.length === 1 ? "rule" : "rules"}
        </AdminFormBadge>
      }
      bodyClassName="flex flex-col gap-5"
    >

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

      {/* ── What is already listed ─────────────────────────────── */}
      {fitment.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {fitment.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-fast hover:bg-sunken/60"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-small font-medium text-foreground">
                  {rule.description}
                </span>
                {rule.notes ? (
                  <span className="text-xs text-muted-foreground">{rule.notes}</span>
                ) : null}
              </div>

              <RemoveFitmentButton id={rule.id} description={rule.description} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-sunken/50 px-4 py-6 text-center text-small text-muted-foreground">
          No fitment listed yet.
        </p>
      )}

      {/* ── Add one ────────────────────────────────────────────── */}
      <form
        action={formAction}
        className="flex flex-col gap-4 rounded-lg border border-border bg-sunken/60 p-4"
        noValidate
      >
        <input type="hidden" name="sparePartId" value={sparePartId} />

        <p className="text-small font-medium text-foreground">Add a vehicle</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <FitmentField
            id={makeId}
            label="Make"
            error={error("make")}
          >
            <Input
              key={formKey}
              id={makeId}
              name="make"
              defaultValue=""
              placeholder="Any"
              aria-invalid={error("make") ? true : undefined}
            />
          </FitmentField>

          <FitmentField
            id={modelId}
            label="Model"
            error={error("model")}
          >
            <Input
              key={formKey}
              id={modelId}
              name="model"
              defaultValue=""
              placeholder="All models"
              aria-invalid={error("model") ? true : undefined}
            />
          </FitmentField>

          <FitmentField
            id={yearFromId}
            label="From year"
            error={error("yearFrom")}
          >
            <Input
              key={formKey}
              id={yearFromId}
              name="yearFrom"
              type="number"
              inputMode="numeric"
              step={1}
              defaultValue=""
              placeholder="Any"
              aria-invalid={error("yearFrom") ? true : undefined}
            />
          </FitmentField>

          <FitmentField
            id={yearToId}
            label="To year"
            error={error("yearTo")}
          >
            <Input
              key={formKey}
              id={yearToId}
              name="yearTo"
              type="number"
              inputMode="numeric"
              step={1}
              defaultValue=""
              placeholder="Onwards"
              aria-invalid={error("yearTo") ? true : undefined}
            />
          </FitmentField>

          <FitmentField
            id={engineId}
            label="Engine"
            error={error("engine")}
          >
            <Input
              key={formKey}
              id={engineId}
              name="engine"
              defaultValue=""
              placeholder="Any"
              aria-invalid={error("engine") ? true : undefined}
            />
          </FitmentField>
        </div>

        <FitmentField
          id={notesId}
          label="Note"
          error={error("notes")}
        >
          <Input
            key={formKey}
            id={notesId}
            name="notes"
            defaultValue=""
            placeholder="Front axle only"
            aria-invalid={error("notes") ? true : undefined}
          />
        </FitmentField>

        <div>
          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                Adding
              </>
            ) : (
              <>
                <Plus aria-hidden="true" />
                Add fitment
              </>
            )}
          </Button>
        </div>
      </form>
    </AdminFormSection>
  )
}

/**
 * One removal, as its own form.
 *
 * A form rather than an `onClick` calling the action directly: it keeps the
 * row id in a submitted field where the server reads every other input from,
 * and it works without JavaScript. Each row has its own `useActionState` so a
 * failure on one row cannot clear another row's pending state.
 *
 * There is no confirmation dialog. A fitment rule is one line, it is
 * re-enterable in seconds, and it carries no money — a modal here would be
 * ceremony over a claim, not protection over a record. The destructive
 * confirmations in this dashboard are reserved for things that cannot be
 * retyped.
 */
function RemoveFitmentButton({
  id,
  description,
}: {
  id: string
  description: string
}) {
  const [, formAction, isPending] = useActionState(
    removeSparePartCompatibilityAction,
    INITIAL_STATE
  )

  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        aria-label={`Remove fitment: ${description}`}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md",
          "text-muted-foreground transition-colors duration-fast",
          "hover:bg-destructive/10 hover:text-destructive",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        {isPending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Trash2 aria-hidden="true" className="size-4" />
        )}
      </button>
    </form>
  )
}

/** A labelled cell in the add-fitment grid. Placeholders say what empty means. */
function FitmentField({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
