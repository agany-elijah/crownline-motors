"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Car,
  FileText,
  Package,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  isAdminNavLinkActive,
  isAdminNavLinkAvailable,
  type AdminNavGroup,
  type AdminNavIcon,
} from "@/lib/constants/admin-nav"

/**
 * Icon names are resolved here rather than stored in admin-nav.ts, because
 * that module is imported by the server layout to filter entries by
 * permission — and importing a component library into a server module to
 * hold a reference to an icon would pull the whole of lucide into that
 * boundary for no reason. The constant file stays serialisable data; this
 * file owns the rendering.
 */
const ICONS: Record<AdminNavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  vehicles: Car,
  spareParts: Wrench,
  quotes: FileText,
  orders: Package,
  customers: Users,
  settings: Settings,
}

interface AdminNavProps {
  /** Already filtered by permission on the server. */
  groups: AdminNavGroup[]
  /** Called after a link is chosen, so the mobile drawer can close itself. */
  onNavigate?: () => void
}

/**
 * The dashboard's navigation list.
 *
 * One component serves both the fixed desktop rail and the mobile drawer.
 * They differ only in the container around them, and duplicating the list
 * would guarantee the two drift — a section added to one and forgotten in
 * the other is the classic version of that bug.
 *
 * `aria-current="page"` marks the active entry for screen readers; the gold
 * needle, the raised background and the gold icon are the visual half of the
 * same signal, never the only half.
 *
 * Painted with the `rail-*` tokens rather than the page's own, because the
 * rail stays dark in both dashboard themes.
 */
export function AdminNav({ groups, onNavigate }: AdminNavProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-7">
      {groups.map((group, groupIndex) => (
        <div key={group.title ?? `group-${groupIndex}`} className="flex flex-col gap-1">
          {group.title ? (
            <h2 className="px-3 pb-1 text-meta text-rail-subtle uppercase">{group.title}</h2>
          ) : null}

          <ul className="flex flex-col gap-0.5">
            {group.links.map((link) => {
              const Icon = ICONS[link.icon]
              const active = isAdminNavLinkActive(link.href, pathname)

              // Routed but not built yet. Rendered as inert text with a
              // "Soon" marker rather than a link to an empty screen —
              // matching how the public navigation treats Spare Parts.
              if (!isAdminNavLinkAvailable(link)) {
                return (
                  <li key={link.href}>
                    <span
                      className="flex h-9 items-center gap-3 rounded-md px-3 text-small text-rail-subtle"
                      aria-disabled="true"
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                      <span className="flex-1">{link.label}</span>
                      <span className="rounded-full border border-rail-border px-1.5 text-[0.625rem] font-medium text-rail-subtle">
                        Soon
                      </span>
                    </span>
                  </li>
                )
              }

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group/nav relative flex h-9 items-center gap-3 rounded-md px-3 text-small font-medium",
                      "transition-colors duration-fast ease-crownline",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                      active
                        ? "bg-rail-raised text-rail-foreground"
                        : "text-rail-muted hover:bg-rail-raised/55 hover:text-rail-foreground"
                    )}
                  >
                    {/* The gold needle at the rail's inner edge. Decorative —
                        aria-current carries the same meaning for anyone not
                        seeing it. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute top-1/2 -left-3 h-4 w-0.75 -translate-y-1/2 rounded-r-full bg-gold",
                        "origin-left transition-[opacity,scale] duration-fast ease-crownline",
                        active ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
                      )}
                    />
                    <Icon
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className={cn(
                        "size-4 shrink-0 transition-colors duration-fast",
                        active ? "text-gold" : "text-rail-subtle group-hover/nav:text-rail-foreground"
                      )}
                    />
                    <span className="truncate">{link.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
