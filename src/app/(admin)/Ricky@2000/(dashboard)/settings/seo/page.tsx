import type { Metadata } from "next"

import { BrandingAssetCard } from "@/components/admin/settings/branding-asset-card"
import { SeoSettingsForm } from "@/components/admin/settings/seo-settings-form"
import { SettingsPanel } from "@/components/admin/settings/settings-ui"
import { siteConfig } from "@/config/site"
import { requirePermission } from "@/lib/auth/admin-guard"
import { can } from "@/lib/auth/permissions"
import { getBusinessSettings } from "@/lib/queries/settings.queries"

export const metadata: Metadata = {
  title: "SEO & social · Settings",
}

export default async function SeoSettingsPage() {
  const admin = await requirePermission("settings:read")
  const settings = await getBusinessSettings()
  const canEdit = can(admin.role, "settings:write")

  return (
    <>
      <SeoSettingsForm
        settings={settings}
        fallbackTitle={`${settings.businessName} — ${siteConfig.tagline}`}
        fallbackDescription={settings.businessDescription}
        siteUrl={siteConfig.url}
        canEdit={canEdit}
      />

      <SettingsPanel
        id="social-sharing"
        title="Social sharing"
        description="The picture shown when a page without its own photograph is shared. Vehicle and part pages use their main photograph."
      >
        <div className="min-w-0">
          <BrandingAssetCard kind="ogImage" url={settings.brandingAssets.ogImage} canEdit={canEdit} />
        </div>
      </SettingsPanel>
    </>
  )
}
