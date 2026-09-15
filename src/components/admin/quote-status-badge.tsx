import type { QuoteStatus } from "@/generated/prisma/enums"
import { StatusBadge } from "@/components/admin/status-badge"
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from "@/lib/constants/quote-status"

/**
 * Quote status as a badge. A thin binding, like `SparePartStatusBadge` — the
 * label and tone are answered once in quote-status.ts. `className` passes
 * through so a placement like the quote header can make it smaller and more
 * discreet without a second component.
 */
export function QuoteStatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  return (
    <StatusBadge tone={QUOTE_STATUS_TONES[status]} className={className}>
      {QUOTE_STATUS_LABELS[status]}
    </StatusBadge>
  )
}
