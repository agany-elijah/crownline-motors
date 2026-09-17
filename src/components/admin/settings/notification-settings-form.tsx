"use client"

import { AlertTriangle } from "lucide-react"

import {
  SettingsFormAlert,
  SettingsSaveBar,
  SettingsSwitchList,
  SettingsSwitchRow,
  useSettingsForm,
} from "@/components/admin/settings/settings-form-controls"
import { SettingsPanel } from "@/components/admin/settings/settings-ui"
import { updateNotificationSettingsAction } from "@/lib/actions/settings.actions"
import type { NotificationSettings } from "@/lib/queries/settings.queries"

/** Settings → Notifications. */
export function NotificationSettingsForm({
  settings,
  emailConfigured,
  canEdit,
}: {
  settings: NotificationSettings
  /** Whether the server can send email at all (RESEND_API_KEY). */
  emailConfigured: boolean
  canEdit: boolean
}) {
  const { state, pending, dirty, markDirty, formProps } = useSettingsForm(updateNotificationSettingsAction)

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <SettingsFormAlert state={state} />

      {!emailConfigured ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/35 bg-warning/5 px-4 py-3 text-small text-foreground">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            Email sending is not set up on the server yet, so no email goes out whatever is switched on here. The
            settings are saved and take effect as soon as it is.
          </p>
        </div>
      ) : null}

      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-6">
        <SettingsPanel
          id="admin-notifications"
          title="Admin notifications"
          description="What the system tells the dealership, and what it sends customers on its own."
        >
          <SettingsSwitchList>
            <SettingsSwitchRow
              name="notifyAdminsOfNewQuotes"
              label="New quote received"
              description="Alert administrators when a customer requests a quotation, through the channels below."
              defaultChecked={settings.notifyAdminsOfNewQuotes}
              onCheckedChange={markDirty}
            />
            <SettingsSwitchRow
              name="customerEmailsEnabled"
              label="Automatic customer emails"
              description="Request received, order confirmed, payment receipts, refunds, tracking number and tracking updates. Sending a quotation yourself is never affected."
              defaultChecked={settings.customerEmailsEnabled}
              onCheckedChange={markDirty}
            />
          </SettingsSwitchList>
        </SettingsPanel>

        <SettingsPanel
          id="notification-channels"
          title="Notification channels"
          description="How administrator notifications reach staff."
        >
          <SettingsSwitchList>
            <SettingsSwitchRow
              name="adminEmailNotificationsEnabled"
              label="Admin email notifications"
              description="An email to every active administrator."
              defaultChecked={settings.adminEmailNotificationsEnabled}
              onCheckedChange={markDirty}
            />
            <SettingsSwitchRow
              name="dashboardNotificationsEnabled"
              label="Dashboard notifications"
              description="An alert in the corner of the dashboard while it is open."
              defaultChecked={settings.dashboardNotificationsEnabled}
              onCheckedChange={markDirty}
            />
          </SettingsSwitchList>
        </SettingsPanel>
      </fieldset>

      {canEdit ? <SettingsSaveBar state={state} pending={pending} dirty={dirty} /> : null}
    </form>
  )
}
