import type * as React from "react"

import { cn } from "@/lib/utils"
import { delay } from "@/components/motion/motion"

/**
 * A whole number that counts up from zero on first paint.
 *
 * The visible digits are a CSS counter animated through a registered custom
 * property (see `.count-up` in globals.css), so there is no JavaScript and
 * no hydration flash. Pseudo-element text is unreliable for assistive
 * technology, so the real number is rendered alongside it for screen readers
 * and the animated one is hidden from them.
 *
 * Integers only: a CSS counter cannot print a thousands separator, and every
 * figure this is used for is a small count.
 */
export function CountUp({
  value,
  startDelay = 0,
  className,
}: {
  value: number
  startDelay?: number
  className?: string
}) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0

  return (
    <span className={className}>
      <span
        aria-hidden="true"
        className={cn("count-up load-count tabular")}
        style={{ ...delay(startDelay), "--to": safe } as React.CSSProperties}
      />
      <span className="sr-only">{safe}</span>
    </span>
  )
}
