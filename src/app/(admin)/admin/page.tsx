import type { Metadata } from "next"

import { AdminSignOutButton } from "@/components/admin/admin-sign-out-button"
import { BrandMark } from "@/components/layout/brand-mark"
import { Container } from "@/components/layout/container"
import { requireAdmin } from "@/lib/auth/admin-guard"
import { ADMIN_ROLE_LABELS, permissionsFor } from "@/lib/auth/permissions"

export const metadata: Metadata = {
  title: "Dashboard",
}

/**
 * Administrator dashboard landing page.
 *
 * Intentionally spare. Stage 7 builds the real dashboard shell — sidebar,
 * navigation, metric tiles — and the sections behind it arrive with their
 * own phases. What this page does now is prove the Phase 3 chain end to
 * end: a session exists, it resolves to an active AdminProfile, the role is
 * read from our own database rather than from a client-controlled claim,
 * and there is a working way back out.
 *
 * The permission list is shown because it is genuinely useful while roles
 * are being assigned — it answers "what can this account actually do?"
 * without reading the matrix in source. It is the caller's own permissions
 * only, never another account's.
 */
export default async function AdminDashboardPage() {
  const admin = await requireAdmin()
  const permissions = permissionsFor(admin.role)

  return (
    <main className="min-h-dvh py-10">
      <Container>
        <div className="flex flex-col gap-8">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
            <div className="flex flex-col gap-3">
              <BrandMark size="sm" />
              <div className="flex flex-col gap-1">
                <h1 className="font-heading text-h2 font-semibold">Dashboard</h1>
                <p className="text-body text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-semibold text-foreground">
                    {admin.displayName}
                  </span>{" "}
                  · {ADMIN_ROLE_LABELS[admin.role]}
                </p>
              </div>
            </div>

            <AdminSignOutButton />
          </header>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-h3 font-semibold">Your permissions</h2>
            <p className="text-small text-muted-foreground">
              What this account may do. Roles are set by a super admin.
            </p>
            <ul className="flex flex-wrap gap-2 pt-1">
              {permissions.map((permission) => (
                <li
                  key={permission}
                  className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-xs text-muted-foreground"
                >
                  {permission}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
            <h2 className="font-heading text-h3 font-semibold">Next</h2>
            <p className="text-body text-muted-foreground">
              Authentication and authorisation are in place. The dashboard shell,
              vehicle inventory, quotes, orders, payments and tracking are built in
              the phases that follow.
            </p>
          </section>
        </div>
      </Container>
    </main>
  )
}
