"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  Building2,
  CreditCard,
  LayoutGrid,
  Palette,
  Search,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  isSettingsLinkActive,
  type SettingsNavIcon,
  type SettingsNavLink,
} from "@/lib/constants/settings-nav"

const ICONS: Record<SettingsNavIcon, LucideIcon> = {
  business: Building2,
  branding: Palette,
  commerce: CreditCard,
  tracking: Truck,
  catalog: LayoutGrid,
  notifications: Bell,
  seo: Search,
  security: ShieldCheck,
}

/**
 * The Settings section list.
 *
 * A quiet text rail beside the content from `lg` — the whole map of what is
 * configurable, visible while editing one part of it. Below `lg` it becomes a
 * single scrolling row of tabs under the title: one line tall, so the form
 * starts near the top of a phone screen instead of under a block of pills.
 * The active tab is scrolled into view, so arriving on the last section does
 * not leave its tab off-screen.
 */
export function SettingsNav({ links }: { links: SettingsNavLink[] }) {
  const pathname = usePathname()
  const rowRef = React.useRef<HTMLUListElement>(null)

  React.useEffect(() => {
    const row = rowRef.current
    const active = row?.querySelector<HTMLElement>('[aria-current="page"], [data-active="true"]')
    if (!row || !active) return
    // Scrolls the row only — `scrollIntoView` would also move the page.
    row.scrollTo({ left: active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2, behavior: "instant" })
  }, [pathname])

  return (
    <nav aria-label="Settings" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      {/* ── Phone and tablet: one scrolling row of tabs ───────────── */}
      <ul
        ref={rowRef}
        className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto border-b border-border px-4 sm:-mx-6 sm:px-6 lg:hidden"
      >
        {links.map((link) => {
          const active = isSettingsLinkActive(link, pathname)

          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center text-small whitespace-nowrap transition-colors duration-fast",
                  active
                    ? "font-medium text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-gold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* ── Desktop: the rail ─────────────────────────────────────── */}
      <ul className="hidden flex-col gap-px lg:flex">
        {links.map((link) => {
          const active = isSettingsLinkActive(link, pathname)
          const Icon = ICONS[link.icon]

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active && !link.children ? "page" : undefined}
                data-active={active}
                className={cn(
                  "group/item flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-small",
                  "transition-colors duration-fast ease-crownline",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0 transition-colors duration-fast",
                    active ? "text-foreground" : "text-muted-foreground group-hover/item:text-foreground"
                  )}
                />
                <span className="truncate">{link.label}</span>
              </Link>

              {link.children && active ? (
                <ul className="my-1 ml-[1.1rem] flex flex-col border-l border-border pl-2.5">
                  {link.children.map((child) => {
                    const childActive = pathname === child.href

                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          className={cn(
                            "block truncate rounded-md px-2 py-1.5 text-small transition-colors duration-fast",
                            childActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * The security sub-sections as a scrolling row of small chips, shown above
 * security pages below `lg` where the rail — and with it the nested list — is
 * not rendered. Chips rather than a second row of underlined tabs, so the two
 * rows read as a section and its pages rather than as two competing menus.
 */
export function SecuritySubNav({ links }: { links: { label: string; href: string }[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Security settings" className="min-w-0 lg:hidden">
      <ul className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        {links.map((link) => {
          const active = pathname === link.href
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-full px-3 text-xs whitespace-nowrap transition-colors duration-fast",
                  active
                    ? "bg-foreground font-medium text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
