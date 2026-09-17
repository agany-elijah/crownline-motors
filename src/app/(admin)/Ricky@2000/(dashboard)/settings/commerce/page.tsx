import type { Metadata } from "next"

import { CommerceSettingsForm } from "@/components/admin/settings/commerce-settings-form"
import { requirePermission } from "@/lib/auth/admin-guard"
import { can } from "@/lib/auth/permissions"
import { getBusinessSettings } from "@/lib/queries/settings.queries"

export const metadata: Metadata = {
  title: "Commerce & payments · Settings",
}

export default async function CommerceSettingsPage() {
  const admin = await requirePermission("settings:read")
  const settings = await getBusinessSettings()

  return <CommerceSettingsForm settings={settings} canEdit={can(admin.role, "settings:write")} />
}
