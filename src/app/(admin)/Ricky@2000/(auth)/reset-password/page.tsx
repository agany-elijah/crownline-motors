import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AdminAuthShell } from "@/components/admin/admin-auth-shell"
import { AdminResetPasswordForm } from "@/components/admin/admin-reset-password-form"
import { getSessionUser } from "@/lib/auth/dal"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

export const metadata: Metadata = {
  title: "Set a New Password",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function AdminResetPasswordPage() {
  /**
   * Gated on a *session*, not on an admin profile.
   *
   * At this point the caller arrived from /auth/confirm, which exchanged a
   * one-time recovery token for a session. That is the proof of identity
   * this page needs. The admin-profile check still happens — in
   * updatePasswordAction, before anything is written — which is where it
   * belongs, since the action is a public endpoint reachable without ever
   * loading this page.
   */
  const user = await getSessionUser()

  if (!user) {
    redirect(`${ADMIN_BASE_PATH}/login?error=invalid_link`)
  }

  return (
    <AdminAuthShell
      title="Set a new password"
      footer={
        <Link
          href={`${ADMIN_BASE_PATH}/login`}
          className="underline underline-offset-4 transition-colors duration-fast hover:text-gold-ink"
        >
          Back to sign in
        </Link>
      }
    >
      <AdminResetPasswordForm />
    </AdminAuthShell>
  )
}
