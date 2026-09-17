import type { Metadata } from "next"

import { SignOutEverywhereButton } from "@/components/admin/security/account-forms"
import { SecurityControlsForm, SessionList } from "@/components/admin/security/session-forms"
import { SettingsPanel } from "@/components/admin/settings/settings-ui"
import { AdminLoginEventKind } from "@/generated/prisma/enums"
import { requirePermission } from "@/lib/auth/admin-guard"
import { listActiveAdminSessions, listAdminLoginEvents } from "@/lib/auth/admin-sessions"
import { getAdminAccess } from "@/lib/auth/dal"
import { can } from "@/lib/auth/permissions"
import { sessionTimeoutLabel } from "@/lib/constants/security-options"
import { getOperationalSettings } from "@/lib/queries/settings.queries"
import { cn } from "@/lib/utils"
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format-date-time"

export const metadata: Metadata = {
  title: "Login & session security · Settings",
}

const EVENT_COPY: Record<AdminLoginEventKind, { activity: string; ok: boolean }> = {
  SIGN_IN_SUCCEEDED: { activity: "Sign in", ok: true },
  SIGN_IN_FAILED: { activity: "Sign-in attempt — wrong password", ok: false },
  TWO_FACTOR_FAILED: { activity: "Sign-in attempt — wrong authenticator code", ok: false },
  SIGNED_OUT: { activity: "Sign out", ok: true },
}

function isMobileDevice(label: string | null): boolean {
  return label !== null && /iPhone|iPad|Android/.test(label)
}

/** Settings → Admin users & security → Login & session security. */
export default async function SessionSecurityPage() {
  const admin = await requirePermission("admin:read", { allowTwoFactorSetup: true })
  const [access, sessions, events, { security }] = await Promise.all([
    getAdminAccess(),
    listActiveAdminSessions(admin.id),
    listAdminLoginEvents(admin.id, 20),
    getOperationalSettings(),
  ])

  // requirePermission has already established access; the current session is
  // what marks "This device" and gives the expiry.
  const current = access.status === "OK" || access.status === "TWO_FACTOR_SETUP_REQUIRED" ? access.session : null
  const canManage = can(admin.role, "admin:manage")
  const now = new Date()

  return (
    <>
      {canManage ? (
        <SettingsPanel
          id="security-controls"
          title="Security controls"
          description="Apply to every administrator, from their next request."
        >
          <SecurityControlsForm settings={security} actorHasTwoFactor={admin.twoFactorEnabled} />
        </SettingsPanel>
      ) : null}

      <SettingsPanel
        id="current-session"
        title="Current session"
        description={`Sessions last ${sessionTimeoutLabel(security.sessionTimeoutHours)} from sign-in.`}
      >
        {current ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <div className="col-span-2 flex flex-col gap-0.5 sm:col-span-1">
              <dt className="text-xs text-muted-foreground">Device</dt>
              <dd className="text-small font-medium">
                {sessions.find((session) => session.id === current.id)?.deviceLabel ?? "This device"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Signed in</dt>
              <dd className="text-small font-medium">{formatDateTime(current.createdAt)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Expires</dt>
              <dd className="text-small font-medium">{formatDateTime(current.expiresAt)}</dd>
            </div>
          </dl>
        ) : null}
      </SettingsPanel>

      <SettingsPanel
        id="active-sessions"
        title="Active sessions"
        description="Every device signed in to your account. Signing one out takes effect on its next click."
        action={<SignOutEverywhereButton />}
      >
        {sessions.length > 0 ? (
          <SessionList
            sessions={sessions.map((session) => ({
              id: session.id,
              device: session.deviceLabel ?? "Unknown device",
              signedIn: formatDateTime(session.createdAt),
              lastActive: formatRelativeTime(session.lastSeenAt, now).toLowerCase(),
              current: session.id === current?.id,
              mobile: isMobileDevice(session.deviceLabel),
            }))}
          />
        ) : (
          <p className="text-small text-muted-foreground">No active sessions.</p>
        )}
      </SettingsPanel>

      <SettingsPanel
        id="login-activity"
        title="Recent login activity"
        description="The last 20 sign-ins, attempts and sign-outs on your account."
      >
        {events.length > 0 ? (
          // A list rather than a table, so each event reads as one line on a
          // phone instead of four squeezed columns.
          <ol className="flex min-w-0 flex-col divide-y divide-border">
            {events.map((event) => {
              const copy = EVENT_COPY[event.kind]
              return (
                <li key={event.id} className="flex min-w-0 items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span
                    aria-hidden="true"
                    className={cn("size-1.5 shrink-0 rounded-full", copy.ok ? "bg-success" : "bg-destructive")}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-small">
                      {copy.activity}
                      <span className="sr-only">, {copy.ok ? "successful" : "failed"}</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      <time dateTime={event.createdAt.toISOString()} className="tabular-nums">
                        {formatDateTime(event.createdAt)}
                      </time>
                      {event.deviceLabel ? ` · ${event.deviceLabel}` : null}
                    </span>
                  </div>
                  {!copy.ok ? (
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                      Failed
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="text-small text-muted-foreground">No activity recorded yet.</p>
        )}
      </SettingsPanel>
    </>
  )
}
