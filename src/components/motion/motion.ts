import type * as React from "react"

/**
 * The inline style that staggers one animated element: `--d` is the delay
 * every `.load-*` and `.rv-*` rule in globals.css reads.
 */
export function delay(ms: number): React.CSSProperties {
  return { "--d": `${Math.round(ms)}ms` } as React.CSSProperties
}

/** The gap between successive words of an animated heading. */
export const WORD_STEP_MS = 70

/** The gap between successive items in a staggered list or grid. */
export const ITEM_STEP_MS = 90
