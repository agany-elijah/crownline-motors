import type { Metadata } from "next"

import { AdminStepTrail } from "@/components/admin/admin-form"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { VehicleForm } from "@/components/admin/vehicle-form"
import { requirePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"

export const metadata: Metadata = {
  title: "Add Vehicle",
}

/**
 * The three-stage listing workflow, as a trail rather than a card grid — the
 * same pattern `spare-parts/new` uses, for the same reason: this is
 * wayfinding an operator needs once and never again, not a panel worth a
 * third of the screen. Details and photographs both happen on this page;
 * publishing happens afterwards, from the vehicle's own page.
 */
const STEPS = ["Enter the details", "Choose the photographs", "Publish"] as const

export default async function AdminVehicleNewPage() {
  await requirePermission("vehicle:write")
  const { catalogDisplay } = await getPublicSiteSettings()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <AdminPageHeader
          back={{ href: `${ADMIN_BASE_PATH}/vehicles`, label: "All vehicles" }}
          title="Add vehicle"
          description="Enter the listing and choose its photographs. It is saved as a draft for you to review and publish."
        />
        <AdminStepTrail steps={STEPS} current={0} />
      </div>

      <VehicleForm siteWideVisibility={catalogDisplay.vehicle} />
    </div>
  )
}
