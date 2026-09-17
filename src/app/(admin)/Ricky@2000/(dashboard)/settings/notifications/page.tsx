import type { Metadata } from "next"

import { NotificationSettingsForm } from "@/components/admin/settings/notification-settings-form"
import { requirePermission } from "@/lib/auth/admin-guard"
import { can } from "@/lib/auth/permissions"
import { isEmailSendingConfigured } from "@/lib/email/resend-client"
import { getBusinessSettings } from "@/lib/queries/settings.queries"

export const metadata: Metadata = {
  title: "Notifications · Settings",
}

export default async function NotificationSettingsPage() {
  const admin = await requirePermission("settings:read")
  const settings = await getBusinessSettings()

  return (
    <NotificationSettingsForm
      settings={settings.notifications}
      // A yes/no about the deployment, never the key itself.
      emailConfigured={isEmailSendingConfigured()}
      canEdit={can(admin.role, "settings:write")}
    />
  )
}
