import type { Metadata } from "next"
import { LogOut, ShieldCheck, ShieldOff } from "lucide-react"

import {
  AccountNameForm,
  EmailChangeForm,
  SecurityActionButton,
} from "@/components/admin/security/account-forms"
import { SettingsPanel } from "@/components/admin/settings/settings-ui"
import { signOutOtherSessionsAction } from "@/lib/actions/account.actions"
import { syncAdminEmail } from "@/lib/auth/admin-account"
import { requirePermission } from "@/lib/auth/admin-guard"
import { getLastAdminSignIn } from "@/lib/auth/admin-sessions"
import { ADMIN_ROLE_LABELS } from "@/lib/auth/permissions"
import { getAdminAccountDetails } from "@/lib/queries/admin-account.queries"
import { createClient } from "@/lib/supabase/server"
import { formatDate, formatDateTime } from "@/lib/utils/format-date-time"

export const metadata: Metadata = {
  title: "Administrator account · Settings",
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-small font-medium text-foreground">{children}</dd>
    </div>
  )
}

/**
 * Settings → Admin users & security → Administrator account: the signed-in
 * administrator's own record. Nothing here can change another account, and
 * the account status is shown, not offered as a switch — an administrator
 * cannot deactivate themselves by accident.
 */
export default async function AdministratorAccountPage() {
  const admin = await requirePermission("admin:read", { allowTwoFactorSetup: true })

  // Supabase is the authority on the sign-in address. If a confirmed change
  // has not reached our copy yet (the confirmation link was opened on another
  // device, say), it is brought into line here.
  const supabase = await createClient()
  const { data: authUser } = await supabase.auth.getUser()
  if (authUser.user?.id === admin.id && authUser.user.email && authUser.user.email.toLowerCase() !== admin.email) {
    await syncAdminEmail(admin.id, authUser.user.email)
  }

  const [details, lastSignIn] = await Promise.all([getAdminAccountDetails(admin.id), getLastAdminSignIn(admin.id)])
  const pendingEmail = authUser.user?.new_email ?? null

  return (
    <>
      <SettingsPanel id="account-overview" title="Administrator account" description="Your own sign-in details.">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Name">{admin.displayName}</Detail>
          <Detail label="Email">{authUser.user?.email ?? admin.email}</Detail>
          <Detail label="Role">{ADMIN_ROLE_LABELS[admin.role]}</Detail>
          <Detail label="Account status">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-success" />
              {details?.isActive ? "Active" : "Inactive"}
            </span>
          </Detail>
          <Detail label="Two-factor authentication">
            <span className="inline-flex items-center gap-1.5">
              {admin.twoFactorEnabled ? (
                <ShieldCheck aria-hidden="true" className="size-4 text-success" />
              ) : (
                <ShieldOff aria-hidden="true" className="size-4 text-muted-foreground" />
              )}
              {admin.twoFactorEnabled ? "On" : "Off"}
            </span>
          </Detail>
          <Detail label="Last sign-in">{lastSignIn ? formatDateTime(lastSignIn) : "—"}</Detail>
          <Detail label="Account created">{details ? formatDate(details.createdAt) : "—"}</Detail>
        </dl>
      </SettingsPanel>

      <SettingsPanel id="account-name" title="Your name">
        <AccountNameForm displayName={admin.displayName} />
      </SettingsPanel>

      <SettingsPanel
        id="account-email"
        title="Change email address"
        description="You sign in with this address and receive password resets at it. Confirmation links are sent before it changes."
      >
        {pendingEmail ? (
          <p className="rounded-lg bg-secondary px-4 py-3 text-small">
            A change to <span className="font-medium">{pendingEmail}</span> is waiting for confirmation.
          </p>
        ) : null}
        <EmailChangeForm currentEmail={admin.email} />
      </SettingsPanel>

      <SettingsPanel
        id="account-sessions"
        title="Other sessions"
        description="Signed in somewhere you no longer use? Sign every other device out. This one stays signed in."
      >
        <SecurityActionButton
          action={signOutOtherSessionsAction}
          label="Sign out of all other sessions"
          pendingLabel="Signing out"
          icon={<LogOut aria-hidden="true" />}
        />
      </SettingsPanel>
    </>
  )
}
