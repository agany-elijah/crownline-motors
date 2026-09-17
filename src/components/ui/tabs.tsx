"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

/**
 * Tabs, on the Base UI primitive — which supplies the roving focus, arrow-key
 * navigation and tab/panel ARIA wiring that are easy to get wrong by hand.
 *
 * The active tab is a raised card-coloured pill on a secondary track, the
 * same segmented treatment the dashboard uses for filters, rather than an
 * underline: in a settings panel the tabs are a mode switch, not a page's
 * navigation.
 *
 * Panels stay mounted when hidden (`keepMounted`) wherever they hold form
 * fields, so switching tabs never discards unsaved input and every field is
 * still submitted with the form.
 */
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-5", className)} {...props} />
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "no-scrollbar inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-secondary p-1",
        className
      )}
      {...props}
    />
  )
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-small font-medium whitespace-nowrap",
        "text-muted-foreground transition-[color,background-color,box-shadow] duration-fast ease-crownline",
        "hover:text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-active:bg-card data-active:text-foreground data-active:shadow-[var(--shadow-subtle)]",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="tabs-panel" className={cn("outline-none", className)} {...props} />
}

export { Tabs, TabsList, TabsTab, TabsPanel }
