"use client"

import * as React from "react"
import Image from "next/image"

import { useSiteSettings } from "@/components/shared/site-settings-provider"
import { cn } from "@/lib/utils"

const markSizes = {
  sm: {
    word: "text-base",
    sub: "text-[0.5rem]",
    gap: "gap-[0.15rem]",
    logo: "h-7",
    lockupWord: "text-sm tracking-[0.08em]",
    lockupLogo: "h-8",
  },
  default: {
    word: "text-lg md:text-xl",
    sub: "text-[0.5625rem]",
    gap: "gap-[0.2rem]",
    logo: "h-8 md:h-9",
    lockupWord: "text-base md:text-lg",
    lockupLogo: "h-9 md:h-10",
  },
  lg: {
    word: "text-2xl md:text-3xl",
    sub: "text-[0.6875rem]",
    gap: "gap-[0.25rem]",
    logo: "h-10 md:h-12",
    lockupWord: "text-xl md:text-2xl",
    lockupLogo: "h-11 md:h-12",
  },
} as const

interface BrandMarkProps extends React.ComponentProps<"span"> {
  size?: keyof typeof markSizes
  /** Hides the second line of the stacked wordmark, for very tight contexts. */
  compact?: boolean
  /**
   * The surface the mark sits on. Picks which uploaded logo to use — a mark
   * drawn for white is usually illegible on black — and is ignored by the
   * text, which inherits `currentColor`.
   */
  tone?: "light" | "dark"
  /**
   * How the mark is composed.
   *
   * `auto`    the uploaded logo on its own, or the stacked wordmark when there
   *           is none. The staff dashboard uses this — its rail is sized for it.
   * `lockup`  the logo, then the business name on one line with its last word
   *           in gold. The public site's header, drawer and footer use this, so
   *           a visitor always reads the name beside the emblem.
   */
  layout?: "auto" | "lockup"
}

/** "Crownline Motors" → ["Crownline", "Motors"]; a one-word name has no accent. */
function splitName(name: string): { lead: string; accent: string | null } {
  const words = name.trim().split(/\s+/)
  return words.length > 1
    ? { lead: words.slice(0, -1).join(" "), accent: words[words.length - 1] }
    : { lead: name.trim(), accent: null }
}

/**
 * The brand, as configured in Settings → Website & branding.
 *
 * Built from the name in Settings, so renaming the business renames the mark.
 * The text inherits `currentColor`, so it works on the transparent hero
 * header, the glass header and the dark footer without a per-surface variant
 * — only the gold is fixed.
 *
 * `auto` renders the uploaded logo for the surface it is on (the other one if
 * only one exists), or without a logo the stacked typographic wordmark: every
 * word but the last in wide capitals, the last small beneath a gold rule.
 */
function BrandMark({
  size = "default",
  compact = false,
  tone = "light",
  layout = "auto",
  className,
  ...props
}: BrandMarkProps) {
  const { businessName, logoLightUrl, logoDarkUrl } = useSiteSettings()
  const scale = markSizes[size]
  const logoUrl = tone === "dark" ? (logoDarkUrl ?? logoLightUrl) : (logoLightUrl ?? logoDarkUrl)
  const { lead, accent } = splitName(businessName)

  if (layout === "lockup") {
    return (
      <span data-slot="brand-mark" className={cn("inline-flex min-w-0 items-center gap-2.5", className)} {...props}>
        {logoUrl ? (
          <Image
            src={logoUrl}
            // The name is written out beside it, so the image is decorative
            // here — announcing both would read the business name twice.
            alt=""
            width={160}
            height={160}
            loading="eager"
            className={cn("w-auto shrink-0 object-contain", scale.lockupLogo)}
          />
        ) : null}
        <span
          className={cn(
            // Wraps between the words rather than overflowing where a
            // long name meets a narrow row (a small phone, the drawer).
            "min-w-0 font-heading leading-[1.15] font-bold tracking-[0.12em] uppercase",
            scale.lockupWord
          )}
        >
          {lead}
          {accent ? (
            <>
              {" "}
              <span className="font-semibold text-gold-ink">{accent}</span>
            </>
          ) : null}
        </span>
      </span>
    )
  }

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
          loading="eager"
          className={cn("w-auto max-w-[12rem] object-contain", scale.logo)}
        />
      </span>
    )
  }

  return (
    <span
      data-slot="brand-mark"
      className={cn("inline-flex flex-col leading-none", scale.gap, className)}
      {...props}
    >
      <span className={cn("font-heading font-bold tracking-[0.18em] uppercase", scale.word)}>{lead}</span>

      {!compact && accent ? (
        <span className={cn("flex items-center gap-1.5", scale.sub)}>
          {/* Thin gold rule — the one piece of brand colour in the mark. */}
          <span aria-hidden="true" className="h-px w-3 bg-gold-ink" />
          <span className="font-heading font-semibold tracking-[0.34em] text-current/70 uppercase">{accent}</span>
        </span>
      ) : null}
    </span>
  )
}

export { BrandMark }
export type { BrandMarkProps }
