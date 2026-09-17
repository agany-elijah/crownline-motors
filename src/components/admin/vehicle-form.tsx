"use client"

import * as React from "react"
import { useActionState, useId, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import {
  createVehicleAction,
  updateVehicleAction,
  type VehicleFormState,
} from "@/lib/actions/vehicle.actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { VehiclePhotoStaging } from "@/components/admin/vehicle-photo-staging"
import { cn } from "@/lib/utils"
import {
  COUNTRY_OPTIONS,
  DRIVE_TYPE_OPTIONS,
  FUEL_TYPE_OPTIONS,
  TRANSMISSION_OPTIONS,
  VEHICLE_CONDITION_OPTIONS,
  VEHICLE_YEAR_MIN,
  vehicleYearMax,
} from "@/lib/constants/vehicle-options"
import type { VehicleDetail } from "@/lib/queries/vehicle.queries"
import { CustomerVisibilitySection } from "@/components/admin/visibility/customer-visibility-section"
import { echoedHiddenFields } from "@/components/admin/visibility/echoed-hidden-fields"
import {
  VEHICLE_INFO_COPY,
  VEHICLE_INFO_FIELDS,
  type VehicleInfoField,
  type Visibility,
} from "@/lib/visibility/product-visibility"

const INITIAL_STATE: VehicleFormState = { status: "idle" }

interface VehicleFormProps {
  /** Absent when creating. */
  vehicle?: VehicleDetail
  /** Settings → Catalogue display → Vehicles, so site-wide hidden facts show as locked. */
  siteWideVisibility: Visibility<VehicleInfoField>
}

/**
 * The vehicle details form, shared by create and edit.
 *
 * One component rather than two, because the fields are identical and the
 * only differences are the action, the defaults and the button label.
 * Duplicating seventeen fields would guarantee the two drift — a field
 * added to one and forgotten in the other is the classic version of that.
 *
 * Grouped into fieldsets that follow how a listing is actually compiled:
 * what the vehicle is, what it costs, its specification, what makes it
 * worth buying, and — when creating — what it looks like. An operator
 * entering a car from an auction sheet works down in roughly this order, and
 * a flat list of seventeen inputs is where data entry errors come from.
 *
 * ── Every default comes from `defaultOf`, and that is load-bearing ────
 * React resets a `<form action={fn}>` to its `defaultValue`s once the
 * action's transition settles — unconditionally, on success and on failure
 * alike. Before this, a rejected save wiped seventeen fields the operator
 * had just typed and left them looking at an empty form telling them to fill
 * it in. The action now echoes the submitted values back, and every field
 * below prefers them, so the reset restores exactly what was there.
 *
 * The consequence to remember when adding a field: read its default through
 * `defaultOf`, and add its name to VEHICLE_FORM_FIELDS in the action. A
 * field wired straight to `vehicle?.x` is a field that silently empties
 * itself on the next validation error.
 */
export function VehicleForm({ vehicle, siteWideVisibility }: VehicleFormProps) {
  const isEdit = Boolean(vehicle)

  const [state, formAction, isPending] = useActionState(
    isEdit ? updateVehicleAction : createVehicleAction,
    INITIAL_STATE
  )

  const error = (name: string) => state.fieldErrors?.[name]?.[0]

  /**
   * Bumped once per settled submission, and used as the `key` of every
   * control below.
   *
   * ── Why the defaults are re-mounted rather than re-assigned ──────────
   * The values echoed back by the action arrive as a *changed* `defaultValue`
   * on an already-mounted input. React honours that, but Base UI's
   * FieldControl keeps its own copy and says so:
   *
   *   "A component is changing the default value state of an uncontrolled
   *    FieldControl after being initialized."
   *
   * It is right to complain — a default that changes is a contradiction in
   * terms. Re-mounting the control instead means each instance is born with
   * the value it should hold and never has its default moved underneath it,
   * which is the same guarantee Base UI is asking for without making
   * seventeen fields controlled and re-rendering the whole form on every
   * keystroke.
   *
   * The key deliberately covers only the controls, not the form: the
   * photographs staged alongside a new vehicle live in component state and
   * must survive a rejected save, which a wider key would discard.
   */
  const [controlKey, setControlKey] = useState(0)
  const [lastState, setLastState] = useState(state)

  if (state !== lastState) {
    setLastState(state)
    setControlKey((key) => key + 1)
  }

  /**
   * What was submitted, then what is stored, then nothing.
   *
   * The submitted value wins even on a successful save: the reset happens
   * either way, and after a save the two agree.
   */
  const defaultOf = (
    name: string,
    stored: string | number | undefined | null
  ): string | number | undefined =>
    state.values?.[name] ?? stored ?? undefined

  /** Selects must land on a real option, never on an empty string. */
  const defaultOption = (name: string, stored: string | undefined, first: string) =>
    state.values?.[name] ?? stored ?? first

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      {vehicle ? (
        <>
          <input type="hidden" name="id" value={vehicle.id} />
          {/*
            The optimistic-concurrency token. Prefers the timestamp the last
            successful save returned, so two saves in a row do not conflict
            with each other while `revalidatePath` is still in flight; falls
            back to what the page was rendered with.
          */}
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={state.updatedAt ?? vehicle.updatedAt.toISOString()}
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

      <FormSection title="Identity">
        <Field label="Make" name="make" error={error("make")} className="sm:col-span-2"
          controlKey={controlKey}>
          {(control) => (
            <Input
              {...control}
              name="make"
              defaultValue={defaultOf("make", vehicle?.make)}
              placeholder="Toyota"
              required
              autoFocus={!isEdit}
            />
          )}
        </Field>

        <Field label="Model" name="model" error={error("model")} className="sm:col-span-2"
          controlKey={controlKey}>
          {(control) => (
            <Input
              {...control}
              name="model"
              defaultValue={defaultOf("model", vehicle?.model)}
              placeholder="Harrier"
              required
            />
          )}
        </Field>

        <Field label="Year" name="year" error={error("year")}
          controlKey={controlKey}>
          {(control) => (
            <Input
              {...control}
              name="year"
              type="number"
              inputMode="numeric"
              min={VEHICLE_YEAR_MIN}
              max={vehicleYearMax()}
              step={1}
              defaultValue={defaultOf("year", vehicle?.year)}
              placeholder="2021"
              required
            />
          )}
        </Field>

        <Field label="Condition" name="condition" error={error("condition")}
          controlKey={controlKey}>
          {(control) => (
            <NativeSelect
              {...control}
              name="condition"
              defaultValue={defaultOption(
                "condition",
                vehicle?.condition,
                // Falls back to Used rather than to the first option by
                // position: this is the honest default for an import, and
                // it must not silently become New if the option list is
                // ever reordered.
                "USED"
              )}
              options={VEHICLE_CONDITION_OPTIONS}
            />
          )}
        </Field>

        <Field
          label="Country of origin"
          name="countryOfOrigin"
          error={error("countryOfOrigin")}
          controlKey={controlKey}
        >
          {(control) => (
            <NativeSelect
              {...control}
              name="countryOfOrigin"
              defaultValue={defaultOption(
                "countryOfOrigin",
                vehicle?.countryOfOrigin,
                COUNTRY_OPTIONS[0].value
              )}
              options={COUNTRY_OPTIONS}
            />
          )}
        </Field>
      </FormSection>

      <FormSection title="Pricing">
        <Field label="Price (USD)" name="price" error={error("price")}
          controlKey={controlKey}>
          {(control) => (
            <Input
              {...control}
              name="price"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={defaultOf("price", vehicle?.price)}
              placeholder="22500"
              required
            />
          )}
        </Field>

        <Field
          label="Shipping estimate"
          name="shippingEstimate"
          error={error("shippingEstimate")}
          optional
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="shippingEstimate"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={defaultOf("shippingEstimate", vehicle?.shippingEstimate) ?? ""}
            />
          )}
        </Field>

        <Field
          label="Clearing estimate"
          name="clearingEstimate"
          error={error("clearingEstimate")}
          optional
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="clearingEstimate"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={defaultOf("clearingEstimate", vehicle?.clearingEstimate) ?? ""}
            />
          )}
        </Field>

        <Field
          label="Other charges"
          name="otherChargesEst"
          error={error("otherChargesEst")}
          optional
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="otherChargesEst"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={defaultOf("otherChargesEst", vehicle?.otherChargesEst) ?? ""}
            />
          )}
        </Field>
      </FormSection>

      <FormSection title="Specification">
        <Field label="Mileage (km)" name="mileageKm" error={error("mileageKm")}
          controlKey={controlKey}>
          {(control) => (
            <Input
              {...control}
              name="mileageKm"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              defaultValue={defaultOf("mileageKm", vehicle?.mileageKm)}
              placeholder="42000"
              required
            />
          )}
        </Field>

        <Field label="Engine size" name="engineSize" error={error("engineSize")}
          controlKey={controlKey}>
          {(control) => (
            <Input
              {...control}
              name="engineSize"
              defaultValue={defaultOf("engineSize", vehicle?.engineSize)}
              placeholder="2.0L"
              required
            />
          )}
        </Field>

        <Field label="Fuel type" name="fuelType" error={error("fuelType")}
          controlKey={controlKey}>
          {(control) => (
            <NativeSelect
              {...control}
              name="fuelType"
              defaultValue={defaultOption(
                "fuelType",
                vehicle?.fuelType,
                FUEL_TYPE_OPTIONS[0].value
              )}
              options={FUEL_TYPE_OPTIONS}
            />
          )}
        </Field>

        <Field label="Transmission" name="transmission" error={error("transmission")}
          controlKey={controlKey}>
          {(control) => (
            <NativeSelect
              {...control}
              name="transmission"
              defaultValue={defaultOption(
                "transmission",
                vehicle?.transmission,
                TRANSMISSION_OPTIONS[0].value
              )}
              options={TRANSMISSION_OPTIONS}
            />
          )}
        </Field>

        <Field label="Drive type" name="driveType" error={error("driveType")}
          controlKey={controlKey}>
          {(control) => (
            <NativeSelect
              {...control}
              name="driveType"
              defaultValue={defaultOption(
                "driveType",
                vehicle?.driveType,
                DRIVE_TYPE_OPTIONS[0].value
              )}
              options={DRIVE_TYPE_OPTIONS}
            />
          )}
        </Field>

        <Field
          label="Current location"
          name="currentLocation"
          error={error("currentLocation")}
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="currentLocation"
              defaultValue={defaultOf("currentLocation", vehicle?.currentLocation)}
              placeholder="Yokohama, Japan"
              required
            />
          )}
        </Field>

        <Field
          label="Exterior colour"
          name="exteriorColor"
          error={error("exteriorColor")}
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="exteriorColor"
              defaultValue={defaultOf("exteriorColor", vehicle?.exteriorColor)}
              placeholder="Black"
              required
            />
          )}
        </Field>

        <Field
          label="Interior colour"
          name="interiorColor"
          error={error("interiorColor")}
          controlKey={controlKey}
        >
          {(control) => (
            <Input
              {...control}
              name="interiorColor"
              defaultValue={defaultOf("interiorColor", vehicle?.interiorColor)}
              placeholder="Black"
              required
            />
          )}
        </Field>
      </FormSection>

      <FormSection
        title="Features"
        columns={1}
      >
        <Field
          label="Features"
          name="features"
          error={error("features")}
          optional
          controlKey={controlKey}
        >
          {(control) => (
            <Textarea
              {...control}
              name="features"
              rows={8}
              // Joined with newlines because that is exactly the format the
              // schema parses back — what the operator sees in this box is
              // what is stored, so an edit is never a re-transcription.
              defaultValue={defaultOf("features", vehicle?.features.join("\n"))}
              placeholder={"Sunroof\nLeather seats\nReverse camera\nCruise control"}
            />
          )}
        </Field>

      </FormSection>

      <FormSection title="Description" columns={1}>
        <Field label="Description" name="description" error={error("description")}
          controlKey={controlKey}>
          {(control) => (
            <Textarea
              {...control}
              name="description"
              rows={8}
              defaultValue={defaultOf("description", vehicle?.description)}
              placeholder="Well-maintained example with full service history. Minor scuff on the rear bumper, shown in the photographs."
              required
            />
          )}
        </Field>

        <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <input
            key={controlKey}
            type="checkbox"
            name="isFeatured"
            value="true"
            defaultChecked={
              state.values
                ? state.values.isFeatured === "true"
                : vehicle?.isFeatured
            }
            className="mt-0.5 size-4 accent-[var(--gold)]"
          />
          <span className="text-small font-semibold">Feature on the homepage</span>
        </label>
      </FormSection>

      <CustomerVisibilitySection
        key={`visibility-${controlKey}`}
        fields={VEHICLE_INFO_FIELDS}
        copy={VEHICLE_INFO_COPY}
        siteWide={siteWideVisibility}
        hidden={echoedHiddenFields(state.values?.hiddenFields) ?? vehicle?.hiddenFields ?? []}
        error={error("hiddenFields")}
        noun="vehicle"
      />

      {/*
        Photographs are part of this form only when creating.
        On an existing vehicle the gallery is its own section on the page,
        acting on photographs that already exist — uploading eight files is
        distinct work from correcting a mileage, and putting them behind one
        Save button means a failed upload can lose an unrelated edit.
      */}
      {isEdit ? null : <VehiclePhotoStaging disabled={isPending} />}

      {/*
        The action bar, pinned to the bottom of the viewport while any part of
        this form is on screen.

        A vehicle listing is seventeen fields plus a gallery — well over a
        screen on a laptop and several on a phone. With the button at the
        document's end, correcting one figure means scrolling past everything
        else to commit it, and an operator who does not find it assumes the
        form has no save. `sticky` keeps it in reach without taking it out of
        the form: it is still the form's last child, still submits natively,
        and it stops at the form's own end rather than floating over the
        gallery below.
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
              "Create vehicle"
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}

/* ── Layout helpers ─────────────────────────────────────────── */

function FormSection({
  title,
  columns = 2,
  children,
}: {
  title: string
  columns?: 1 | 2
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <h2 className="font-heading text-h3 font-semibold">{title}</h2>

      <div
        className={cn(
          "grid gap-4",
          columns === 2 ? "sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1"
        )}
      >
        {children}
      </div>
    </section>
  )
}

/**
 * The attributes a field's control must carry for its error to be announced.
 *
 * Passed to the render prop and spread onto the input, rather than being set
 * on a wrapping element. That distinction is the whole point: `aria-invalid`
 * and `aria-describedby` are only meaningful on the form control itself.
 * On a `<div>` around it they do nothing at all — the message renders
 * visually and a screen reader user tabbing into the field hears the label
 * and no indication that anything is wrong with it, across all seventeen
 * fields on this form.
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
 * the label, the control and its error message are always associated
 * without each field having to mint and wire an id by hand — the kind of
 * repetition where one gets missed and a screen reader announces an
 * unlabelled input.
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
  /** Changes when the form's defaults change, re-mounting the control. See
   *  the note on `controlKey` in VehicleForm. */
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
        // Reserves the error line so the grid does not jump when a message
        // appears — a form that reflows as you fix it is disorienting.
        <span aria-hidden="true" className="sr-only" data-field={name} />
      )}
    </div>
  )
}

/**
 * A native `<select>`.
 *
 * Chosen over the project's Base UI Select for this form specifically. These
 * are short, familiar option lists — five fuel types, three transmissions —
 * where the native control is faster to operate, works before JavaScript
 * loads, and on a phone opens the platform's own picker, which is the one
 * an operator entering vehicles on-site already knows. The styled Select is
 * the right choice where a listbox needs search or rich option content;
 * neither applies here.
 */
function NativeSelect({
  name,
  defaultValue,
  options,
  ...control
}: FieldControlProps & {
  name: string
  defaultValue: string
  options: ReadonlyArray<{ value: string; label: string }>
}) {
  return (
    <select
      {...control}
      name={name}
      defaultValue={defaultValue}
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
