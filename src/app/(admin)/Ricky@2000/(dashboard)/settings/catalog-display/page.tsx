import type { Metadata } from "next"

import { CatalogDisplayForm } from "@/components/admin/settings/catalog-display-form"
import { requirePermission } from "@/lib/auth/admin-guard"
import { can } from "@/lib/auth/permissions"
import { getBusinessSettings } from "@/lib/queries/settings.queries"

export const metadata: Metadata = {
  title: "Catalogue display · Settings",
}

export default async function CatalogDisplaySettingsPage() {
  const admin = await requirePermission("settings:read")
  const settings = await getBusinessSettings()

  return <CatalogDisplayForm settings={settings.catalogDisplay} canEdit={can(admin.role, "settings:write")} />
}
