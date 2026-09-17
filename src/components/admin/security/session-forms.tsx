"use client"

import * as React from "react"
import { AlertTriangle, Loader2, Monitor, Smartphone } from "lucide-react"

import {
  SettingsFormAlert,
  SettingsSaveBar,
  SettingsSwitchList,
  SettingsSwitchRow,
  useSettingsForm,
} from "@/components/admin/settings/settings-form-controls"
import { NATIVE_SELECT_CLASS, SettingsField } from "@/components/admin/settings/settings-ui"
import { Button } from "@/components/ui/button"
import { revokeSessionAction, type AccountActionState } from "@/lib/actions/account.actions"
import { updateSecurityControlsAction } from "@/lib/actions/security-settings.actions"
import { SESSION_TIMEOUT_OPTIONS } from "@/lib/constants/security-options"

/** Require 2FA, allow password recovery, session timeout. */
export function SecurityControlsForm({
  settings,
  actorHasTwoFactor,
}: {
  settings: { requireTwoFactor: boolean; allowPasswordRecovery: boolean; sessionTimeoutHours: number }
  actorHasTwoFactor: boolean
}) {
  const { state, pending, dirty, markDirty, fieldError, formProps } = useSettingsForm(updateSecurityControlsAction)
  const [requireTwoFactor, setRequireTwoFactor] = React.useState(settings.requireTwoFactor)
  const [allowRecovery, setAllowRecovery] = React.useState(settings.allowPasswordRecovery)

  return (
    <form {...formProps} className="flex flex-col gap-5">
      <SettingsFormAlert state={state} />

      <SettingsSwitchList>
        <SettingsSwitchRow
          name="requireTwoFactor"
          label="Require 2FA"
          description={
            actorHasTwoFactor
              ? "Every administrator must use an authenticator app. Anyone without one is sent to set it up at their next click."
              : "Turn on two-factor authentication for your own account first — requiring it without it would lock you out."
          }
          checked={requireTwoFactor}
          onCheckedChange={(checked) => {
            setRequireTwoFactor(checked)
            markDirty()
          }}
          disabled={!actorHasTwoFactor && !requireTwoFactor}
        />
        <SettingsSwitchRow
          name="allowPasswordRecovery"
          label="Allow password recovery"
          description="Lets administrators reset a forgotten password by email."
          checked={allowRecovery}
          onCheckedChange={(checked) => {
            setAllowRecovery(checked)
            markDirty()
          }}
        />
      </SettingsSwitchList>

      {fieldError("requireTwoFactor") ? <p className="text-small text-destructive">{fieldError("requireTwoFactor")}</p> : null}

      {!allowRecovery ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/35 bg-warning/5 px-4 py-3 text-small">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            With recovery off, an administrator who forgets their password cannot reset it themselves. Your technical
            contact can still issue a reset link from the server.
          </p>
        </div>
      ) : null}

      <SettingsField
        label="Session timeout"
        htmlFor="sessionTimeoutHours"
        hint="How long a sign-in lasts before the dashboard asks for the password again. Applies to sessions already open."
        error={fieldError("sessionTimeoutHours")}
      >
        <select
          id="sessionTimeoutHours"
          name="sessionTimeoutHours"
          defaultValue={settings.sessionTimeoutHours}
          className={`${NATIVE_SELECT_CLASS} max-w-xs`}
        >
          {SESSION_TIMEOUT_OPTIONS.map((option) => (
            <option key={option.hours} value={option.hours}>
              {option.label}
            </option>
          ))}
        </select>
      </SettingsField>

      <SettingsSaveBar state={state} pending={pending} dirty={dirty} inline />
    </form>
  )
}

export interface SessionRow {
  id: string
  device: string
  signedIn: string
  lastActive: string
  current: boolean
  mobile: boolean
}

function RevokeButton({ sessionId, device }: { sessionId: string; device: string }) {
  const [state, formAction, pending] = React.useActionState<AccountActionState, FormData>(revokeSessionAction, {
    status: "idle",
  })

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="sessionId" value={sessionId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending} aria-label={`Sign out ${device}`}>
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        Sign out
      </Button>
      {state.status === "error" ? <span className="text-xs text-destructive">{state.message}</span> : null}
    </form>
  )
}

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {sessions.map((session) => {
        const Icon = session.mobile ? Smartphone : Monitor
        return (
          <li key={session.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 text-small font-medium">
                  <span className="truncate">{session.device}</span>
                  {session.current ? (
                    <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[0.625rem] font-semibold tracking-wide text-success uppercase">
                      This device
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  Signed in {session.signedIn} · Active {session.lastActive}
                </span>
              </div>
            </div>
            {session.current ? null : <RevokeButton sessionId={session.id} device={session.device} />}
          </li>
        )
      })}
    </ul>
  )
}
