import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Writer for the AuditLog table (SECURITY.MD §39, brief §10 "Payments").
 *
 * AuditLog covers administrative actions that do not already carry a
 * dedicated "who did this" column. It is not redundant with
 * Payment.verifiedByAdminId or TrackingEvent.createdByAdminId — those are
 * structural fields on records that need the actor without a join. This
 * table covers everything else: price changes, publishes, cancellations,
 * sign-ins.
 *
 * ── Why actorId is always a real admin ────────────────────────────────
 * AuditLog.actorId is a required, Restrict foreign key to AdminProfile. A
 * failed sign-in by someone who is not an administrator therefore cannot be
 * written here at all, by design — there is no actor to attribute it to.
 * Those attempts are recorded by Supabase Auth's own logs and, in this
 * codebase, through `logSecurityEvent` below. Do not work around the
 * constraint by inventing placeholder actor rows; it would corrupt the one
 * table whose value depends entirely on being trustworthy.
 */

/** Action codes. A union, not free-form strings, so a typo cannot create a
 *  parallel action name that no query will ever find. Extend as phases land. */
export type AuditAction =
  | "ADMIN_SIGNED_IN"
  | "ADMIN_SIGNED_OUT"
  | "ADMIN_PASSWORD_RESET_REQUESTED"
  | "ADMIN_PASSWORD_CHANGED"
  | "BUSINESS_SETTINGS_UPDATED"
  | "VEHICLE_CREATED"
  | "VEHICLE_UPDATED"
  | "VEHICLE_STATUS_CHANGED"
  | "VEHICLE_PHOTOS_UPLOADED"
  // Emitted when a photograph's alternative text is edited. This is the
  // only per-photograph field an operator can write, so "updated" is
  // unambiguous; if a second one is ever added, split this rather than
  // widening what it means.
  | "VEHICLE_PHOTO_UPDATED"
  | "VEHICLE_PHOTOS_REORDERED"
  | "VEHICLE_PHOTO_DELETED"
  | "VEHICLE_PRIMARY_PHOTO_CHANGED"
  | "SPARE_PART_CREATED"
  | "SPARE_PART_UPDATED"
  | "SPARE_PART_STATUS_CHANGED"
  // The parts gallery has no alt-text equivalent of VEHICLE_PHOTO_UPDATED:
  // part descriptions are generated rather than typed (see
  // spare-part-photo.actions.ts), so there is no per-photograph edit to log.
  | "SPARE_PART_PHOTOS_UPLOADED"
  | "SPARE_PART_PHOTOS_REORDERED"
  | "SPARE_PART_PHOTO_DELETED"
  | "SPARE_PART_PRIMARY_PHOTO_CHANGED"
  // Fitment is a public claim about what a part goes on, and the one thing in
  // this domain that is genuinely hard-deleted (see
  // spare-part-compatibility.actions.ts). These two entries are therefore the
  // only record that a claim was ever made or withdrawn, which is exactly the
  // question asked when a customer says they were told a part would fit.
  | "SPARE_PART_FITMENT_ADDED"
  | "SPARE_PART_FITMENT_REMOVED"
  // ── Quotes ──────────────────────────────────────────────────────────
  // A quote request itself is created by an anonymous customer and has no
  // admin actor, so it is never audited here; Quote.createdAt is its record.
  // Everything an operator then does to it is.
  | "QUOTE_DETAILS_UPDATED"
  | "QUOTE_STATUS_CHANGED"
  | "QUOTE_SENT"
  // The customer's PDF link is a bearer credential; minting and revoking it
  // are recorded like any other grant of access.
  | "QUOTE_LINK_CREATED"
  | "QUOTE_LINK_REVOKED"
  | "QUOTE_CONVERTED"
  // ── Orders and money ────────────────────────────────────────────────
  | "ORDER_CREATED"
  | "ORDER_CANCELLED"
  // Derived moves — deposit confirmed, awaiting final payment, completed —
  // recorded with the payment or tracking change that caused them.
  | "ORDER_STATUS_CHANGED"
  | "ORDER_DELIVERY_DATE_UPDATED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_REVERSED"
  // Stock taken off the shelf by an order, and put back by a cancellation.
  | "SPARE_PART_STOCK_RESERVED"
  | "SPARE_PART_STOCK_RELEASED"
  // ── Shipments and tracking ──────────────────────────────────────────
  | "SHIPMENT_CREATED"
  | "TRACKING_EVENT_ADDED"
  | "TRACKING_EVENT_VOIDED"

export type AuditEntityType =
  | "AdminProfile"
  | "BusinessSettings"
  | "Vehicle"
  | "SparePart"
  | "SparePartCompatibility"
  | "Quote"
  | "Order"
  | "Payment"
  | "Shipment"
  | "TrackingEvent"

export interface AuditLogEntry {
  actorId: string
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  metadata?: Prisma.InputJsonValue
}

/**
 * Records an administrative action.
 *
 * Pass `tx` when the action being recorded is itself transactional — every
 * financial mutation should, so that a committed payment confirmation and
 * its audit row can never exist without each other. Auth events have no
 * such transaction and use the default client.
 */
export async function recordAuditLog(
  entry: AuditLogEntry,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
    },
  })
}

/**
 * Records an administrative action without letting an audit failure take
 * down the action itself.
 *
 * Only for events that are independently recorded elsewhere. Sign-in and
 * sign-out qualify: Supabase Auth logs every authentication event on its
 * side, so a transient database error here degrades the convenience of
 * having the event in our own table — it does not create an unrecorded
 * action. Financial mutations do NOT qualify and must use `recordAuditLog`
 * inside their transaction, where a failure correctly rolls the whole thing
 * back.
 *
 * The failure is surfaced loudly rather than swallowed; an empty catch here
 * would be exactly the silent failure CLAUDE.md rule 13 prohibits.
 */
export async function recordAuditLogBestEffort(entry: AuditLogEntry): Promise<void> {
  try {
    await recordAuditLog(entry)
  } catch (error) {
    console.error(
      `[audit] failed to record ${entry.action} for actor ${entry.actorId}`,
      error
    )
  }
}

/**
 * Structured log line for security-relevant events that have no admin actor
 * to attribute — chiefly failed sign-in attempts.
 *
 * Deliberately not the database: see the note at the top of this file. When
 * Sentry lands (Stage 39) this becomes its natural forwarding point.
 *
 * Never pass a password, token, session cookie or full email address. The
 * caller is expected to redact first (see `redactEmail`), because an
 * authentication log is one of the classic places personal data leaks into
 * a system that retains it far longer than the application does
 * (SECURITY.MD §38).
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, string | number | boolean> = {}
): void {
  console.warn(`[security] ${event}`, details)
}

/**
 * Reduces an email to something diagnosable but not personally identifying:
 * `santos@example.com` → `s***@example.com`.
 *
 * Enough to correlate repeated attempts against one account and to spot a
 * spray across many, without writing customer or staff addresses into log
 * storage.
 */
export function redactEmail(email: string): string {
  const at = email.indexOf("@")

  if (at <= 0) {
    return "***"
  }

  return `${email[0]}***${email.slice(at)}`
}
