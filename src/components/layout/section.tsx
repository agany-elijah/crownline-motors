import * as React from "react"

import { cn } from "@/lib/utils"
import { Container, type ContainerSize } from "@/components/layout/container"

// Vertical rhythm scale. "none" is for sections that manage their own
// spacing internally (e.g. a full-bleed hero with its own layout).
const sectionSpacing = {
  none: "",
  compact: "py-8 md:py-12",
  default: "py-16 md:py-24",
  loose: "py-24 md:py-32",
} as const

// Background variants map directly to the brief's ~65/25/10 white/black/gold
// ratio: "default" and "muted" cover the ~65% warm-white majority, "dark"
// covers the ~25% deep-black sections (hero, footer, How It Works), and
// "gold-tint" is reserved for the rare high-priority CTA block — it should
// stay rare, matching the "gold as accent, not wallpaper" rule.
const sectionVariants = {
  default: "bg-background text-foreground",
  muted: "bg-secondary text-secondary-foreground",
  // Reuses the existing foreground/background tokens inverted, rather than
  // the .dark class — this is a deliberate per-section design choice, not
  // a site-wide theme toggle (Crownline's public site has no dark-mode switch).
  dark: "bg-foreground text-background",
  "gold-tint": "bg-accent text-accent-foreground",
} as const

type SectionSpacing = keyof typeof sectionSpacing
type SectionVariant = keyof typeof sectionVariants

interface SectionProps extends React.ComponentProps<"section"> {
  spacing?: SectionSpacing
  variant?: SectionVariant
  /** False for full-bleed content that manages its own inner container
   *  (e.g. an edge-to-edge hero image with an absolutely-positioned Container
   *  layered on top). Defaults true — most sections want the standard gutter. */
  container?: boolean
  containerSize?: ContainerSize
  /** Wires up the [data-reveal] scroll-animation contract from globals.css.
   *  Off by default; turn on per-section once real content + the
   *  IntersectionObserver hook exist (Phase 3.7) — no point animating
   *  placeholder pages. */
  reveal?: boolean
}

function Section({
  className,
  spacing = "default",
  variant = "default",
  container = true,
  containerSize = "default",
  reveal = false,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      data-slot="section"
      data-variant={variant}
      data-reveal={reveal ? "" : undefined}
      className={cn(sectionSpacing[spacing], sectionVariants[variant], className)}
      {...props}
    >
      {container ? <Container size={containerSize}>{children}</Container> : children}
    </section>
  )
}

export { Section, sectionSpacing, sectionVariants }
export type { SectionProps, SectionSpacing, SectionVariant }