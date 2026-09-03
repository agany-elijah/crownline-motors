"use client"

import { useActionState, useId, useState } from "react"
import { AlertCircle, Loader2, MailCheck } from "lucide-react"

import {
  requestPasswordResetAction,
  type AuthFormState,
} from "@/lib/actions/auth.actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const INITIAL_STATE: AuthFormState = {}

/**
 * Password-reset request form.
 *
 * The success notice is intentionally non-committal — "if that address
 * belongs to an administrator account" — and is shown for every submission
 * the server accepts, including addresses that match nothing. A form that
 * said "no such account" would let anyone with the public publishable key
 * map out which addresses hold staff accounts (SECURITY.MD §5.4, §43).
 *
 * The form is replaced by the notice on success rather than left in place,
 * so a second submission takes a deliberate reload instead of an idle click.
 */
export function AdminForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    INITIAL_STATE
  )
  /** Keeps a rejected address on screen. See the note in AdminLoginForm —
   *  React resets the form once the action settles, so without this a
   *  mistyped address is simply gone. */
  const [attemptKey, setAttemptKey] = useState(0)
  const [lastState, setLastState] = useState(state)

  if (state !== lastState) {
    setLastState(state)
    setAttemptKey((key) => key + 1)
  }

  const emailId = useId()

  if (state.notice) {
    return (
      <Alert>
        <MailCheck aria-hidden="true" className="text-gold-ink" />
        <AlertDescription>{state.notice}</AlertDescription>
      </Alert>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Email address</Label>
        <Input
          key={attemptKey}
          id={emailId}
          name="email"
          type="email"
          defaultValue={state.email}
          autoComplete="username"
          autoFocus
          required
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          aria-describedby={state.fieldErrors?.email ? `${emailId}-error` : undefined}
        />
        {state.fieldErrors?.email ? (
          <p id={`${emailId}-error`} className="text-small text-destructive">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={isPending} className="mt-1 w-full">
        {isPending ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" />
            Sending
          </>
        ) : (
          "Send reset link"
        )}
      </Button>
    </form>
  )
}
