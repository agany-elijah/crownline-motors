"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { SettingsFormState } from "@/lib/actions/settings.actions"
import { cn } from "@/lib/utils"

const IDLE: SettingsFormState = { status: "idle" }

/**
 * The state every settings form shares: the action's result, whether it is
 * saving, and whether anything has been edited since the last save.
 *
 * ── Why the form is submitted by hand ─────────────────────────────────
 * Passing an action to `<form action>` makes React reset every uncontrolled
 * field once the action settles — on a validation error as much as on
 * success — so an operator who mistyped one email address would lose the
 * rest of the page's edits too. Dispatching from `onSubmit` inside a
 * transition keeps the same pending state and the same server action without
 * the reset. The server stays the only judge of what is valid.
 */
export function useSettingsForm(
  action: (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>
) {
  const [state, dispatch, pending] = React.useActionState(action, IDLE)
  const [dirty, setDirty] = React.useState(false)
  const [settled, setSettled] = React.useState(state)

  // A successful save clears the "unsaved changes" marker. Adjusted during
  // render rather than in an effect, so there is no frame in which the bar
  // says "unsaved" beside a "saved" message.
  if (state !== settled) {
    setSettled(state)
    if (state.status === "success") setDirty(false)
  }

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const formData = new FormData(event.currentTarget)
      React.startTransition(() => dispatch(formData))
    },
    [dispatch]
  )

  const markDirty = React.useCallback(() => setDirty(true), [])

  const fieldError = React.useCallback((name: string) => state.fieldErrors?.[name]?.[0], [state.fieldErrors])

  return {
    state,
    pending,
    dirty,
    markDirty,
    fieldError,
    formProps: { onSubmit, onChange: markDirty, noValidate: true } as const,
  }
}

/** The result of the last save, above the form. Announced politely. */
export function SettingsFormAlert({ state }: { state: SettingsFormState }) {
  if (state.status !== "error" || !state.message) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-small text-destructive"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{state.message}</span>
    </div>
  )
}

/**
 * The save bar, pinned to the bottom of the viewport while the form is in view.
 *
 * Sticky rather than a button at the end of a long page, because the Business
 * Information form is taller than a phone screen and an operator who edited
 * the first field should not have to scroll past thirty others to save it.
 */
export function SettingsSaveBar({
  state,
  pending,
  dirty,
  label = "Save changes",
  extra,
  inline = false,
}: {
  state: SettingsFormState
  pending: boolean
  dirty: boolean
  label?: string
  extra?: React.ReactNode
  /** Inside a panel: no pinning and no page-edge bleed, just a footer row. */
  inline?: boolean
}) {
  const saved = state.status === "success" && !dirty

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        inline
          ? "border-t border-border pt-4"
          : cn(
              "sticky bottom-0 z-20 -mx-4 mt-2 border-t border-border px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
              "bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75",
              "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            )
      )}
    >
      <p aria-live="polite" className="flex min-h-5 items-center gap-1.5 text-small text-muted-foreground">
        {pending ? (
          "Saving…"
        ) : dirty ? (
          <>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
            Unsaved changes
          </>
        ) : saved ? (
          <>
            <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
            {state.message}
          </>
        ) : null}
      </p>

      <div className="flex items-center gap-2">
        {extra}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {pending ? "Saving" : label}
        </Button>
      </div>
    </div>
  )
}

/**
 * A labelled switch with a description, as a row.
 *
 * The whole row is the label, so the target is the width of the panel rather
 * than a 36px track — which on a phone is the difference between a setting
 * you can change and one you fight with.
 */
export function SettingsSwitchRow({
  name,
  label,
  description,
  defaultChecked,
  checked,
  onCheckedChange,
  disabled,
  disabledReason,
  className,
}: {
  name?: string
  label: React.ReactNode
  description?: React.ReactNode
  defaultChecked?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  disabledReason?: React.ReactNode
  className?: string
}) {
  const id = React.useId()

  return (
    <div className={cn("flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0", className)}>
      <label htmlFor={id} className={cn("flex min-w-0 flex-col gap-0.5", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <span className="text-small font-medium text-foreground">{label}</span>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
        {disabled && disabledReason ? <span className="text-xs text-muted-foreground">{disabledReason}</span> : null}
      </label>
      <Switch
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
    </div>
  )
}

/** A divided list of switch rows. */
export function SettingsSwitchList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col divide-y divide-border">{children}</div>
}
