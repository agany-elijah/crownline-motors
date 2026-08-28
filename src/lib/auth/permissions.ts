import type { AdminRole } from "@/generated/prisma/enums"

/**
 * The administrative permission matrix.
 *
 * Pure data and pure functions — no session, no database, no Next.js. That
 * keeps "who may do what" exhaustively unit-testable and in one readable
 * place, instead of scattered across route handlers as ad-hoc role
 * comparisons.
 *
 * ── Wave A has exactly one role ───────────────────────────────────────
 * ADMIN holds every permission. Crownline launches with a single operator,
 * and separation of duties is only meaningful when there are two people to
 * separate — a MANAGER/STAFF split with one person filling both would have
 * been governance theatre, and an extra step on every screen for no gain.
 * The roadmap allows exactly this (Stage 6: "Initially, you may only need
 * ADMIN, CUSTOMER").
 *
 * ── Why the layer survives the simplification ─────────────────────────
 * The obvious next step — delete this file, replace `requirePermission(...)`
 * with a plain "is signed in" check — is the one thing that would make roles
 * genuinely expensive to reintroduce, and Stage 6 asks that the architecture
 * "not make staff roles difficult later". So the indirection stays: every
 * page and action names the permission it needs, and this file maps roles to
 * permissions. Today that map has one row.
 *
 * ── Reintroducing roles later ─────────────────────────────────────────
 * Three steps, none of them a rewrite:
 *   1. Add the value to `enum AdminRole` in schema.prisma — an additive
 *      `ALTER TYPE ... ADD VALUE` in Postgres, safe on existing rows.
 *   2. Add its permission list to ROLE_PERMISSIONS below. The
 *      `Record<AdminRole, ...>` type makes omitting it a compile error.
 *   3. Add a label to ADMIN_ROLE_LABELS — likewise compiler-enforced.
 * No call site changes, because no call site names a role.
 *
 * The natural first split, when a second person joins, is to move the
 * money-moving permissions — `payment:verify`, `payment:refund`,
 * `order:cancel`, `quote:accept`, `settings:write`, `admin:manage` — out of
 * a day-to-day role and leave the rest. They are grouped below with that in
 * mind.
 */

export const ADMIN_PERMISSIONS = [
  // Vehicles (Phase 5)
  "vehicle:read",
  "vehicle:write",
  "vehicle:publish",
  "vehicle:archive",

  // Quotes (Phase 10)
  "quote:read",
  "quote:respond",
  "quote:accept",

  // Orders (Phase 11)
  "order:read",
  "order:write",
  "order:cancel",

  // Payments (Phase 12)
  "payment:read",
  "payment:record",
  "payment:verify",
  "payment:refund",

  // Shipments and tracking (Phases 13–14)
  "tracking:read",
  "tracking:write",
  "tracking:void",

  // Customers (Phase 10) — customer:erase is the right-to-be-forgotten
  // scrub described in the schema documentation, not a hard delete
  "customer:read",
  "customer:write",
  "customer:erase",

  // Business configuration
  "settings:read",
  "settings:write",

  // Administrators and the audit trail
  "admin:read",
  "admin:manage",
  "audit:read",
] as const

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

/**
 * Role → permissions.
 *
 * Typed as a complete Record over AdminRole, so adding a role to the Prisma
 * enum without deciding what it may do fails the build rather than silently
 * granting nothing (or, worse, being missed until someone hits a blank page).
 */
const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  ADMIN: new Set(ADMIN_PERMISSIONS),
}

/** Does this role hold this permission? The only place that question is answered. */
export function can(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission)
}

/** Every permission a role holds. For rendering navigation, not for enforcement. */
export function permissionsFor(role: AdminRole): readonly AdminPermission[] {
  return ADMIN_PERMISSIONS.filter((permission) => can(role, permission))
}

/**
 * Human-readable role labels for admin UI.
 *
 * Kept beside the matrix so a new role cannot be added to the enum without
 * this failing to compile — an omission becomes a type error rather than a
 * blank badge discovered in production.
 */
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Administrator",
}
