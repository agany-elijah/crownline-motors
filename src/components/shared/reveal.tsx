"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useReveal } from "@/hooks/use-reveal"

interface RevealProps extends React.ComponentProps<"div"> {
  /** Milliseconds to hold before this element starts moving. Used to
   *  stagger siblings — a short offset per item (60–90ms) reads as one
   *  considered movement, while a long one reads as a slow page. */
  delay?: number
  /** Travel distance in px. Small by default; the movement should be felt
   *  rather than watched. */
  distance?: number
}

/**
 * Wraps content so it fades and lifts into place the first time it
 * scrolls into view.
 *
 * Isolated into its own small client component on purpose: it lets
 * `Section` and the pages that use it stay server components, so opting a
 * section into scroll animation costs one tiny island of client JS rather
 * than pushing an entire page across the boundary.
 */
function Reveal({ className, delay, distance, style, children, ...props }: RevealProps) {
  const { ref, isRevealed } = useReveal<HTMLDivElement>()

  return (
    <div
      ref={ref}
      data-reveal={isRevealed ? "in" : ""}
      style={{
        ...(delay ? { "--reveal-delay": `${delay}ms` } : {}),
        ...(distance ? { "--reveal-distance": `${distance}px` } : {}),
        ...style,
      } as React.CSSProperties}
      className={cn(className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Reveal }
export type { RevealProps }
