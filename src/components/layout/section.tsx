import * as React from "react"

import { cn } from "@/lib/utils"
import { Container, type ContainerSize } from "@/components/layout/container"
import { Reveal } from "@/components/shared/reveal"

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
  /** Fades and lifts this section's content into place the first time it
   *  scrolls into view. Off by default — the first screenful of a page
   *  should never animate in, and a page where *everything* moves reads as
   *  a slow page rather than a considered one. */
  reveal?: boolean
  /** Stagger offset in ms, passed through to Reveal. Only meaningful
   *  alongside `reveal`. */
  revealDelay?: number
}

function Section({
  className,
  spacing = "default",
  variant = "default",
  container = true,
  containerSize = "default",
  reveal = false,
  revealDelay,
  children,
  ...props
}: SectionProps) {
  // The reveal wraps the *content*, never the <section> itself — the
  // section's own background and padding must stay put, or a dark band
  // would visibly slide around during the transition. Only what sits
  // inside the container moves.
  const body = reveal ? <Reveal delay={revealDelay}>{children}</Reveal> : children

  return (
    <section
      data-slot="section"
      data-variant={variant}
      // Tells globals.css this is a dark surface, which re-points
      // --gold-ink at the fill gold for everything inside and switches the
      // neutral button variants to their on-dark treatment. Set from the
      // variant rather than passed in, so the two can never disagree.
      data-tone={variant === "dark" ? "dark" : undefined}
      className={cn(sectionSpacing[spacing], sectionVariants[variant], className)}
      {...props}
    >
      {container ? <Container size={containerSize}>{body}</Container> : body}
    </section>
  )
}

/**
 * The standard section intro: optional uppercase eyebrow, a heading, and
 * optional supporting line.
 *
 * Exists so that section headings across the site share one rhythm and one
 * set of type steps instead of each page hand-assembling its own. The
 * brief's "short paragraphs, strong hierarchy" rule is enforced here by
 * constraining the description's measure rather than by asking every
 * author to remember it.
 */
function SectionHeading({
  eyebrow,
  title,
  description,
  align = "start",
  as: Heading = "h2",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  align?: "start" | "center"
  as?: "h1" | "h2" | "h3"
}) {
  return (
    <div
      data-slot="section-heading"
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className
      )}
      {...props}
    >
      {eyebrow && <span className="eyebrow text-gold-ink">{eyebrow}</span>}
      <Heading className={cn(Heading === "h1" ? "text-h1" : "text-h2", "max-w-3xl")}>
        {title}
      </Heading>
      {description && (
        <p
          className={cn(
            "max-w-2xl text-body text-muted-foreground",
            align === "center" && "mx-auto"
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}

export { Section, SectionHeading, sectionSpacing, sectionVariants }
export type { SectionProps, SectionSpacing, SectionVariant }