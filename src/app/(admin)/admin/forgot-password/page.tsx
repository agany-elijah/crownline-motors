import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AdminAuthShell } from "@/components/admin/admin-auth-shell"
import { AdminForgotPasswordForm } from "@/components/admin/admin-forgot-password-form"
import { getAdminProfile } from "@/lib/auth/dal"

export const metadata: Metadata = {
  title: "Reset Staff Password",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function AdminForgotPasswordPage() {
  // An administrator with a live session has no business here — they can
  // change their password from inside the dashboard, where they are already
  // proven to be who they say they are.
  const admin = await getAdminProfile()
  if (admin) {
    redirect("/admin")
  }

  return (
    <AdminAuthShell
      title="Reset your password"
      description="We will email a single-use link to the address on your staff account."
      footer={
        <Link
          href="/admin/login"
          className="underline underline-offset-4 transition-colors duration-fast hover:text-gold-ink"
        >
          Back to sign in
        </Link>
      }
    >
      <AdminForgotPasswordForm />
    </AdminAuthShell>
  )
}
