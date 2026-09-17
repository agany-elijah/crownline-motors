import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Crownline text input.
 *
 * Height is 44px (`--control-height`), not the 32px this started at. Most Crownline customers
 * arrive on a phone (brief §16) and will fill in a quote request there;
 * 44px is the smallest reliably tappable target, and a 32px field is a
 * genuine usability defect on the one form the business depends on. The
 * staff dashboard tightens it to 40px from a tablet up, where there is a
 * pointer to aim with (see "Admin console" in globals.css).
 *
 * `text-base md:text-sm` is deliberate and must stay in that order: iOS
 * Safari zooms the whole page in whenever a focused field renders below
 * 16px, which throws the layout sideways mid-form. Full size on mobile
 * prevents that; the smaller step applies only from md up, where there is
 * no zoom behaviour to trigger.
 *
 * `text-foreground` is explicit rather than inherited, and that is
 * load-bearing. This field paints an opaque light surface (`bg-card`) no
 * matter what is behind it, so its text colour must be pinned to match that
 * surface — not to whatever colour the surrounding region happens to set.
 * Dropping it makes the field invisible on any dark region: the admin
 * sign-in screen sets `text-background` on its container, so an inheriting
 * input renders near-white text on a white field at roughly 1:1 contrast.
 * Contrast with SelectTrigger, which is `bg-transparent` and therefore
 * *should* inherit its surface's colour.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-(--control-height) w-full min-w-0 rounded-lg border border-input bg-card px-3.5 py-2 text-base text-foreground transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-sunken dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
