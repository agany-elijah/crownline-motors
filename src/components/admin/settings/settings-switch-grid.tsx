"use client"

import * as React from "react"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/**
 * A compact grid of switches: one column on a phone, two from `sm`. For long
 * lists of short, independent on/off choices, where a full-width row per
 * switch would turn one decision into a page of scrolling.
 */
export function SettingsSwitchGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-1 min-w-0 overflow-hidden rounded-lg border border-border sm:grid-cols-2", className)}>
      {children}
    </ul>
  )
}

/** One switch in a `SettingsSwitchGrid`. The whole tile is the label. */
export function SettingsSwitchTile({
  name,
  label,
  description,
  defaultChecked,
  onCheckedChange,
}: {
  name: string
  label: string
  description?: string
  defaultChecked: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  const id = React.useId()

  return (
    // Hairlines between tiles in both directions: every tile draws its own
    // bottom and right edge, and the grid's border clips the outer ones.
    <li className="-mr-px -mb-px flex min-w-0 border-r border-b border-border">
      <label
        htmlFor={id}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 transition-colors duration-fast hover:bg-muted/50 sm:px-3.5"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-small font-medium text-foreground">{label}</span>
          {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
        </span>
        <Switch id={id} name={name} defaultChecked={defaultChecked} onCheckedChange={onCheckedChange} />
      </label>
    </li>
  )
}
