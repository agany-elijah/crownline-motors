import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { AdminMobileNav } from "@/components/admin/admin-mobile-nav"
import { AdminProfileMenu } from "@/components/admin/admin-profile-menu"
import { buttonVariants } from "@/components/ui/button"
import { ADMIN_ROLE_LABELS } from "@/lib/auth/permissions"
import type { AdminNavGroup } from "@/lib/constants/admin-nav"
import type { AdminProfileDTO } from "@/lib/auth/dal"
import { cn } from "@/lib/utils"

interface AdminTopBarProps {
  admin: AdminProfileDTO
  navGroups: AdminNavGroup[]
}

/**
 * The bar across the top of every dashboard page: the drawer trigger below
 * `lg`, and on the right exactly two things — View site, and the
 * administrator's avatar, which opens their account menu (name, role,
 * account settings, theme, sign out).
 *
 * "View site" stays on phones, compact, because an operator who has just
 * published a vehicle wants to see it the way a customer will, and a phone is
 * where most of those customers are.
 *
 * `admin` is a DTO from the DAL, not a Prisma row, so adding a sensitive
 * column to AdminProfile cannot silently start rendering it here.
 */
export function AdminTopBar({ admin, navGroups }: AdminTopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <AdminMobileNav groups={navGroups} />

      <div className="flex-1" />

      <Link
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-9 gap-1.5 rounded-full px-3.5 shadow-none"
        )}
      >
        View site
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
        <span className="sr-only">(opens in a new tab)</span>
      </Link>

      <AdminProfileMenu name={admin.displayName} email={admin.email} roleLabel={ADMIN_ROLE_LABELS[admin.role]} />
    </header>
  )
}
