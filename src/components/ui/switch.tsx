"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/**
 * An on/off control.
 *
 * Base UI renders a real, visually hidden checkbox alongside the track, so a
 * switch with a `name` takes part in a plain `<form action>` exactly like a
 * native checkbox: it submits "on" when checked and nothing when not. The
 * settings schemas read it that way (`formSwitch`), which keeps these forms
 * working before hydration and keeps the server — not this component — the
 * judge of what was submitted.
 *
 * Gold when on, because on is the state an operator is looking for when
 * scanning a list of them; the thumb carries its own shadow so the off state
 * still reads as a control rather than as a grey pill.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent",
        "transition-colors duration-fast ease-crownline outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-checked:bg-primary data-unchecked:bg-input",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-card shadow-[0_1px_3px_oklch(0_0_0/0.25)] ring-0",
          "transition-transform duration-fast ease-crownline",
          "data-checked:translate-x-4 data-unchecked:translate-x-0.5"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
