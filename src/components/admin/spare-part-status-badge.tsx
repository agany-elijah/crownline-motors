import type { SparePartStatus } from "@/generated/prisma/enums"
import { StatusBadge, type StatusTone } from "@/components/admin/status-badge"
import {
  SPARE_PART_STATUS_LABELS,
  SPARE_PART_STATUS_TONES,
} from "@/lib/constants/spare-part-options"

/**
 * Spare-part status as a badge.
 *
 * A thin binding between the status enum and the generic badge, so that
 * "what colour is Archived" is answered once — in spare-part-options.ts —
 * rather than at each of the several places a status is rendered.
 */
export function SparePartStatusBadge({ status }: { status: SparePartStatus }) {
  return (
    <StatusBadge tone={SPARE_PART_STATUS_TONES[status] as StatusTone}>
      {SPARE_PART_STATUS_LABELS[status]}
    </StatusBadge>
  )
}
