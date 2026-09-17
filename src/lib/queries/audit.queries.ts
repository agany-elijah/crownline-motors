import "server-only"

import type { AuditAction } from "@/lib/audit"
import {
  AUDIT_CATEGORIES,
  auditActionLabel,
  type AuditCategory,
} from "@/lib/constants/audit-actions"
import { prisma } from "@/lib/prisma"
import { describeAuditChanges } from "@/lib/settings/describe-audit"
import type { SettingChange } from "@/lib/settings/audit-diff"

/**
 * Reads for Security Activity — the audit trail, newest first.
 *
 * Read-only by construction: nothing in this module writes, and the audit
 * table has no update or delete path anywhere in the application.
 */

export const AUDIT_LOG_PAGE_SIZE = 25

export interface AuditLogEntryDTO {
  id: string
  action: string
  actionLabel: string
  actorName: string
  entityType: string
  entityId: string
  changes: SettingChange[]
  createdAt: Date
}

export interface AuditLogPage {
  entries: AuditLogEntryDTO[]
  total: number
  page: number
  pageCount: number
}

export async function listAuditLog(options: {
  page?: number
  category?: AuditCategory
  actorId?: string
}): Promise<AuditLogPage> {
  const where = {
    ...(options.category
      ? { action: { in: [...AUDIT_CATEGORIES[options.category].actions] as AuditAction[] } }
      : {}),
    ...(options.actorId ? { actorId: options.actorId } : {}),
  }

  const total = await prisma.auditLog.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_LOG_PAGE_SIZE))
  // Clamped, so a stale `?page=40` shows the last page rather than an empty one.
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount)

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * AUDIT_LOG_PAGE_SIZE,
    take: AUDIT_LOG_PAGE_SIZE,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { displayName: true } },
    },
  })

  return {
    entries: rows.map((row) => ({
      id: row.id,
      action: row.action,
      actionLabel: auditActionLabel(row.action),
      actorName: row.actor.displayName,
      entityType: row.entityType,
      entityId: row.entityId,
      changes: describeAuditChanges(row.metadata),
      createdAt: row.createdAt,
    })),
    total,
    page,
    pageCount,
  }
}

/** Administrators who appear in the log, for the filter. Deactivated ones included — their history is real. */
export async function listAuditActors(): Promise<{ id: string; displayName: string }[]> {
  return prisma.adminProfile.findMany({
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  })
}

/** When this administrator last performed `action`, or null. */
export async function getLastAuditDate(actorId: string, action: AuditAction): Promise<Date | null> {
  const row = await prisma.auditLog.findFirst({
    where: { actorId, action },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  return row?.createdAt ?? null
}
