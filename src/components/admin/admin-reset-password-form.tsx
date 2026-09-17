"use client"

import { useActionState, useId } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { updatePasswordAction, type AuthFormState } from "@/lib/actions/auth.actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const INITIAL_STATE: AuthFormState = {}

/**
 * Set-a-new-password form, reached through a one-time recovery link.
 *
 * The minimum length is stated up front rather than only after a rejected
 * attempt: a rule the user learns by failing is a rule that costs them a
 * round trip. The authoritative check remains the Zod schema on the server —
 * this hint is copy, not validation.
 */
export function AdminResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    updatePasswordAction,
    INITIAL_STATE
  )
  const passwordId = useId()
  const confirmId = useId()

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={passwordId}>New password</Label>
        <Input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          aria-invalid={state.fieldErrors?.password ? true : undefined}
          aria-describedby={`${passwordId}-hint${
            state.fieldErrors?.password ? ` ${passwordId}-error` : ""
          }`}
        />
        <p id={`${passwordId}-hint`} className="text-small text-muted-foreground">
          At least 12 characters. Length matters more than symbols — a short
          memorable phrase of several words is stronger than a scrambled word.
        </p>
        {state.fieldErrors?.password ? (
          <p id={`${passwordId}-error`} className="text-small text-destructive">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={confirmId}>Confirm new password</Label>
        <Input
          id={confirmId}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={state.fieldErrors?.confirmPassword ? true : undefined}
          aria-describedby={
            state.fieldErrors?.confirmPassword ? `${confirmId}-error` : undefined
          }
        />
        {state.fieldErrors?.confirmPassword ? (
          <p id={`${confirmId}-error`} className="text-small text-destructive">
            {state.fieldErrors.confirmPassword[0]}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isPending} className="mt-1 h-11 w-full">
        {isPending ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" />
            Saving
          </>
        ) : (
          "Set new password"
        )}
      </Button>
    </form>
  )
}
