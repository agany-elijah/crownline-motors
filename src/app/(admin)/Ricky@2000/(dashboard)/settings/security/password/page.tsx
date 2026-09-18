import type { Metadata } from "next"
import { Mail } from "lucide-react"

import {
  SecurityActionButton,
  SignOutEverywhereButton,
} from "@/components/admin/security/account-forms"
import { ChangePasswordForm } from "@/components/admin/security/change-password-form"
import { SettingsPanel } from "@/components/admin/settings/settings-ui"
import { sendPasswordResetLinkAction } from "@/lib/actions/account.actions"
import { requirePermission } from "@/lib/auth/admin-guard"
import { getLastAuditDate } from "@/lib/queries/audit.queries"
import { getOperationalSettings } from "@/lib/queries/settings.queries"
import { formatDateTime } from "@/lib/utils/format-date-time"

export const metadata: Metadata = {
  title: "Password & recovery · Settings",
}

/** Settings → Admin users & security → Password & recovery. */
export default async function PasswordSettingsPage() {
  const admin = await requirePermission("admin:read", { allowTwoFactorSetup: true })
  const [{ security }, lastChanged, lastResetRequested] = await Promise.all([
    getOperationalSettings(),
    getLastAuditDate(admin.id, "ADMIN_PASSWORD_CHANGED"),
    getLastAuditDate(admin.id, "ADMIN_PASSWORD_RESET_REQUESTED"),
  ])

  return (
    <>
      <SettingsPanel id="change-password" title="Change password" description="Confirm your current password to choose a new one.">
        <ChangePasswordForm />
      </SettingsPanel>

      <SettingsPanel
        id="password-recovery"
        title="Password recovery"
        description="If you forget your password, a reset link is sent to your account email."
      >
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Recovery email</dt>
            <dd className="truncate text-small font-medium">{admin.email}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Password recovery</dt>
            <dd className="text-small font-medium">{security.allowPasswordRecovery ? "Allowed" : "Turned off"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Last password change</dt>
            <dd className="text-small font-medium">{lastChanged ? formatDateTime(lastChanged) : "—"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">Last reset link requested</dt>
            <dd className="text-small font-medium">{lastResetRequested ? formatDateTime(lastResetRequested) : "—"}</dd>
          </div>
        </dl>

        <SecurityActionButton
          action={sendPasswordResetLinkAction}
          label="Email me a reset link"
          pendingLabel="Sending"
          icon={<Mail aria-hidden="true" />}
          disabled={!security.allowPasswordRecovery}
        />
      </SettingsPanel>

      <SettingsPanel
        id="sign-out-all"
        title="Sign out all sessions"
        description="If you think someone else has your password, change it above — that signs everyone out. To end every session without changing it, use this."
      >
        <div>
          <SignOutEverywhereButton />
        </div>
      </SettingsPanel>
    </>
  )
}
