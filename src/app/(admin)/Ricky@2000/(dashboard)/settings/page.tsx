import type { Metadata } from "next"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { BusinessSettingsForm } from "@/components/admin/business-settings-form"
import { requirePermission } from "@/lib/auth/admin-guard"
import { getBusinessSettings } from "@/lib/queries/settings.queries"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function AdminSettingsPage() {
  // Reading settings requires `settings:read`; saving them requires
  // `settings:write`, checked separately inside the action. Splitting the
  // two means a future role can be allowed to see the payment structure
  // without being able to change what customers are charged.
  await requirePermission("settings:read")

  const settings = await getBusinessSettings()

  const lastUpdated = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(settings.updatedAt)

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Business settings"
        description="Configuration used across the website and every new vehicle order."
      />

      <BusinessSettingsForm settings={settings} />

      <p className="text-small text-muted-foreground">
        Last updated {lastUpdated} UTC. Every change is recorded in the audit log
        with the administrator who made it.
      </p>
    </div>
  )
}
