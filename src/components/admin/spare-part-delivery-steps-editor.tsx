"use client"

import * as React from "react"
import { GripVertical, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  DEFAULT_SPARE_PART_DELIVERY_STEPS,
  MAX_SPARE_PART_DELIVERY_STEPS,
  SPARE_PART_DELIVERY_STEP_DESCRIPTION_MAX,
  SPARE_PART_DELIVERY_STEP_TITLE_MAX,
  type SparePartDeliveryStep,
} from "@/lib/constants/spare-part-delivery"

/**
 * The "How your part reaches you" steps, as edited in Settings.
 *
 * These are the four or five sentences shown on every spare-part page
 * explaining what happens between an enquiry and a box in Juba. They are
 * configuration rather than code because the business will change how it
 * words this long before it changes how it works, and a copy change should
 * not be a deploy.
 *
 * ── Why the rows are submitted as one JSON string ─────────────────────
 * A list of pairs cannot survive `FormData` as repeated fields. Removing the
 * middle row leaves two flat lists — titles and descriptions — that have to
 * be re-paired by position, and any mismatch silently attaches one step's
 * sentence to another step's heading. One hidden field holding the whole
 * array keeps each row intact through the request.
 *
 * The server does not trust that string: `businessSettingsSchema` parses it
 * and validates every row (see the note there). This component's own limits
 * — the maximum number of steps, the field lengths — are conveniences that
 * stop an operator writing something the server will reject, not the rule
 * itself.
 *
 * ── Ordering ──────────────────────────────────────────────────────────
 * Array order *is* step order, and the arrows move a row within it. Drag and
 * drop was considered and refused: it needs a pointer, so it fails the
 * operator on a tablet, and a reorder that only works with a mouse is a
 * feature that is missing exactly when someone is standing in the warehouse.
 * The grip glyph is decorative — the arrows are the control.
 */
interface SparePartDeliveryStepsEditorProps {
  /**
   * What is stored, or null when the operator has never configured this.
   *
   * The two are genuinely different and the editor says so: null opens
   * showing the built-in steps with a note that they are the fallback, so
   * saving adopts them rather than leaving the page silently dependent on a
   * constant in the codebase.
   */
  steps: SparePartDeliveryStep[] | null
  /** Rendered under the field when the server rejected the list. */
  error?: string
}

/**
 * A row, with a key that survives its neighbours being removed.
 *
 * Keying by array index breaks the moment a row is removed from the middle:
 * React reuses the DOM node, and the focus and selection inside it stay with
 * the *position* rather than with the step. So each row carries a key that
 * lives exactly as long as it does.
 *
 * ── The key is never rendered, and that is the point ──────────────────
 * An earlier version of this used a module-level counter and put the key into
 * `htmlFor`/`id`. That is a hydration bug: the module is evaluated once on
 * the server, which numbers the initial rows 1–4, and again in the browser,
 * which numbers them 5–8. React cannot patch mismatched attributes, so every
 * label was left pointing at an element id that did not exist — the control
 * association silently gone, on a form, for exactly the users who depend on
 * it most.
 *
 * The two concerns are therefore kept apart:
 *
 *   `key`   — reconciliation only. Never reaches the DOM, so it is free to be
 *             allocated from a counter.
 *   the ids — derived from `useId()` and the row's current index, both of
 *             which are identical on the server and in the browser.
 */
interface StepRow extends SparePartDeliveryStep {
  key: string
}

export function SparePartDeliveryStepsEditor({
  steps,
  error,
}: SparePartDeliveryStepsEditorProps) {
  /** True while the page is showing the built-in steps rather than stored ones. */
  const isUsingDefaults = steps === null

  /**
   * Prefix for every field id on this form.
   *
   * `useId` is stable across the server render and hydration by design, which
   * is the whole reason the ids are built from it rather than from the row
   * counter below.
   */
  const baseId = React.useId()

  const [rows, setRows] = React.useState<StepRow[]>(() =>
    (steps ?? DEFAULT_SPARE_PART_DELIVERY_STEPS).map((step, index) => ({
      ...step,
      // Deterministic for the rows that exist at mount, so the server and the
      // browser agree on the reconciliation keys too.
      key: `row-${index}`,
    }))
  )

  /**
   * Where keys for rows added later come from.
   *
   * A ref rather than state: bumping it must not itself cause a render, and
   * nothing reads it during one. It starts past the initial rows, and it only
   * ever advances in an event handler — which runs in the browser, so it
   * cannot diverge from anything the server produced.
   */
  const nextKey = React.useRef(rows.length)

  function newRow(): StepRow {
    const key = `row-${nextKey.current}`
    nextKey.current += 1

    return { title: "", description: "", key }
  }

  const atCeiling = rows.length >= MAX_SPARE_PART_DELIVERY_STEPS

  function update(index: number, patch: Partial<SparePartDeliveryStep>) {
    setRows((current) =>
      current.map((row, position) =>
        position === index ? { ...row, ...patch } : row
      )
    )
  }

  function move(index: number, direction: -1 | 1) {
    setRows((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current

      const next = [...current]
      // Destructured swap rather than a splice pair: one expression, and it
      // cannot leave the array short if the second call is ever removed.
      ;[next[index], next[target]] = [next[target], next[index]]

      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/*
        The value the server actually reads. Serialised without the row keys,
        which are a rendering concern and would fail the schema's strict
        object shape.
      */}
      <input
        type="hidden"
        name="sparePartDeliverySteps"
        value={JSON.stringify(
          rows.map(({ title, description }) => ({ title, description }))
        )}
      />

      {isUsingDefaults ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-3 text-small text-muted-foreground">
          These are the built-in steps, shown until you save your own. Edit them
          to match how the business actually works — saving stores them, and
          every spare-part page updates immediately.
        </p>
      ) : null}

      <ol className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="flex gap-3 rounded-lg border border-border bg-background p-4"
          >
            {/* The step's number as the customer will see it, so the operator
                is editing the thing rather than a form row that happens to
                produce it. */}
            <div className="flex shrink-0 flex-col items-center gap-1.5 pt-1">
              <span
                aria-hidden="true"
                className="tabular flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background"
              >
                {index + 1}
              </span>
              <GripVertical
                aria-hidden="true"
                className="size-3.5 text-muted-foreground/50"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${baseId}-${index}-title`}>Step title</Label>
                <Input
                  id={`${baseId}-${index}-title`}
                  value={row.title}
                  maxLength={SPARE_PART_DELIVERY_STEP_TITLE_MAX}
                  placeholder="We confirm and quote"
                  onChange={(event) => update(index, { title: event.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${baseId}-${index}-description`}>What happens</Label>
                <Textarea
                  id={`${baseId}-${index}-description`}
                  rows={2}
                  value={row.description}
                  maxLength={SPARE_PART_DELIVERY_STEP_DESCRIPTION_MAX}
                  placeholder="One sentence. What we do, and what the customer needs to do."
                  onChange={(event) =>
                    update(index, { description: event.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground tabular">
                  {row.description.length}/
                  {SPARE_PART_DELIVERY_STEP_DESCRIPTION_MAX}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-1">
              <RowButton
                label={`Move step ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </RowButton>
              <RowButton
                label={`Move step ${index + 1} down`}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </RowButton>
              <RowButton
                label={`Remove step ${index + 1}`}
                onClick={() =>
                  setRows((current) =>
                    current.filter((_, position) => position !== index)
                  )
                }
                tone="destructive"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </RowButton>
            </div>
          </li>
        ))}
      </ol>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-small text-muted-foreground">
          No steps. Saving with the list empty hides the &ldquo;How your part
          reaches you&rdquo; section from every spare-part page.
        </p>
      ) : null}

      {error ? <p className="text-small text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={atCeiling}
          onClick={() => setRows((current) => [...current, newRow()])}
        >
          <Plus aria-hidden="true" />
          Add step
        </Button>

        <p className="text-small text-muted-foreground">
          {atCeiling
            ? `${MAX_SPARE_PART_DELIVERY_STEPS} steps is the maximum — a longer list stops being read.`
            : `${rows.length} of ${MAX_SPARE_PART_DELIVERY_STEPS} steps.`}
        </p>
      </div>
    </div>
  )
}

/**
 * A small square control on a row.
 *
 * `type="button"` on every one of them, and that is load-bearing: the default
 * type inside a form is `submit`, so an operator reordering a step would save
 * the entire settings form instead.
 */
function RowButton({
  label,
  onClick,
  disabled,
  tone = "default",
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: "default" | "destructive"
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border border-border",
        "text-small text-muted-foreground",
        "transition-colors duration-fast",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        tone === "destructive"
          ? "hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
          : "hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
