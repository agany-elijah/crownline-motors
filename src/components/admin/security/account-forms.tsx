"use client"

import * as React from "react"
import { CheckCircle2, Loader2, LogOut } from "lucide-react"

import {
  SettingsFormAlert,
  SettingsSaveBar,
  useSettingsForm,
} from "@/components/admin/settings/settings-form-controls"
import { SettingsField, SettingsFieldGrid } from "@/components/admin/settings/settings-ui"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  requestEmailChangeAction,
  signOutEverywhereAction,
  updateAdminProfileAction,
  type AccountActionState,
} from "@/lib/actions/account.actions"
import { cn } from "@/lib/utils"

/** The administrator's display name. */
export function AccountNameForm({ displayName }: { displayName: string }) {
  const { state, pending, dirty, fieldError, formProps } = useSettingsForm(updateAdminProfileAction)

  return (
    <form {...formProps} className="flex flex-col gap-5">
      <SettingsFormAlert state={state} />
      <SettingsField
        label="Name"
        htmlFor="displayName"
        hint="Shown in the dashboard and beside everything you record."
        error={fieldError("displayName")}
      >
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          maxLength={80}
          autoComplete="name"
          aria-invalid={fieldError("displayName") ? true : undefined}
          className="max-w-md"
        />
      </SettingsField>
      <SettingsSaveBar state={state} pending={pending} dirty={dirty} label="Save name" inline />
    </form>
  )
}

/**
 * Changing the sign-in email. Needs the current password; the change only
 * takes effect once Supabase's confirmation links are followed.
 */
export function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const [state, dispatch, pending] = React.useActionState<AccountActionState, FormData>(requestEmailChangeAction, {
    status: "idle",
  })
  const error = (name: string) => state.fieldErrors?.[name]?.[0]

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    // The password leaves the field the moment it has been submitted; the new
    // address is kept, so a mistyped password does not cost the whole form.
    const password = event.currentTarget.elements.namedItem("currentPassword")
    if (password instanceof HTMLInputElement) password.value = ""

    React.startTransition(() => dispatch(formData))
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {state.status === "error" && !state.fieldErrors ? <SettingsFormAlert state={state} /> : null}
      {state.status === "success" ? (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-success/10 px-4 py-3 text-small text-foreground">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          {state.message}
        </p>
      ) : null}

      <SettingsFieldGrid>
        <SettingsField label="New email address" htmlFor="newEmail" error={error("newEmail")} hint={`Currently ${currentEmail}.`}>
          <Input
            id="newEmail"
            name="newEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={error("newEmail") ? true : undefined}
          />
        </SettingsField>
        <SettingsField label="Current password" htmlFor="currentPassword" error={error("currentPassword")}>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={error("currentPassword") ? true : undefined}
          />
        </SettingsField>
      </SettingsFieldGrid>

      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          Change email
        </Button>
      </div>
    </form>
  )
}

/**
 * A single-press action with no fields — sign out other sessions, send a reset
 * link — with its own pending state and result line.
 */
export function SecurityActionButton({
  action,
  label,
  pendingLabel,
  icon,
  variant = "outline",
  disabled,
}: {
  action: (state: AccountActionState) => Promise<AccountActionState>
  label: string
  pendingLabel: string
  icon?: React.ReactNode
  variant?: "outline" | "destructive" | "default"
  disabled?: boolean
}) {
  const [state, formAction, pending] = React.useActionState(action, { status: "idle" } as AccountActionState)

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <Button type="submit" variant={variant} disabled={pending || disabled}>
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : icon}
        {pending ? pendingLabel : label}
      </Button>
      <p
        aria-live="polite"
        className={cn("min-h-4 text-xs", state.status === "error" ? "text-destructive" : "text-muted-foreground")}
      >
        {state.message}
      </p>
    </form>
  )
}

/** Signs out every session including this one, after a confirmation. */
export function SignOutEverywhereButton() {
  const [pending, startTransition] = React.useTransition()

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="destructive">
          <LogOut aria-hidden="true" />
          Sign out all sessions
        </Button>
      }
      title="Sign out of every session?"
      description="Every device signed in to this account, including this one, is signed out at once. You will need your password — and your authenticator code, if 2FA is on — to sign back in."
      confirmLabel="Sign out everywhere"
      destructive
      pending={pending}
      onConfirm={() => startTransition(() => signOutEverywhereAction())}
    />
  )
}
