import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { VehicleForm } from "@/components/admin/vehicle-form"
import { requirePermission } from "@/lib/auth/admin-guard"
import { cn } from "@/lib/utils"
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

        <AdminPageHeader
          title="Add vehicle"
          description="The reference number and web address are generated automatically once you save."
        />
      </div>

      {/*
        The three steps, stated before the form rather than discovered after
        it. The first two both happen below: photographs used to need a
        second screen, because they are stored against a vehicle id that does
        not exist until the record is saved. That is still true, and it is
        now the action's problem rather than the operator's.
      */}
      <ol className="grid gap-3 sm:grid-cols-3">
        <WorkflowStep
          step={1}
          title="Enter the details"
          description="What the vehicle is, what it costs, how it is specified."
          onThisScreen
          current
        />
        <WorkflowStep
          step={2}
          title="Choose the photographs"
          description="The main image first, then the rest of the walk-around."
          onThisScreen
        />
        <WorkflowStep
          step={3}
          title="Publish"
          description="From the vehicle's page, when the listing is ready for customers."
        />
      </ol>

      <VehicleForm />
    </div>
  )
}

/**
 * One step of the three-stage listing workflow.
 *
 * Presentational, and rendered as a list rather than three divs so the
 * sequence is conveyed to a screen reader by the markup instead of by the
 * numbers being visible.
 *
 * `onThisScreen` styles a step as reachable here; `current` marks the one a
 * screen reader should announce as the position. Two separate props because
 * two steps happen on this page but `aria-current` may only identify one —
 * putting it on both says "you are in two places at once".
 */
function WorkflowStep({
  step,
  title,
  description,
  onThisScreen = false,
  current = false,
}: {
  step: number
  title: string
  description: string
  onThisScreen?: boolean
  current?: boolean
}) {
  return (
    <li
      aria-current={current ? "step" : undefined}
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-4",
        onThisScreen
          ? "border-gold-ink/40 bg-accent"
          : "border-border bg-card"
      )}
    >
      <span
        className={cn(
          "font-heading text-[0.625rem] font-bold tracking-[0.16em] uppercase",
          onThisScreen ? "text-gold-ink" : "text-muted-foreground"
        )}
      >
        Step {step}
      </span>
      <span className="font-heading text-small font-semibold">{title}</span>
      <span className="text-small text-muted-foreground">{description}</span>
    </li>
  )
}
