import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { AdminMobileNav } from "@/components/admin/admin-mobile-nav"
import { AdminSignOutButton } from "@/components/admin/admin-sign-out-button"
import { ADMIN_ROLE_LABELS } from "@/lib/auth/permissions"
import type { AdminNavGroup } from "@/lib/constants/admin-nav"
import type { AdminProfileDTO } from "@/lib/auth/dal"

interface AdminTopBarProps {
  admin: AdminProfileDTO
  navGroups: AdminNavGroup[]
}

/**
 * The bar across the top of every dashboard page.
 *
 * A Server Component: it renders the signed-in administrator's name, and the
 * only interactive parts — the mobile drawer and the sign-out form — are
 * their own client components. Keeping the bar itself on the server means
 * the profile never has to be serialised into a client bundle just to be
 * displayed.
 *
 * `admin` is a DTO from the DAL, not a Prisma row (see dal.ts). Adding a
 * sensitive column to AdminProfile must not silently start rendering it
 * here, and that is what the explicit DTO prevents.
 *
 * The "View site" link is deliberate: an operator who has just published a
 * vehicle wants to see it the way a customer will, and making them retype
 * the URL is the sort of small friction that stops people checking their own
 * work.
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
        className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-small text-muted-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex"
      >
        View site
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </Link>

      <div className="hidden flex-col items-end leading-tight sm:flex">
        <span className="text-small font-semibold">{admin.displayName}</span>
        <span className="text-xs text-muted-foreground">
          {ADMIN_ROLE_LABELS[admin.role]}
        </span>
      </div>

      <AdminSignOutButton />
    </header>
  )
}
