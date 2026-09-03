import { cn } from "@/lib/utils"
import type { VehicleCondition } from "@/generated/prisma/enums"
import { VEHICLE_CONDITION_LABELS } from "@/lib/constants/vehicle-options"

/**
 * "New" or "Used", as the first thing read about a vehicle.
 *
 * ── Why this is not the shared Badge ──────────────────────────────────
 * Badge is a full pill in one of six neutral-to-gold variants, and it is
 * used across this site for statuses that are *incidental* to the thing
 * they sit on ("Available", "Japan"). Condition is not incidental — it is
 * the fact that changes what every other number on the page means, and the
 * brief asks for it as a tag anchored to the top of the summary block with
 * its own two-colour treatment. Squeezing that into Badge would mean adding
 * a variant that exists for exactly one caller and inherits a pill shape
 * chosen for a different job.
 *
 * ── The two colours ───────────────────────────────────────────────────
 * New takes the brand gold; used takes red. Both are rendered as a tint
 * with a matching border and ink rather than as a solid fill — the solid
 * gold fill is reserved for the single primary CTA on a surface, and a
 * solid red block on a premium listing reads as an error state rather than
 * as a fact about a car.
 *
 * Colour is never the only signal: the label is always spelled out, so the
 * distinction survives greyscale, colour-blindness and a screen reader.
 */
const CONDITION_STYLES: Record<VehicleCondition, string> = {
  NEW: "border-gold-ink/30 bg-accent text-gold-ink",
  USED: "border-destructive/25 bg-destructive/10 text-destructive",
}

export function VehicleConditionTag({
  condition,
  className,
}: {
  condition: VehicleCondition
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md border px-2.5 py-1",
        "text-[0.6875rem] font-bold tracking-[0.12em] uppercase",
        CONDITION_STYLES[condition],
        className
      )}
    >
      {/* Spelled out for anyone who meets the tag without the page around
          it — in a screen reader's element list, "Used" alone is ambiguous
          on a page that also carries statuses and countries. */}
      <span className="sr-only">Condition: </span>
      {VEHICLE_CONDITION_LABELS[condition]}
    </span>
  )
}
