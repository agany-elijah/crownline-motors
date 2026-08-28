import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Crownline badge.
 *
 * A badge states a fact — "Available", "In transit", "Sold". It is not an
 * action, and the brief singles out badge/button confusion as a specific
 * failure to avoid.
 *
 * Two things keep them apart, and both matter:
 *
 * - Geometry. Badges are full pills; buttons hold a 8px radius. A shape
 *   this round reads as a label, never as something pressable.
 * - Colour. The `default` badge is a gold *tint* with gold ink, not the
 *   solid gold fill. That fill is reserved for the one primary CTA on a
 *   surface — a solid-gold badge sitting beside a solid-gold button makes
 *   the page ambiguous about which of the two can be clicked, which was
 *   exactly the case before.
 *
 * Badges also carry no shadow. Elevation in this system means "this object
 * is raised and interactive"; a flat chip beside a lifted button is a
 * second, quieter signal of the same distinction.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors duration-fast ease-crownline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-gold-ink/25 bg-accent text-gold-ink [a]:hover:bg-accent/70",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "border-destructive/20 bg-destructive/10 text-destructive focus-visible:ring-destructive/20 [a]:hover:bg-destructive/20",
        outline: "border-border text-muted-foreground [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost: "border-transparent hover:bg-muted hover:text-muted-foreground",
        link: "border-transparent text-gold-ink underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
