import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertCircle, CheckCircle2 } from "lucide-react"

import { AdminAuthShell } from "@/components/admin/admin-auth-shell"
import { AdminLoginForm } from "@/components/admin/admin-login-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getAdminAccess } from "@/lib/auth/dal"
import { ADMIN_TWO_FACTOR_CHALLENGE_PATH, isSafeReturnPath } from "@/lib/auth/return-path"
import { TWO_FACTOR_SETTINGS_PATH } from "@/lib/constants/settings-nav"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

export const metadata: Metadata = {
  title: "Staff Sign In",
  // Belt and braces with robots.ts. robots.txt is a crawler convention, not
  // an access control (SECURITY.MD §46) — the actual protection is the DAL.
  // This simply keeps the staff entrance out of search results.
  robots: { index: false, follow: false },
}

/**
 * The session state of the caller decides what this page renders, so it can
 * never be prerendered or served from a shared cache. Without this, one
 * visitor's rendered output could be handed to the next (SECURITY.MD §47).
 */
export const dynamic = "force-dynamic"

export default async function AdminLoginPage(props: PageProps<"/Ricky@2000/login">) {
  const searchParams = await props.searchParams

  // Already signed in and still an active administrator? There is nothing to
  // do here. Leaving the form reachable invites an admin to re-authenticate
  // needlessly, which is a small phishing-training hazard of its own.
  const access = await getAdminAccess()
  if (access.status === "OK") redirect(ADMIN_BASE_PATH)
  // Password already accepted: the next step is the code, not this form.
  if (access.status === "TWO_FACTOR_REQUIRED") redirect(ADMIN_TWO_FACTOR_CHALLENGE_PATH)
  if (access.status === "TWO_FACTOR_SETUP_REQUIRED") redirect(`${TWO_FACTOR_SETTINGS_PATH}?required=1`)

  const rawNext = typeof searchParams.next === "string" ? searchParams.next : undefined
  // Filtered here as well as in the action. The action's check is the one
  // that matters for security; this one stops an unusable value being
  // round-tripped through the form at all.
  const next = rawNext && isSafeReturnPath(rawNext) ? rawNext : undefined

  const linkError = searchParams.error === "invalid_link"

  // Set by updatePasswordAction, which signs every session out after a
  // password change (SECURITY.MD §42). Without this the administrator would
  // land on a bare login form seconds after setting a password and
  // reasonably conclude it had not worked.
  const passwordUpdated = searchParams.notice === "password_updated"

  // Why an administrator is back here without having signed out themselves.
  const sessionNotice =
    searchParams.notice === "session_expired"
      ? "Your session reached its time limit. Sign in again to continue."
      : searchParams.notice === "session_ended"
        ? "This session was signed out from another device. Sign in again to continue."
        : searchParams.notice === "signed_out_everywhere"
          ? "You have been signed out of every session."
          : null

  return (
    <AdminAuthShell
      title="Sign in"
      footer={
        <Link
          href={`${ADMIN_BASE_PATH}/forgot-password`}
          className="underline underline-offset-4 transition-colors duration-fast hover:text-gold-ink"
        >
          Forgotten your password?
        </Link>
      }
    >
      {passwordUpdated ? (
        <Alert className="mb-5">
          <CheckCircle2 aria-hidden="true" className="text-gold-ink" />
          <AlertDescription>
            Password updated. Sign in with your new password.
          </AlertDescription>
        </Alert>
      ) : null}

      {sessionNotice ? (
        <Alert className="mb-5">
          <CheckCircle2 aria-hidden="true" className="text-gold-ink" />
          <AlertDescription>{sessionNotice}</AlertDescription>
        </Alert>
      ) : null}

      {linkError ? (
        <Alert variant="destructive" className="mb-5">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>
            That link is no longer valid. Request a new one below.
          </AlertDescription>
        </Alert>
      ) : null}

      <AdminLoginForm next={next} />
    </AdminAuthShell>
  )
}
