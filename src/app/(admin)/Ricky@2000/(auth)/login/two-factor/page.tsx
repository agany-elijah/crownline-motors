import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminAuthShell } from "@/components/admin/admin-auth-shell"
import { TwoFactorSignInForm } from "@/components/admin/security/two-factor-forms"
import { signOutAction } from "@/lib/actions/auth.actions"
import { getAdminAccess } from "@/lib/auth/dal"
import { ADMIN_LOGIN_PATH, isSafeReturnPath } from "@/lib/auth/return-path"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

export const metadata: Metadata = {
  title: "Two-factor authentication",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

/**
 * The second step of signing in, for an administrator with two-factor
 * authentication. Reachable only with a password-authenticated session that
 * still needs its code; anyone else is sent where they belong.
 */
export default async function TwoFactorChallengePage(props: PageProps<"/Ricky@2000/login/two-factor">) {
  const access = await getAdminAccess()
  const { next: rawNext } = await props.searchParams
  const next = typeof rawNext === "string" && isSafeReturnPath(rawNext) ? rawNext : undefined

  if (access.status === "OK" || access.status === "TWO_FACTOR_SETUP_REQUIRED") redirect(next ?? ADMIN_BASE_PATH)
  if (access.status !== "TWO_FACTOR_REQUIRED") redirect(ADMIN_LOGIN_PATH)

  return (
    <AdminAuthShell
      title="Enter your code"
      footer={
        <form action={signOutAction}>
          <button type="submit" className="underline underline-offset-4 transition-colors duration-fast hover:text-gold-ink">
            Use a different account
          </button>
        </form>
      }
    >
      <p className="mb-6 text-small text-muted-foreground">
        Open your authenticator app and enter the six-digit code for {access.admin.email}.
      </p>
      <TwoFactorSignInForm next={next} />
    </AdminAuthShell>
  )
}
