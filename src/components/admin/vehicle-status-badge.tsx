import type { VehicleStatus } from "@/generated/prisma/enums"
import { StatusBadge, type StatusTone } from "@/components/admin/status-badge"
import {
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_TONES,
} from "@/lib/constants/vehicle-options"

/**
 * Vehicle status as a badge.
 *
 * A thin binding between the status enum and the generic badge, so that
 * "what colour is Reserved" is answered once — in vehicle-options.ts —
 * rather than at each of the several places a status is rendered.
 */
export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <StatusBadge tone={VEHICLE_STATUS_TONES[status] as StatusTone}>
      {VEHICLE_STATUS_LABELS[status]}
    </StatusBadge>
  )
}
