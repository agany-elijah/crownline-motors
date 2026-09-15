"use client"

import * as React from "react"
import { useActionState, useId, useState } from "react"
import { AlertCircle, CheckCircle2, Globe, Loader2, Lock } from "lucide-react"

import { SparePartPhotoStaging } from "@/components/admin/spare-part-photo-staging"
import {
  createSparePartAction,
  updateSparePartAction,
  type SparePartFormState,
} from "@/lib/actions/spare-part.actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { COUNTRY_OPTIONS } from "@/lib/constants/vehicle-options"
import {
  SPARE_PART_AVAILABILITY_OPTIONS,
  SPARE_PART_CONDITION_OPTIONS,
  SPARE_PART_STOCK_MAX,
} from "@/lib/constants/spare-part-options"
import type {
  SparePartCategoryOption,
  SparePartDetail,
} from "@/lib/queries/spare-part.queries"

const INITIAL_STATE: SparePartFormState = { status: "idle" }

interface SparePartFormProps {
  /** Absent when creating. */
  part?: SparePartDetail
  /** Categories this form may offer. See `listCategoryOptions`. */
  categories: SparePartCategoryOption[]
}

/**
 * The spare-part details form, shared by create and edit.
 *
 * One component rather than two, because the fields are identical and the
 * only differences are the action, the defaults and the button label.
 * Duplicating fourteen fields would guarantee the two drift.
 *
 * ── Grouped by who sees it, not by what kind of field it is ──────────
 * One section for everything that appears on the public listing, one for
 * everything that does not. That split is the question an operator actually
 * has while typing — "will a customer read this?" — and answering it in the
 * layout is what stops useful internal notes being left out for fear they
 * are public, or supplier terms being typed into a box that is.
 *
 * There is no pricing-mode control: leaving the price empty is what makes a
 * part "Price on enquiry". See `derivePricingMode`.
 *
 * ── Every default comes from `defaultOf`, and that is load-bearing ────
 * React resets a `<form action={fn}>` to its `defaultValue`s once the
 * action's transition settles — on success and on failure alike. The action
 * echoes the submitted values back and every field below prefers them, so
 * the reset restores exactly what was there rather than emptying the form
 * under an operator who has just been told to fix one field.
 *
 * The consequence when adding a field: read its default through `defaultOf`,
 * and add its name to SPARE_PART_FORM_FIELDS in the action.
 */
export function SparePartForm({ part, categories }: SparePartFormProps) {
  const isEdit = Boolean(part)

  const [state, formAction, isPending] = useActionState(
    isEdit ? updateSparePartAction : createSparePartAction,
    INITIAL_STATE
  )

  const error = (name: string) => state.fieldErrors?.[name]?.[0]

  /**
   * Bumped once per settled submission, and used as the `key` of every
   * control below.
   *
   * The values echoed back by the action arrive as a *changed* `defaultValue`
   * on an already-mounted input, which Base UI's FieldControl rightly
   * complains about — a default that changes is a contradiction in terms.
   * Re-mounting the control means each instance is born with the value it
   * should hold, without making fourteen fields controlled and re-rendering
   * the form on every keystroke.
   */
  const [controlKey, setControlKey] = useState(0)
  const [lastState, setLastState] = useState(state)

  if (state !== lastState) {
    setLastState(state)
    setControlKey((key) => key + 1)
  }

  /** What was submitted, then what is stored, then nothing. */
  const defaultOf = (
    name: string,
    stored: string | number | undefined | null
  ): string | number | undefined => state.values?.[name] ?? stored ?? undefined

  /** Selects must land on a real option, never on an empty string. */
  const defaultOption = (name: string, stored: string | undefined, first: string) =>
    state.values?.[name] ?? stored ?? first

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      {part ? (
        <>
          <input type="hidden" name="id" value={part.id} />
          {/*
            The optimistic-concurrency token. Prefers the timestamp the last
            successful save returned, so two saves in a row do not conflict
            with each other while `revalidatePath` is still in flight; falls
            back to what the page was rendered with.
          */}
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={state.updatedAt ?? part.updatedAt.toISOString()}
          />
        </>
      ) : null}

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

      {/* ── Shown on the website ──────────────────────────────── */}
      <FormSection title="Part details" visibility="public">
        <Field
          label="Part name"
          name="name"
          error={error("name")}
          className="sm:col-span-2"
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="name"
              defaultValue={defaultOf("name", part?.name)}
              placeholder="Toyota Harrier front brake pads"
              required
              autoFocus={!isEdit}
            />
          )}
        </Field>

        <Field
          label="Category"
          name="categoryId"
          error={error("categoryId")}
          controlKey={controlKey}
        >
          {(control) => (
            <NativeSelect
              {...control}
              name="categoryId"
              defaultValue={defaultOption(
                "categoryId",
                part?.categoryId,
                categories[0]?.id ?? ""
              )}
              options={categories.map((category) => ({
                value: category.id,
                // A retired category is only ever in this list because the
                // part is already filed under it.
                label: category.isActive
                  ? category.name
                  : `${category.name} (retired)`,
              }))}
            />
          )}
        </Field>

        <Field
          label="Manufacturer part number"
          name="oemPartNumber"
          error={error("oemPartNumber")}
          optional
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="oemPartNumber"
              defaultValue={defaultOf("oemPartNumber", part?.oemPartNumber) ?? ""}
              placeholder="04465-33471"
            />
          )}
        </Field>

        <Field
          label="Brand"
          name="brand"
          error={error("brand")}
          optional
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="brand"
              defaultValue={defaultOf("brand", part?.brand) ?? ""}
              placeholder="Genuine Toyota"
            />
          )}
        </Field>

        <Field
          label="Price (USD)"
          name="price"
          error={error("price")}
          optional
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="price"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={defaultOf("price", part?.price) ?? ""}
              placeholder="Price on enquiry"
            />
          )}
        </Field>

        <Field
          label="Availability"
          name="availability"
          error={error("availability")}
          controlKey={controlKey}
        >
          {(control) => (
            <NativeSelect
              {...control}
              name="availability"
              // Falls back to "Available to order" rather than to the first
              // option by position, matching the column default: the state
              // that reaches a customer when nobody has decided must be the
              // modest one. A wrong "in stock" costs them a journey.
              defaultValue={defaultOption(
                "availability",
                part?.availability,
                "ON_ORDER"
              )}
              options={SPARE_PART_AVAILABILITY_OPTIONS}
            />
          )}
        </Field>

        <Field
          label="Description"
          name="description"
          error={error("description")}
          className="sm:col-span-2 lg:col-span-4"
          controlKey={controlKey}
        >
          {(control) => (
            <Textarea
              {...control}
              name="description"
              rows={6}
              defaultValue={defaultOf("description", part?.description)}
              placeholder="Genuine Toyota front brake pads, removed from a low-mileage import and unused. Fits the 2020–2023 Harrier with the 2.0L engine."
              required
            />
          )}
        </Field>

        <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 sm:col-span-2 lg:col-span-4">
          <input
            key={controlKey}
            type="checkbox"
            name="isFeatured"
            value="true"
            defaultChecked={
              state.values ? state.values.isFeatured === "true" : part?.isFeatured
            }
            className="mt-0.5 size-4 accent-[var(--gold)]"
          />
          <span className="text-small font-semibold">Feature in the catalogue</span>
        </label>
      </FormSection>

      {/* ── Never shown to customers ──────────────────────────── */}
      <FormSection title="Internal" visibility="internal">
        <Field
          label="Condition"
          name="condition"
          error={error("condition")}
          controlKey={controlKey}
        >
          {(control) => (
            <NativeSelect
              {...control}
              name="condition"
              // Falls back to Used rather than to the first option by
              // position: that is the honest default for an import, and it
              // must not silently become New if the list is ever reordered.
              defaultValue={defaultOption("condition", part?.condition, "USED")}
              options={SPARE_PART_CONDITION_OPTIONS}
            />
          )}
        </Field>

        <Field
          label="Country of origin"
          name="countryOfOrigin"
          error={error("countryOfOrigin")}
          optional
          controlKey={controlKey}
        >
          {(control) => (
            <NativeSelect
              {...control}
              name="countryOfOrigin"
              defaultValue={defaultOption(
                "countryOfOrigin",
                part?.countryOfOrigin ?? undefined,
                ""
              )}
              options={[{ value: "", label: "Not specified" }, ...COUNTRY_OPTIONS]}
            />
          )}
        </Field>

        <Field
          label="Stock quantity"
          name="stockQuantity"
          error={error("stockQuantity")}
          optional
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="stockQuantity"
              type="number"
              inputMode="numeric"
              min={0}
              max={SPARE_PART_STOCK_MAX}
              step={1}
              defaultValue={defaultOf("stockQuantity", part?.stockQuantity) ?? ""}
              placeholder="0"
            />
          )}
        </Field>

        <Field
          label="Supplier"
          name="supplierName"
          error={error("supplierName")}
          optional
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="supplierName"
              defaultValue={defaultOf("supplierName", part?.supplierName) ?? ""}
              placeholder="Nagoya Auto Parts"
            />
          )}
        </Field>

        <Field
          label="Sourcing notes"
          name="supplierNotes"
          error={error("supplierNotes")}
          optional
          className="sm:col-span-2 lg:col-span-4"
          controlKey={controlKey}
        >
          {(control) => (
            <Textarea
              {...control}
              name="supplierNotes"
              rows={3}
              defaultValue={defaultOf("supplierNotes", part?.supplierNotes) ?? ""}
              placeholder="Cost 42 USD landed. Three-week lead time. Ask for Kenji."
            />
          )}
        </Field>
      </FormSection>

      {/*
        Photographs, and only when creating.

        On an existing part the gallery is a live thing — uploads, deletions
        and a change of cover image each take effect on their own, against a
        part id that exists — so it belongs to the part's own page rather than
        inside a form whose Save button implies nothing happens until pressed.
        Here there is no id yet, so the files are staged in the browser and
        travel with the details.
      */}
      {isEdit ? null : <SparePartPhotoStaging disabled={isPending} />}

      {/*
        The action bar, pinned to the bottom of the viewport while any part of
        this form is on screen. With the button at the document's end,
        correcting one figure means scrolling past everything else to commit
        it, and an operator who does not find it assumes the form has no save.
      */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-2 border-t border-border bg-card/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                Saving
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create part"
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}

/* ── Layout helpers ─────────────────────────────────────────── */

/**
 * How much of this section a customer will ever see.
 *
 * Stated as a chip on the heading rather than as a paragraph under it. An
 * operator reads a form by scanning its headings; a sentence they have to
 * read to learn that the box below is internal is a sentence they will stop
 * reading by the third listing.
 */
type SectionVisibility = "public" | "internal"

const VISIBILITY_LABEL: Record<SectionVisibility, string> = {
  public: "Shown on the website",
  internal: "Admin only — never shown on the website",
}

function FormSection({
  title,
  visibility,
  children,
}: {
  title: string
  visibility: SectionVisibility
  children: React.ReactNode
}) {
  const internal = visibility === "internal"

  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-xl border p-6",
        internal ? "border-dashed border-border bg-secondary/40" : "border-border bg-card"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h2 className="font-heading text-h3 font-semibold">{title}</h2>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5",
            "text-xs font-semibold",
            internal
              ? "bg-muted text-muted-foreground"
              : "bg-accent text-gold-ink"
          )}
        >
          {internal ? (
            <Lock aria-hidden="true" className="size-3" />
          ) : (
            <Globe aria-hidden="true" className="size-3" />
          )}
          {VISIBILITY_LABEL[visibility]}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  )
}

/**
 * The attributes a field's control must carry for its error to be announced.
 *
 * Passed to the render prop and spread onto the input, rather than set on a
 * wrapping element. That distinction is the whole point: `aria-invalid` and
 * `aria-describedby` are only meaningful on the form control itself. On a
 * `<div>` around it they do nothing at all, and a screen reader user tabbing
 * into the field hears the label with no indication anything is wrong.
 */
interface FieldControlProps {
  id: string
  "aria-invalid": true | undefined
  "aria-describedby": string | undefined
}

/**
 * A labelled field.
 *
 * `children` is a render prop taking the props its control must carry, so
 * the label, the control and its error message are always associated without
 * each field having to mint and wire an id by hand.
 */
function Field({
  label,
  name,
  error,
  optional,
  className,
  controlKey,
  children,
}: {
  label: string
  name: string
  error?: string
  optional?: boolean
  className?: string
  /** Changes when the form's defaults change, re-mounting the control. */
  controlKey?: number
  children: (control: FieldControlProps) => React.ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`

  const control: FieldControlProps = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="justify-between">
        <span>{label}</span>
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">Optional</span>
        ) : null}
      </Label>

      <div key={controlKey}>{children(control)}</div>

      {error ? (
        <p id={errorId} className="text-small text-destructive">
          {error}
        </p>
      ) : (
        <span aria-hidden="true" className="sr-only" data-field={name} />
      )}
    </div>
  )
}

/**
 * A native `<select>`.
 *
 * Chosen over the project's Base UI Select for this form specifically, for
 * the same reason the vehicle form makes that choice: these are short,
 * familiar option lists where the native control is faster to operate, works
 * before JavaScript loads, and on a phone opens the platform's own picker.
 */
function NativeSelect({
  name,
  defaultValue,
  options,
  onChange,
  ...control
}: FieldControlProps & {
  name: string
  defaultValue: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
}) {
  return (
    <select
      {...control}
      name={name}
      defaultValue={defaultValue}
      onChange={onChange}
      className={cn(
        "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground",
        "transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "md:text-sm"
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
