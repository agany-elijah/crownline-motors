"use client"

import Link from "next/link"
import { useActionState } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { VehicleStatus } from "@/generated/prisma/enums"
import {
  updateVehicleStatusAction,
  type VehicleFormState,
} from "@/lib/actions/vehicle.actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { VehicleStatusBadge } from "@/components/admin/vehicle-status-badge"
import {
  VEHICLE_STATUS_DESCRIPTIONS,
  VEHICLE_STATUS_LABELS,
} from "@/lib/constants/vehicle-options"
// The same table the Server Action enforces. Rendering buttons from it is a
// convenience; `updateVehicleStatusAction` is what actually refuses a move.
import { ALLOWED_VEHICLE_TRANSITIONS } from "@/lib/constants/vehicle-status-transitions"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

const INITIAL_STATE: VehicleFormState = { status: "idle" }

interface VehicleStatusControlProps {
  vehicleId: string
  status: VehicleStatus
  photoCount: number
}

/**
 * Status transitions for a vehicle.
 *
 * Separate from the details form on purpose. Changing a price is a
 * correction; publishing puts a vehicle in front of customers and archiving
 * takes it away. Mixing the two into one Save button means those decisions
 * get made by accident, in passing, while fixing a typo.
 */
export function VehicleStatusControl({
  vehicleId,
  status,
  photoCount,
}: VehicleStatusControlProps) {
  const [state, formAction, isPending] = useActionState(
    updateVehicleStatusAction,
    INITIAL_STATE
  )

  const transitions = ALLOWED_VEHICLE_TRANSITIONS[status]

  // A listing with no photographs is the most damaging thing the business
  // can publish. Warned rather than blocked: the operator may have a reason,
  // and a hard block on a judgement call is how people learn to work around
  // a tool instead of with it.
  const publishingWithoutPhotos = photoCount === 0

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-h3 font-semibold">Status</h2>
          <p className="text-small text-muted-foreground">
            {VEHICLE_STATUS_DESCRIPTIONS[status]}
          </p>
        </div>
        <VehicleStatusBadge status={status} />
      </div>

      {state.status === "success" && state.message ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" className="text-gold-ink" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {publishingWithoutPhotos && transitions.includes(VehicleStatus.PUBLISHED) ? (
        <Alert>
          <AlertCircle aria-hidden="true" className="text-warning" />
          <AlertDescription>
            This vehicle has no photographs. You can publish it, but customers
            browsing the website will see a listing with no images.{" "}
            <Link
              href={`${ADMIN_BASE_PATH}/vehicles/${vehicleId}#photographs`}
              className="font-semibold text-gold-ink underline underline-offset-3"
            >
              Add photographs
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {transitions.map((target) => (
          <form key={target} action={formAction}>
            <input type="hidden" name="id" value={vehicleId} />
            <input type="hidden" name="status" value={target} />
            <Button
              type="submit"
              disabled={isPending}
              variant={target === VehicleStatus.PUBLISHED ? "default" : "outline"}
            >
              {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {labelForTransition(target)}
            </Button>
          </form>
        ))}
      </div>
    </section>
  )
}

/**
 * Buttons are named for the action, not the resulting state.
 *
 * "Publish" tells an operator what will happen; "Published" describes a
 * state and reads like a label. The distinction matters most on the
 * destructive end — "Archive" is unambiguous in a way that "Archived"
 * beside a badge is not.
 */
function labelForTransition(target: VehicleStatus): string {
  switch (target) {
    case VehicleStatus.PUBLISHED:
      return "Publish"
    case VehicleStatus.RESERVED:
      return "Mark reserved"
    case VehicleStatus.SOLD:
      return "Mark sold"
    case VehicleStatus.ARCHIVED:
      return "Archive"
    case VehicleStatus.DRAFT:
      return "Return to draft"
    default:
      return VEHICLE_STATUS_LABELS[target]
  }
}
