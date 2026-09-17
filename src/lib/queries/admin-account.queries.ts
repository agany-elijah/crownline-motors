import "server-only"

import { prisma } from "@/lib/prisma"

/**
 * The signed-in administrator's own account record, for the security pages.
 * Callers pass the id from the verified session — never one from a request.
 */
export interface AdminAccountDetails {
  createdAt: Date
  twoFactorEnabledAt: Date | null
  isActive: boolean
}

export async function getAdminAccountDetails(adminId: string): Promise<AdminAccountDetails | null> {
  return prisma.adminProfile.findUnique({
    where: { id: adminId },
    select: { createdAt: true, twoFactorEnabledAt: true, isActive: true },
  })
}
