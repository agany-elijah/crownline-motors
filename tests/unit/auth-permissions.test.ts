import { describe, expect, it } from "vitest"

import { AdminRole } from "@/generated/prisma/enums"
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLE_LABELS,
  can,
  permissionsFor,
  type AdminPermission,
} from "@/lib/auth/permissions"

/**
 * Wave A has a single role, so these tests cannot assert a separation of
 * duties that does not exist yet. What they can do — and what matters while
 * the matrix is trivial — is pin the two properties that make reintroducing
 * roles cheap later:
 *
 *   1. The matrix is complete and self-consistent, so `can()` is the single
 *      answer to "may this role do this" rather than one of several.
 *   2. Every role in the Prisma enum is covered. That is what turns adding a
 *      role into a compile error somebody must resolve, instead of a silent
 *      grant of nothing.
 *
 * When a second role lands, this file is where the split gets asserted —
 * the money-moving permissions in particular.
 */
describe("permission matrix", () => {
  it("grants ADMIN every permission", () => {
    for (const permission of ADMIN_PERMISSIONS) {
      expect(can(AdminRole.ADMIN, permission)).toBe(true)
    }
  })

  it("covers every role defined in the Prisma enum", () => {
    // Guards the case that would otherwise be discovered in production: a
    // role added to schema.prisma but never given permissions. The Record
    // type catches it at compile time; this catches it if that type is ever
    // loosened.
    for (const role of Object.values(AdminRole)) {
      expect(() => permissionsFor(role)).not.toThrow()
      expect(permissionsFor(role).length).toBeGreaterThan(0)
    }
  })

  it("has no duplicate permission names", () => {
    expect(new Set(ADMIN_PERMISSIONS).size).toBe(ADMIN_PERMISSIONS.length)
  })

  it("labels every role", () => {
    for (const role of Object.values(AdminRole)) {
      expect(ADMIN_ROLE_LABELS[role]).toBeTruthy()
    }
  })

  it("still carries the permissions a future split would divide", () => {
    // Wave A collapsed the roles; it did not delete the vocabulary. These
    // are the money-moving and access-granting permissions that a
    // day-to-day role would NOT hold once a second person joins. If a
    // future cleanup deletes them as "unused", the split becomes a rewrite
    // rather than an edit — which is exactly what Stage 6 asks us to avoid.
    const wouldBeRestricted: AdminPermission[] = [
      "payment:verify",
      "payment:refund",
      "order:cancel",
      "quote:accept",
      "settings:write",
      "admin:manage",
    ]

    for (const permission of wouldBeRestricted) {
      expect(ADMIN_PERMISSIONS).toContain(permission)
      expect(can(AdminRole.ADMIN, permission)).toBe(true)
    }
  })
})

describe("permissionsFor", () => {
  it("returns exactly the permissions can() agrees with", () => {
    for (const role of Object.values(AdminRole)) {
      const granted = new Set<AdminPermission>(permissionsFor(role))

      for (const permission of ADMIN_PERMISSIONS) {
        expect(granted.has(permission)).toBe(can(role, permission))
      }
    }
  })
})
