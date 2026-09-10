import { cn } from "@/lib/utils"
import type { SparePartAvailability } from "@/generated/prisma/enums"
import {
  SPARE_PART_AVAILABILITY_LABELS,
  SPARE_PART_AVAILABILITY_TONES,
  type SparePartAvailabilityTone,
} from "@/lib/constants/spare-part-options"

/**
 * What a listing says about getting hold of the part.
 *
 * ── One component, three surfaces ─────────────────────────────────────
 * The catalogue card, the part page and the dashboard list all state this,
 * and all three have to agree on the words *and* the colour. A tag that read
 * "In stock" in green on the website and "Available" in grey on the dashboard
 * would have an operator confidently telling a customer something the page in
 * front of them does not say.
 *
 * ── Why the label is not the only signal, and not only the colour ─────
 * The colour groups six states into four answers to one question — can I have
 * it soon, or do I need to talk to someone. The label carries the precise
 * meaning. Neither alone is enough: colour alone fails anyone who cannot
 * distinguish the hues, and a label alone is invisible in a grid being
 * scanned rather than read. The dot is a third, non-colour cue for the
 * positive states.
 *
 * ── No gold ──────────────────────────────────────────────────────────
 * The brief reserves gold for the actions a customer takes. A grid of
 * twenty-four cards each wearing a gold tag would put gold at every scroll
 * position, which is the one place that rule is easiest to break and hardest
 * to notice having broken.
 */
interface SparePartAvailabilityTagProps {
  availability: SparePartAvailability
  /**
   * Where it is sitting.
   *
   *   `overlay` — pinned to the corner of a catalogue photograph. The quiet
   *               one: no border, a frosted white plate, and the state
   *               carried by a coloured dot rather than by a coloured pill.
   *   `card`    — inside a card's detail block, on the card surface.
   *   `detail`  — the part page's own line, beside the price.
   */
  size?: "overlay" | "card" | "detail"
  className?: string
}

/**
 * The palette, keyed by tone.
 *
 * Every value is a semantic token rather than a raw colour, so the tag
 * follows the theme rather than pinning itself to one. `--price` is reused
 * for the positive tone deliberately: it is already the site's "this is
 * good news" green and reads as one system beside the price it sits under.
 */
const TONE_STYLES: Record<SparePartAvailabilityTone, string> = {
  positive: "border-price/25 bg-price/10 text-price",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  neutral: "border-border bg-secondary text-secondary-foreground",
  muted: "border-border bg-muted text-muted-foreground",
}

/**
 * The overlay treatment: one plate, four dot colours.
 *
 * ── Why the pill loses its colour here ────────────────────────────────
 * On the card this tag used to be a filled, coloured, bordered pill sitting
 * in the detail block directly above the part's name — and at that size and
 * weight it won. A grid of twenty-four cards read as twenty-four green
 * badges, with the product names as the quiet second thing. The tag was
 * shouting a fact the customer had not asked for yet.
 *
 * Over the photograph it only has to be *findable*, not loud. So the plate is
 * always the same neutral frosted white and only a 6px dot carries the state,
 * which is the smallest mark that can still be scanned down a column. The
 * label stays in near-black at the smallest step on the scale.
 *
 * The dot is not the only carrier — the words "In stock" are right beside it,
 * so nothing here depends on distinguishing the hues.
 */
const OVERLAY_DOT: Record<SparePartAvailabilityTone, string> = {
  positive: "bg-price",
  warning: "bg-amber-500",
  neutral: "bg-muted-foreground",
  muted: "bg-muted-foreground/60",
}

/** Which tones earn the leading dot — the states that mean "you can have it". */
const TONES_WITH_DOT: ReadonlySet<SparePartAvailabilityTone> = new Set([
  "positive",
  "warning",
])

const SIZE_STYLES = {
  overlay: "gap-1.5 px-2 py-1 text-[0.6875rem]",
  card: "gap-1 px-1.5 py-0.5 text-[0.6875rem]",
  detail: "gap-1.5 px-2.5 py-1 text-small",
} as const

export function SparePartAvailabilityTag({
  availability,
  size = "card",
  className,
}: SparePartAvailabilityTagProps) {
  const tone = SPARE_PART_AVAILABILITY_TONES[availability]
  const isOverlay = size === "overlay"

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-[3px] font-semibold whitespace-nowrap",
        isOverlay
          ? cn(
              // A frosted plate rather than a solid one: parts photography
              // is unpredictable, and a flat white chip on a light background
              // disappears while an opaque one punches a hole in a dark
              // photograph. The blur keeps the label legible over both.
              "bg-background/85 text-foreground backdrop-blur-sm",
              "shadow-[0_1px_2px_rgb(0_0_0/0.10)]"
            )
          : cn("border", TONE_STYLES[tone]),
        SIZE_STYLES[size],
        className
      )}
    >
      {isOverlay ? (
        // Always drawn on the overlay, whatever the tone — an absent dot
        // would make the plate jump wider on some cards and not others, and
        // a grid of tags that do not line up is worse than a grey dot.
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", OVERLAY_DOT[tone])}
        />
      ) : TONES_WITH_DOT.has(tone) ? (
        <span
          aria-hidden="true"
          className={cn(
            "rounded-full bg-current",
            size === "card" ? "size-1" : "size-1.5"
          )}
        />
      ) : null}
      {SPARE_PART_AVAILABILITY_LABELS[availability]}
    </span>
  )
}
