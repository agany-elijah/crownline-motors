import { OrderStatus } from "@/generated/prisma/enums"
import type { StatusTone } from "@/components/admin/status-badge"

/**
 * How an order's coarse status reads on the dashboard.
 *
 * Presentation only. The status itself is derived by `deriveOrderStatus()`
 * (lib/orders/order-lifecycle.ts) and never set by hand except CANCELLED; this
 * table names and colours what that function decided, and nothing here feeds
 * back into it.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_DEPOSIT: "Pending deposit",
  DEPOSIT_CONFIRMED: "Deposit confirmed",
  PROCESSING: "Processing",
  AWAITING_FINAL_PAYMENT: "Awaiting final payment",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  AWAITING_PAYMENT: "Awaiting payment",
}

/**
 * Waiting on the customer is `warning`, work in hand is `neutral`, finished is
 * `positive`, and a cancelled order steps back to `muted` — it needs nothing
 * from anyone.
 */
export const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  PENDING_DEPOSIT: "warning",
  DEPOSIT_CONFIRMED: "neutral",
  PROCESSING: "neutral",
  AWAITING_FINAL_PAYMENT: "warning",
  COMPLETED: "positive",
  CANCELLED: "muted",
  AWAITING_PAYMENT: "warning",
}
