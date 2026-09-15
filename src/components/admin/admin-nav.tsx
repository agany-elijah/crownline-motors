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
 * rail and background are the visual half of the same signal, never the
 * only half.
 */
export function AdminNav({ groups, onNavigate }: AdminNavProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-6">
      {groups.map((group, groupIndex) => (
        <div key={group.title ?? `group-${groupIndex}`} className="flex flex-col gap-1">
          {group.title ? (
            <h2 className="px-3 pb-1 font-heading text-[0.625rem] font-bold tracking-[0.18em] text-background/65 uppercase">
              {group.title}
            </h2>
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
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-small text-background/55"
                      aria-disabled="true"
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="flex-1">{link.label}</span>
                      <span className="rounded-4xl border border-white/25 px-1.5 py-0.5 text-[0.5625rem] font-semibold tracking-[0.08em] text-background/60 uppercase">
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
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-small font-medium",
                      "transition-colors duration-fast",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                      active
                        ? "bg-white/10 text-background"
                        : "text-background/75 hover:bg-white/5 hover:text-background"
                    )}
                  >
                    {/* The gold rail. Decorative — aria-current carries the
                        same meaning for anyone not seeing it. */}
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-1.5 bottom-1.5 -left-px w-0.5 rounded-r bg-gold"
                      />
                    ) : null}
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {link.label}
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
