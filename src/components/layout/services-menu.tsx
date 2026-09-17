"use client"

import Link from "next/link"
import { NavigationMenu } from "@base-ui/react/navigation-menu"
import { ChevronDown, FileText, PackageSearch, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { NavGroup } from "@/lib/constants/nav-links"

const ICONS: Record<NavGroup["children"][number]["icon"], LucideIcon> = {
  track: PackageSearch,
  quote: FileText,
}

/**
 * A header entry that opens a small menu — "Services", holding Track My Order
 * and Get a Quote.
 *
 * Base UI's Navigation Menu rather than a hand-rolled hover panel: it opens on
 * hover *and* on click or tap, closes on Escape and on leaving, moves focus
 * with the arrow keys, and marks the trigger with `aria-expanded` — the parts
 * of a dropdown that are easy to get subtly wrong. The links inside are real
 * Next links, so they keep link semantics, prefetching and "open in new tab".
 */
export function ServicesMenu({
  group,
  pathname,
  tone,
}: {
  group: NavGroup
  pathname: string
  tone: "light" | "dark"
}) {
  const active = group.children.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`))

  return (
    <NavigationMenu.Root delay={80} closeDelay={160}>
      <NavigationMenu.List className="flex">
        <NavigationMenu.Item>
          <NavigationMenu.Trigger
            className={cn(
              "group/services relative flex cursor-pointer items-center gap-1 py-1 text-small font-medium whitespace-nowrap outline-none",
              "transition-colors duration-fast ease-crownline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring",
              "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-gold-ink",
              "after:transition-transform after:duration-fast after:ease-crownline",
              active ? "text-gold-ink after:scale-x-100" : "after:scale-x-0 data-popup-open:after:scale-x-100",
              !active &&
                (tone === "dark"
                  ? "text-white/80 hover:text-white data-popup-open:text-white"
                  : "text-muted-foreground hover:text-foreground data-popup-open:text-foreground")
            )}
          >
            {group.label}
            <NavigationMenu.Icon className="transition-transform duration-base ease-crownline data-popup-open:rotate-180">
              <ChevronDown aria-hidden="true" className="size-3.5" />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>

          <NavigationMenu.Content className="w-80 p-2 transition-opacity duration-base data-ending-style:opacity-0 data-starting-style:opacity-0">
            <ul className="flex flex-col gap-1">
              {group.children.map((child) => {
                const Icon = ICONS[child.icon]
                const current = pathname === child.href

                return (
                  <li key={child.href}>
                    <NavigationMenu.Link
                      render={<Link href={child.href} />}
                      active={current}
                      closeOnClick
                      className={cn(
                        "group/item flex items-start gap-3 rounded-lg p-3 outline-none",
                        "transition-colors duration-fast ease-crownline",
                        "hover:bg-secondary focus-visible:bg-secondary data-active:bg-secondary"
                      )}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-gold transition-transform duration-fast ease-crownline group-hover/item:-translate-y-0.5">
                        <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-small font-semibold text-foreground">{child.label}</span>
                        <span className="text-xs text-muted-foreground">{child.description}</span>
                      </span>
                    </NavigationMenu.Link>
                  </li>
                )
              })}
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner sideOffset={18} align="start" alignOffset={-16} className="z-50">
          <NavigationMenu.Popup
            className={cn(
              "origin-[var(--transform-origin)] rounded-xl bg-popover text-popover-foreground",
              "shadow-[var(--shadow-raised)] ring-1 ring-foreground/10 outline-none",
              "transition-[opacity,scale,translate] duration-base ease-crownline",
              "data-starting-style:-translate-y-1 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
              "data-ending-style:-translate-y-1 data-ending-style:scale-[0.98] data-ending-style:opacity-0"
            )}
          >
            <NavigationMenu.Viewport className="relative overflow-hidden" />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  )
}
