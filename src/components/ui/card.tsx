import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Crownline card.
 *
 * Carries the shallow two-layer elevation from the palette rather than a
 * hairline ring alone: a tight contact shadow plus a wide ambient one, so
 * the lift reads as light falling on the surface instead of a border
 * effect. Radius stays at `xl` — noticeably rounder than the button's 8px,
 * which is the geometric contrast that keeps the two from being confused.
 *
 * `interactive` is opt-in and belongs only on a card that is itself a link
 * or button. It applies the hover recipe as one gesture — a 6px rise, a
 * barely-there swell, a deeper shadow and a brighter edge — and pairs with
 * the `media-frame` utility, which scales the image inside its own fixed
 * crop so the picture moves without the layout shifting around it.
 *
 * The gesture runs at --duration-slow on --ease-crownline-soft rather than
 * the fast pair used everywhere else. That combination is the whole point:
 * on the expo curve a hover finishes ~93% of its travel in the first
 * quarter-second regardless of the duration set, so the card appeared to
 * snap between two states instead of moving between them. The soft curve
 * spends the duration it is given, which is what makes a 1.5% swell and a
 * 6px rise legible as movement at all.
 *
 * The rise is 6px rather than 4px, and --duration-slow is now 800ms rather
 * than 600ms, for the same reason: a lift small enough and quick enough to
 * be over before the eye has followed it reads as a static card with two
 * appearances rather than as a card that moves. Both numbers were raised
 * together — a longer duration on a 4px travel just makes the card look
 * hesitant, and a bigger travel at the old duration makes it jump.
 *
 * The swell stays deliberately tiny. A card scales its own text, and
 * anything past a percent or two starts to read as a blurry reflow rather
 * than as the card coming forward.
 *
 * A card that merely contains a link should NOT take it: hover feedback on
 * something that cannot be clicked is a promise the card does not keep.
 */
function Card({
  className,
  size = "default",
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  interactive?: boolean
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-interactive={interactive ? "" : undefined}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        "shadow-[var(--shadow-subtle)]",
        interactive && [
          // `translate` and `scale`, not just `transform`. Tailwind v4 emits
          // the individual transform properties — `hover:-translate-y-1.5`
          // sets `translate`, not `transform` — so an arbitrary transition
          // list naming only `transform` transitions nothing, and the lift
          // and the swell snap into place however long the duration says.
          // (The `transition-transform` *utility* covers all four; only a
          // hand-written `transition-[…]` list has to name them.)
          "transition-[transform,translate,scale,box-shadow,--tw-ring-color] duration-slow ease-crownline-soft",
          "hover:-translate-y-1.5 hover:scale-[1.015] hover:shadow-[var(--shadow-raised)]",
          "hover:ring-foreground/20",
        ],
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
