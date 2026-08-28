import * as React from "react"

import { cn } from "@/lib/utils"
import { siteConfig } from "@/config/site"

const markSizes = {
  sm: { word: "text-base", sub: "text-[0.5rem]", gap: "gap-[0.15rem]" },
  default: { word: "text-lg md:text-xl", sub: "text-[0.5625rem]", gap: "gap-[0.2rem]" },
  lg: { word: "text-2xl md:text-3xl", sub: "text-[0.6875rem]", gap: "gap-[0.25rem]" },
} as const

interface BrandMarkProps extends React.ComponentProps<"span"> {
  size?: keyof typeof markSizes
  /** Hides the "MOTORS" lockup line, for very tight contexts. */
  compact?: boolean
}

/**
 * The Crownline wordmark.
 *
 * TODO(client): this is a typographic stand-in until the real Crownline
 * Motors logo asset is supplied. It is deliberately a component rather
 * than inline markup in the header and footer, so swapping in the real
 * logo is a single edit here and every placement updates at once.
 *
 * Built from live text rather than an image on purpose: it stays crisp at
 * every density, costs no extra request, needs no width/height
 * reservation, and is readable to search engines. The eventual logo should
 * ship as inline SVG for the same reasons.
 *
 * Colour is inherited (`currentColor`) so the same mark works on the
 * transparent hero header, the solid light header and the dark footer
 * without a per-surface variant — only the gold rule is fixed.
 */
function BrandMark({ size = "default", compact = false, className, ...props }: BrandMarkProps) {
  const scale = markSizes[size]

  return (
    <span
      data-slot="brand-mark"
      className={cn("inline-flex flex-col leading-none", scale.gap, className)}
      {...props}
    >
      <span className={cn("font-heading font-bold tracking-[0.18em]", scale.word)}>
        {siteConfig.shortName.toUpperCase()}
      </span>

      {!compact && (
        <span className={cn("flex items-center gap-1.5", scale.sub)}>
          {/* Thin gold rule — the one piece of brand colour in the mark. */}
          <span aria-hidden="true" className="h-px w-3 bg-gold-ink" />
          <span className="font-heading font-semibold tracking-[0.34em] text-current/70">
            MOTORS
          </span>
        </span>
      )}
    </span>
  )
}

export { BrandMark }
export type { BrandMarkProps }
