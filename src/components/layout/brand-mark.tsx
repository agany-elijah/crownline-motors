"use client"

import * as React from "react"
import Image from "next/image"

import { useSiteSettings } from "@/components/shared/site-settings-provider"
import { cn } from "@/lib/utils"

const markSizes = {
  sm: { word: "text-base", sub: "text-[0.5rem]", gap: "gap-[0.15rem]", logo: "h-7" },
  default: { word: "text-lg md:text-xl", sub: "text-[0.5625rem]", gap: "gap-[0.2rem]", logo: "h-8 md:h-9" },
  lg: { word: "text-2xl md:text-3xl", sub: "text-[0.6875rem]", gap: "gap-[0.25rem]", logo: "h-10 md:h-12" },
} as const

interface BrandMarkProps extends React.ComponentProps<"span"> {
  size?: keyof typeof markSizes
  /** Hides the second line of the wordmark, for very tight contexts. */
  compact?: boolean
  /**
   * The surface the mark sits on. Picks which uploaded logo to use — a mark
   * drawn for white is usually illegible on black — and is ignored by the
   * text wordmark, which inherits `currentColor`.
   */
  tone?: "light" | "dark"
}

/**
 * The brand, as configured in Settings → Website & branding.
 *
 * With a logo uploaded, it renders that logo for the surface it is on (the
 * other one if only one exists). Without one, it renders the business name as
 * the typographic wordmark: every word but the last on the first line in wide
 * capitals, and the last word small beneath a gold rule — "CROWNLINE / MOTORS".
 * Built from the name in Settings, so renaming the business renames the mark.
 *
 * The text wordmark inherits `currentColor`, so it works on the transparent
 * hero header, the solid light header and the dark footer without a
 * per-surface variant — only the gold rule is fixed.
 */
function BrandMark({ size = "default", compact = false, tone = "light", className, ...props }: BrandMarkProps) {
  const { businessName, logoLightUrl, logoDarkUrl } = useSiteSettings()
  const scale = markSizes[size]
  const logoUrl = tone === "dark" ? (logoDarkUrl ?? logoLightUrl) : (logoLightUrl ?? logoDarkUrl)

  if (logoUrl) {
    return (
      <span data-slot="brand-mark" className={cn("inline-flex items-center", className)} {...props}>
        <Image
          src={logoUrl}
          alt={businessName}
          // The intrinsic box only seeds the srcset; the rendered size comes
          // from the height class, with the width following the logo's own
          // aspect ratio.
          width={320}
          height={96}
          priority
          className={cn("w-auto max-w-[12rem] object-contain", scale.logo)}
        />
      </span>
    )
  }

  const words = businessName.trim().split(/\s+/)
  const primary = words.length > 1 ? words.slice(0, -1).join(" ") : businessName.trim()
  const secondary = words.length > 1 ? words[words.length - 1] : null

  return (
    <span
      data-slot="brand-mark"
      className={cn("inline-flex flex-col leading-none", scale.gap, className)}
      {...props}
    >
      <span className={cn("font-heading font-bold tracking-[0.18em] uppercase", scale.word)}>{primary}</span>

      {!compact && secondary ? (
        <span className={cn("flex items-center gap-1.5", scale.sub)}>
          {/* Thin gold rule — the one piece of brand colour in the mark. */}
          <span aria-hidden="true" className="h-px w-3 bg-gold-ink" />
          <span className="font-heading font-semibold tracking-[0.34em] text-current/70 uppercase">{secondary}</span>
        </span>
      ) : null}
    </span>
  )
}

export { BrandMark }
export type { BrandMarkProps }
