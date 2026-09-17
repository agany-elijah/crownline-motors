import type { Metadata } from "next"

import { BusinessInformationForm } from "@/components/admin/settings/business-information-form"
import { requirePermission } from "@/lib/auth/admin-guard"
import { can } from "@/lib/auth/permissions"
import { getBusinessSettings } from "@/lib/queries/settings.queries"

export const metadata: Metadata = {
  title: "Business information · Settings",
}

/**
 * Settings → Business information, the first section and the settings root.
 *
 * Reading requires `settings:read`; saving requires `settings:write`, checked
 * again inside the action. Splitting the two means a future role can see the
 * configuration without being able to change it — the form renders read-only
 * for them rather than offering a save that would be refused.
 */
export default async function BusinessInformationSettingsPage() {
  const admin = await requirePermission("settings:read")
  const settings = await getBusinessSettings()

  return <BusinessInformationForm settings={settings} canEdit={can(admin.role, "settings:write")} />
}
