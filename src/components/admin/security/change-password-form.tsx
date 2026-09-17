"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { SettingsFormAlert } from "@/components/admin/settings/settings-form-controls"
import { SettingsField, SettingsFieldGrid } from "@/components/admin/settings/settings-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { changePasswordAction, type AccountActionState } from "@/lib/actions/account.actions"

/**
 * Changing the password from inside the dashboard. On success the action
 * signs every session out and returns to the sign-in screen, so there is no
 * success state to render here.
 *
 * The form's own reset after each attempt is what we want: passwords are
 * never kept in a field once a request has been made with them.
 */
export function ChangePasswordForm() {
  const [state, formAction, pending] = React.useActionState<AccountActionState, FormData>(changePasswordAction, {
    status: "idle",
  })
  const error = (name: string) => state.fieldErrors?.[name]?.[0]

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.status === "error" && !state.fieldErrors ? <SettingsFormAlert state={state} /> : null}

      <SettingsField label="Current password" htmlFor="currentPassword" error={error("currentPassword")}>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          aria-invalid={error("currentPassword") ? true : undefined}
          className="max-w-md"
        />
      </SettingsField>

      <SettingsFieldGrid>
        <SettingsField label="New password" htmlFor="password" hint="At least 12 characters." error={error("password")}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            aria-invalid={error("password") ? true : undefined}
          />
        </SettingsField>
        <SettingsField label="Confirm new password" htmlFor="confirmPassword" error={error("confirmPassword")}>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            maxLength={72}
            aria-invalid={error("confirmPassword") ? true : undefined}
          />
        </SettingsField>
      </SettingsFieldGrid>

      <p className="text-xs text-muted-foreground">
        Changing your password signs out every session, including this one, so you sign in again with the new one.
      </p>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          Change password
        </Button>
      </div>
    </form>
  )
}
