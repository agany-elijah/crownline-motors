import type { Metadata } from "next"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth/admin-guard"
import { ADMIN_ROLE_LABELS } from "@/lib/auth/permissions"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

export const metadata: Metadata = {
  title: "Access Denied",
  robots: { index: false, follow: false },
}

/**
 * Where `requirePermission` sends an administrator who is signed in but
 * lacks the permission for the page they asked for.
 *
 * Kept separate from the login redirect on purpose. Bouncing an
 * authenticated staff member to a sign-in form reads as "your session
 * expired", so they sign in again, land back on the same wall, and repeat —
 * a loop with no exit and no explanation. Saying plainly that the account
 * lacks the permission tells them the one useful thing: who to ask.
 *
 * It sits inside the dashboard shell rather than standing alone, so the
 * sidebar is right there to move on with. A dead-end page for a recoverable
 * situation is its own small failure.
 *
 * `requireAdmin` still runs, so an anonymous visitor who guesses this URL
 * gets the login page rather than confirmation that the admin area exists
 * in this shape.
 *
 * With Wave A's single ADMIN role this page is unreachable in practice —
 * every permission is held. It stays because the alternative is discovering
 * it is missing on the day a restricted role is introduced.
 */
export default async function AdminForbiddenPage() {
  const admin = await requireAdmin()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"
        >
          <ShieldAlert className="size-7" />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-h2 font-semibold">Access denied</h1>
          <p className="text-body text-muted-foreground">
            Your account does not have permission to open that page. You are signed
            in as{" "}
            <span className="font-semibold text-foreground">{admin.displayName}</span>{" "}
            ({ADMIN_ROLE_LABELS[admin.role]}).
          </p>
          <p className="text-small text-muted-foreground">
            If you need access, ask a Crownline Motors administrator to review your
            role.
          </p>
        </div>

        <Button render={<Link href={ADMIN_BASE_PATH} />} size="lg">
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}
