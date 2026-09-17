import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { AnimatedWords, wordsDuration } from "@/components/motion/animated-words"
import { delay } from "@/components/motion/motion"

/**
 * A showroom section's opening — used on the homepage, How It Works and
 * Contact: a small pill naming the section, a two-part headline whose second
 * part is set in gold, and a short supporting line.
 *
 * Must sit inside an InView — every piece animates on the `.rv-*` trigger,
 * in reading order: the pill, then the words, then the line beneath.
 */
export function ShowroomHeading({
  id,
  icon: Icon,
  label,
  lead,
  accent,
  description,
  align = "start",
  className,
}: {
  /** The heading's id, for the section's `aria-labelledby`. */
  id: string
  icon: LucideIcon
  label: string
  lead: string
  accent: string
  description?: string
  align?: "start" | "center"
  className?: string
}) {
  const accentStart = 120 + wordsDuration(lead)
  const descriptionStart = accentStart + wordsDuration(accent) + 120

  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "center" && "items-center text-center",
        className
      )}
    >
      <p
        className="rv-up inline-flex w-fit items-center gap-2 rounded-full border border-gold/25 bg-gold/10 py-1.5 pr-4 pl-3 text-small font-medium text-gold"
        style={delay(0)}
      >
        <Icon aria-hidden="true" className="rv-icon size-4" style={delay(150)} />
        {label}
      </p>

      <h2 id={id} className="max-w-3xl text-h1 text-foreground">
        <AnimatedWords text={lead} startDelay={120} />{" "}
        <span className="text-gold">
          <AnimatedWords text={accent} startDelay={accentStart} />
        </span>
      </h2>

      {description ? (
        <p
          className={cn(
            "rv-up max-w-2xl text-body-lg text-muted-foreground",
            align === "center" && "mx-auto"
          )}
          style={delay(descriptionStart)}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
