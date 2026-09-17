"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { isAdminNavLinkActive, type AdminNavGroup } from "@/lib/constants/admin-nav"
import { SETTINGS_BASE_PATH, isSettingsLinkActive, settingsNavLinks } from "@/lib/constants/settings-nav"
import { cn } from "@/lib/utils"

interface Crumb {
  label: string
  href?: string
}

/**
 * Where the operator is, in the top bar: "Commerce › Orders › Order details".
 *
 * Derived from the same navigation data the rail renders, so a section that is
 * renamed or regrouped is renamed here too. It never names a record — the page
 * heading already does, and repeating a customer's name in the chrome of every
 * screen adds nothing but width.
 *
 * Only the trail is built here. Access is still decided by each page; a crumb
 * is a link to a section the rail already offers this administrator.
 */
function buildTrail(groups: AdminNavGroup[], pathname: string): Crumb[] {
  if (pathname === ADMIN_BASE_PATH) return [{ label: "Overview" }]

  for (const group of groups) {
    const link = group.links.find((candidate) => isAdminNavLinkActive(candidate.href, pathname))
    if (!link) continue

    const trail: Crumb[] = []
    if (group.title) trail.push({ label: group.title })

    const rest = pathname.slice(link.href.length).split("/").filter(Boolean)

    if (link.href === SETTINGS_BASE_PATH) {
      const section = settingsNavLinks.find((candidate) => isSettingsLinkActive(candidate, pathname))
      trail.push({ label: link.label, href: section ? link.href : undefined })
      if (section) trail.push({ label: section.label })
      return trail
    }

    if (rest.length === 0) {
      trail.push({ label: link.label })
      return trail
    }

    trail.push({ label: link.label, href: link.href })
    trail.push({ label: rest[0] === "new" ? "New" : "Details" })
    return trail
  }

  return []
}

export function AdminBreadcrumbs({ groups, className }: { groups: AdminNavGroup[]; className?: string }) {
  const pathname = usePathname()
  const trail = buildTrail(groups, pathname)

  if (trail.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-small">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1

          return (
            // A phone shows the last two steps; the group name is the first
            // thing to give way.
            <li
              key={`${crumb.label}-${index}`}
              className={cn(
                "flex min-w-0 items-center gap-1.5",
                index < trail.length - 2 && "max-sm:hidden"
              )}
            >
              {index > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground/60",
                    index === trail.length - 2 && "max-sm:hidden"
                  )}
                />
              ) : null}
              {crumb.href && !last ? (
                <Link
                  href={crumb.href}
                  className="truncate rounded-sm text-muted-foreground transition-colors duration-fast hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn("truncate", last ? "font-medium text-foreground" : "text-muted-foreground")}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
