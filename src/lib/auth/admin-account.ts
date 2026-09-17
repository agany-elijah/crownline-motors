import "server-only"

import { recordAuditLog } from "@/lib/audit"
import { prisma } from "@/lib/prisma"

/**
 * Brings AdminProfile.email into line with the address Supabase Auth holds.
 *
 * An email change is confirmed by the administrator following links in
 * their inbox, and it is Supabase that switches the address. Our copy is what
 * the password-reset form and the staff alerts use, so it follows — from the
 * confirmation callback, and as a fallback whenever the account page notices
 * the two disagree. Idempotent: a matching address writes nothing.
 *
 * Never throws. The change has already happened in Supabase; a failed copy
 * is logged and retried on the next visit to the account page.
 */
export async function syncAdminEmail(adminId: string, authEmail: string): Promise<void> {
  const email = authEmail.trim().toLowerCase()
  if (email.length === 0) return

  try {
    await prisma.$transaction(async (tx) => {
      const profile = await tx.adminProfile.findUnique({ where: { id: adminId }, select: { email: true } })
      if (!profile || profile.email === email) return

      await tx.adminProfile.update({ where: { id: adminId }, data: { email } })

      await recordAuditLog(
        {
          actorId: adminId,
          action: "ADMIN_EMAIL_CHANGED",
          entityType: "AdminProfile",
          entityId: adminId,
          metadata: { changes: [{ field: "Email", from: profile.email, to: email }] },
        },
        tx
      )
    })
  } catch (error) {
    console.error("[account] failed to record a confirmed email change", error)
  }
}
