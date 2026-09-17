"use client"

import * as React from "react"
import { Check, Copy, Loader2, ShieldCheck, Smartphone } from "lucide-react"

import { SettingsFormAlert } from "@/components/admin/settings/settings-form-controls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  confirmTwoFactorEnrollmentAction,
  disableTwoFactorAction,
  startTwoFactorEnrollmentAction,
  verifyTwoFactorSignInAction,
  type TwoFactorActionState,
  type TwoFactorEnrollmentState,
} from "@/lib/actions/two-factor.actions"

/** The six-digit field every 2FA form uses — numeric keypad, one-time-code autofill. */
function CodeInput({ id, error, autoFocus }: { id: string; error?: string; autoFocus?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium">
        Authenticator code
      </label>
      <Input
        id={id}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        placeholder="123 456"
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="max-w-[12rem] text-center font-mono text-lg tracking-[0.3em]"
      />
      {error ? (
        <p id={`${id}-error`} className="text-small text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP", easier to type by hand. */
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim()
}

/**
 * Turning two-factor on: start → scan the QR code (or type the key) → confirm
 * with a code. Nothing is switched on until the code is verified.
 */
export function TwoFactorSetup() {
  const [enrollment, startAction, starting] = React.useActionState<TwoFactorEnrollmentState>(
    startTwoFactorEnrollmentAction,
    { status: "idle" }
  )
  const [confirmState, confirmAction, confirming] = React.useActionState<TwoFactorActionState, FormData>(
    confirmTwoFactorEnrollmentAction,
    { status: "idle" }
  )
  const [copied, setCopied] = React.useState(false)

  async function copySecret() {
    if (!enrollment.secret) return
    try {
      await navigator.clipboard.writeText(enrollment.secret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("[two-factor] could not copy the key", error)
    }
  }

  if (enrollment.status !== "ready") {
    return (
      <form action={startAction} className="flex flex-col items-start gap-3">
        {enrollment.status === "error" ? <SettingsFormAlert state={{ status: "error", message: enrollment.message }} /> : null}
        <Button type="submit" disabled={starting}>
          {starting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Smartphone aria-hidden="true" />}
          Set up authenticator app
        </Button>
        <p className="text-xs text-muted-foreground">
          Works with Google Authenticator, Microsoft Authenticator, 1Password, Authy and similar apps.
        </p>
      </form>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-xl bg-white p-3 shadow-[var(--shadow-subtle)] ring-1 ring-border">
          {/* A data: URL of an SVG from Supabase, rendered as an image — which
              cannot run script — rather than injected as markup. next/image
              adds nothing for an inline data URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qrCode} alt="QR code to add this account to an authenticator app" className="size-44" />
        </div>
        <span className="text-xs text-muted-foreground">Scan with your app</span>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <ol className="flex flex-col gap-2 text-small text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">1.</span> Open your authenticator app and add an account.
          </li>
          <li>
            <span className="font-medium text-foreground">2.</span> Scan the QR code, or enter this key:
          </li>
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-secondary px-3 py-2 font-mono text-small tracking-wider break-all">
            {groupSecret(enrollment.secret ?? "")}
          </code>
          <Button type="button" variant="ghost" size="sm" onClick={copySecret}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy key"}
          </Button>
        </div>

        <form action={confirmAction} className="flex flex-col gap-3">
          <input type="hidden" name="factorId" value={enrollment.factorId} />
          <p className="text-small text-muted-foreground">
            <span className="font-medium text-foreground">3.</span> Enter the six-digit code the app shows.
          </p>
          {confirmState.status === "error" && !confirmState.fieldErrors ? <SettingsFormAlert state={confirmState} /> : null}
          <CodeInput id="enroll-code" error={confirmState.fieldErrors?.code?.[0]} autoFocus />
          <div>
            <Button type="submit" disabled={confirming}>
              {confirming ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ShieldCheck aria-hidden="true" />}
              Verify and turn on
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Turning two-factor off — needs a current code. */
export function TwoFactorDisableForm({ disabledReason }: { disabledReason?: string }) {
  const [state, formAction, pending] = React.useActionState<TwoFactorActionState, FormData>(disableTwoFactorAction, {
    status: "idle",
  })

  if (disabledReason) {
    return <p className="text-small text-muted-foreground">{disabledReason}</p>
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.status === "error" && !state.fieldErrors ? <SettingsFormAlert state={state} /> : null}
      <p className="text-small text-muted-foreground">
        To turn two-factor authentication off, confirm with a current code from your app.
      </p>
      <CodeInput id="disable-code" error={state.fieldErrors?.code?.[0]} />
      <div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          Turn off two-factor authentication
        </Button>
      </div>
    </form>
  )
}

/** The code step of signing in. */
export function TwoFactorSignInForm({ next }: { next?: string }) {
  const [state, formAction, pending] = React.useActionState<TwoFactorActionState, FormData>(
    verifyTwoFactorSignInAction,
    { status: "idle" }
  )

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.status === "error" && !state.fieldErrors ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-small">
          {state.message}
        </p>
      ) : null}
      <CodeInput id="sign-in-code" error={state.fieldErrors?.code?.[0]} autoFocus />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {pending ? "Verifying" : "Verify"}
      </Button>
    </form>
  )
}
