import type { Metadata } from "next"

import { OrdersTrackingSettingsForm } from "@/components/admin/settings/orders-tracking-settings-form"
import { requirePermission } from "@/lib/auth/admin-guard"
import { can } from "@/lib/auth/permissions"
import { getBusinessSettings, getTrackingSequencePreview } from "@/lib/queries/settings.queries"

export const metadata: Metadata = {
  title: "Orders & tracking · Settings",
}

export default async function OrdersTrackingSettingsPage() {
  const admin = await requirePermission("settings:read")
  const [settings, sequence] = await Promise.all([getBusinessSettings(), getTrackingSequencePreview()])

  return (
    <OrdersTrackingSettingsForm
      settings={settings}
      sequence={sequence}
      canEdit={can(admin.role, "settings:write")}
    />
  )
}
