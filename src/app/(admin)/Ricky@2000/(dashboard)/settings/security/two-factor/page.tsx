import type { Metadata } from "next"
import { ShieldAlert, ShieldCheck } from "lucide-react"

import { TwoFactorDisableForm, TwoFactorSetup } from "@/components/admin/security/two-factor-forms"
import { SettingsPanel } from "@/components/admin/settings/settings-ui"
import { requirePermission } from "@/lib/auth/admin-guard"
import { getAdminAccountDetails } from "@/lib/queries/admin-account.queries"
import { getOperationalSettings } from "@/lib/queries/settings.queries"
import { formatDate } from "@/lib/utils/format-date-time"

export const metadata: Metadata = {
  title: "Two-factor authentication · Settings",
}

/**
 * Settings → Admin users & security → Two-factor authentication.
 *
 * The one page an administrator can reach while "Require 2FA" is on and they
 * have none — see `allowTwoFactorSetup` in admin-guard.ts.
 */
export default async function TwoFactorSettingsPage(props: PageProps<"/Ricky@2000/settings/security/two-factor">) {
  const admin = await requirePermission("admin:read", { allowTwoFactorSetup: true })
  const [{ required }, details, { security }] = await Promise.all([
    props.searchParams,
    getAdminAccountDetails(admin.id),
    getOperationalSettings(),
  ])

  const enabled = admin.twoFactorEnabled

  return (
    <>
      {!enabled && (required === "1" || security.requireTwoFactor) ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 px-5 py-4">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="flex flex-col gap-0.5">
            <p className="text-small font-semibold">Two-factor authentication is required</p>
            <p className="text-small text-muted-foreground">
              The dealership requires every administrator to use an authenticator app. Set it up below to continue
              using the dashboard.
            </p>
          </div>
        </div>
      ) : null}

      <SettingsPanel
        id="two-factor-status"
        title="Two-factor authentication"
        description="A six-digit code from an app on your phone, asked for each time you sign in — so a stolen password alone is not enough."
        action={
          <span
            className={
              enabled
                ? "inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success"
                : "inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground"
            }
          >
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            {enabled ? "Enabled" : "Disabled"}
          </span>
        }
      >
        {enabled ? (
          <>
            <p className="text-small text-muted-foreground">
              On since {details?.twoFactorEnabledAt ? formatDate(details.twoFactorEnabledAt) : "—"}. Lost your phone?
              Your technical contact can reset two-factor authentication for your account.
            </p>
            <TwoFactorDisableForm
              disabledReason={
                security.requireTwoFactor
                  ? "Two-factor authentication is required for every administrator, so it cannot be turned off while “Require 2FA” is on."
                  : undefined
              }
            />
          </>
        ) : (
          <TwoFactorSetup />
        )}
      </SettingsPanel>
    </>
  )
}
