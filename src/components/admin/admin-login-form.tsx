"use client"

import { useActionState, useId, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { signInAction, type AuthFormState } from "@/lib/actions/auth.actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const INITIAL_STATE: AuthFormState = {}

interface AdminLoginFormProps {
  /**
   * Path to return to after signing in, already validated on the server.
   * Carried through the form as a hidden field and re-validated by the
   * action — the client is never the thing that decides where a session
   * lands.
   */
  next?: string
}

/**
 * Administrator sign-in form.
 *
 * A Client Component only because it needs `useActionState` for pending and
 * error state. It holds no authentication logic of its own: the credentials
 * go straight to a Server Action, and everything this component renders is
 * a message the server chose to return. There is deliberately no
 * client-side "is this a valid email" gate that could disagree with the
 * server's answer — the Zod schema is the single source of truth, and this
 * form only displays what it says.
 */
export function AdminLoginForm({ next }: AdminLoginFormProps) {
  const [state, formAction, isPending] = useActionState(signInAction, INITIAL_STATE)

  /**
   * Re-mounts the email field when a failed attempt comes back, so it is
   * born holding the address that was submitted.
   *
   * React resets a `<form action={fn}>` to its defaults once the action
   * settles, on failure as much as on success — so a mistyped password used
   * to clear the email too, and every retry started from an empty form.
   * Assigning a changed `defaultValue` to the mounted input would fix the
   * value but move a default underneath a live control, which Base UI's
   * FieldControl rightly objects to; a fresh instance per attempt has no
   * such contradiction.
   *
   * The password field is untouched. It is not echoed by the action and
   * must not be: clearing a credential on a failed attempt is what both the
   * user and their password manager expect.
   */
  const [attemptKey, setAttemptKey] = useState(0)
  const [lastState, setLastState] = useState(state)

  if (state !== lastState) {
    setLastState(state)
    setAttemptKey((key) => key + 1)
  }

  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? (
        <Alert variant="destructive" id={errorId}>
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
          // Autofocus is right here and almost nowhere else: this page has
          // exactly one purpose and the caret has exactly one place to be.
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

      <div className="flex flex-col gap-2">
        <Label htmlFor={passwordId}>Password</Label>
        <Input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.fieldErrors?.password ? true : undefined}
          aria-describedby={
            state.fieldErrors?.password ? `${passwordId}-error` : undefined
          }
        />
        {state.fieldErrors?.password ? (
          <p id={`${passwordId}-error`} className="text-small text-destructive">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={isPending} className="mt-1 w-full">
        {isPending ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" />
            Signing in
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  )
}
