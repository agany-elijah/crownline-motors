"use client"

import { useActionState, useId } from "react"
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
          id={emailId}
          name="email"
          type="email"
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
