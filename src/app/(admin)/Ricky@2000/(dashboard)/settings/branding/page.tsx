import type { Metadata } from "next"

import { BrandingAssetCard } from "@/components/admin/settings/branding-asset-card"
import { BrandingSettingsForm } from "@/components/admin/settings/branding-settings-form"
import { SettingsPanel } from "@/components/admin/settings/settings-ui"
import { requirePermission } from "@/lib/auth/admin-guard"
import { can } from "@/lib/auth/permissions"
import { getBusinessSettings } from "@/lib/queries/settings.queries"

export const metadata: Metadata = {
  title: "Website & branding · Settings",
}

export default async function BrandingSettingsPage() {
  const admin = await requirePermission("settings:read")
  const settings = await getBusinessSettings()
  const canEdit = can(admin.role, "settings:write")

  return (
    <>
      {/* The images save on their own, the moment one is chosen, so they sit
          outside the form rather than waiting on its Save button. */}
      <SettingsPanel
        id="brand-assets"
        title="Logos and icons"
        description="Without a logo, the site uses the business name as a text wordmark."
      >
        <div className="flex min-w-0 flex-col divide-y divide-border">
          <BrandingAssetCard kind="logoLight" url={settings.brandingAssets.logoLight} canEdit={canEdit} />
          <BrandingAssetCard kind="logoDark" url={settings.brandingAssets.logoDark} canEdit={canEdit} />
          <BrandingAssetCard kind="favicon" url={settings.brandingAssets.favicon} canEdit={canEdit} />
        </div>
      </SettingsPanel>

      <BrandingSettingsForm
        siteTitle={settings.siteTitle}
        businessName={settings.businessName}
        defaultDashboardTheme={settings.defaultDashboardTheme}
        canEdit={canEdit}
      />
    </>
  )
}
