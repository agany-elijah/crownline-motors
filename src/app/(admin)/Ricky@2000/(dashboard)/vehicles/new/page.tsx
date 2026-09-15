import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ChevronRight } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { VehicleForm } from "@/components/admin/vehicle-form"
import { requirePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

export const metadata: Metadata = {
  title: "Add Vehicle",
}

export default async function AdminVehicleNewPage() {
  await requirePermission("vehicle:write")

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href={`${ADMIN_BASE_PATH}/vehicles`}
          className="inline-flex w-fit items-center gap-1.5 text-small text-muted-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          All vehicles
        </Link>

        <AdminPageHeader title="Add vehicle" />
      </div>

      <WorkflowTrail />

      <VehicleForm />
    </div>
  )
}

/**
 * The three-stage listing workflow, as a trail rather than a card grid — the
 * same pattern `spare-parts/new` uses, for the same reason: this is
 * wayfinding an operator needs once and never again, not a panel worth a
 * third of the screen. Details and photographs both happen on this page;
 * publishing happens afterwards, from the vehicle's own page.
 */
function WorkflowTrail() {
  const steps = ["Enter the details", "Choose the photographs", "Publish"]

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-small">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          {index > 0 ? (
            <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground/50" />
          ) : null}

          <span
            aria-current={index === 0 ? "step" : undefined}
            className={index < 2 ? "font-semibold text-gold-ink" : "text-muted-foreground"}
          >
            {step}
          </span>
        </li>
      ))}
    </ol>
  )
}
