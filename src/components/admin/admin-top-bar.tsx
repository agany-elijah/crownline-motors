import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs"
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav"
import { AdminProfileMenu } from "@/components/admin/admin-profile-menu"
import { ADMIN_ROLE_LABELS } from "@/lib/auth/permissions"
import type { AdminNavGroup } from "@/lib/constants/admin-nav"
import type { AdminProfileDTO } from "@/lib/auth/dal"

interface AdminTopBarProps {
  admin: AdminProfileDTO
  navGroups: AdminNavGroup[]
}

/**
 * The bar across the top of every dashboard page: the drawer trigger below
 * `lg`, where the operator is, and on the right the administrator's avatar,
 * which opens their account menu (name, role, account settings, theme, sign
 * out).
 *
 * "View site" stays in the bar at every width, compact, because an operator
 * who has just published a vehicle wants to see it the way a customer will,
 * and a phone is where most of those customers are.
 *
 * `admin` is a DTO from the DAL, not a Prisma row, so adding a sensitive
 * column to AdminProfile cannot silently start rendering it here.
 */
export function AdminTopBar({ admin, navGroups }: AdminTopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/70 sm:px-6 lg:px-8">
      <AdminMobileNav groups={navGroups} />

      <AdminBreadcrumbs groups={navGroups} className="flex-1" />

      <Link
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-small font-medium text-foreground transition-colors duration-fast hover:border-foreground/20 hover:bg-secondary"
      >
        View site
        <ArrowUpRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <span className="sr-only">(opens in a new tab)</span>
      </Link>

      <AdminProfileMenu name={admin.displayName} email={admin.email} roleLabel={ADMIN_ROLE_LABELS[admin.role]} />
    </header>
  )
}
