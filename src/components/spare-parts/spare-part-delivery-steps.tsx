import { cn } from "@/lib/utils"
import type { SparePartDeliveryStep } from "@/lib/constants/spare-part-delivery"

/**
 * "How your part reaches you" — the small trust section on a part page.
 *
 * ── The problem it solves ─────────────────────────────────────────────
 * A customer in Juba is being asked to commit money to a part that is
 * currently in Japan, on a website belonging to a company they have not
 * bought from before. Everything else on the page argues that we have the
 * right part; nothing on it argues that the part will arrive. This is the
 * four sentences that do.
 *
 * The brief is direct about this: trust is the central problem the site has
 * to solve, and the way to solve it is to make the process explicit rather
 * than to assert that the company is trustworthy.
 *
 * ── Why it is small, and inside the page rather than a band ───────────
 * It is reassurance beside a decision, not a chapter. The full vehicle import
 * story has its own page and its own eight-stage timeline with photography;
 * reproducing that here would bury the price and the fitment under a
 * narrative nobody scrolled to a brake pad to read. Four short steps in a
 * bordered block, directly under the buy controls, is the size of the job.
 *
 * ── Why these steps are configurable and the vehicle ones are not ─────
 * The vehicle timeline mirrors `TrackingStatus`, which shipment records
 * actually key on — changing it would mean changing what the database
 * records. This is copy: it describes how the business handles parts, which
 * is exactly the thing that will be reworded long before it is reworked. So
 * it lives in `BusinessSettings` and an operator edits it in Settings without
 * a deploy. See `spare-part-delivery.ts` for the fallback.
 *
 * ── Colour ───────────────────────────────────────────────────────────
 * The numerals are gold on a tinted ground, and that is the only colour in
 * the block. It is one of the places gold genuinely earns its 10%: a numbered
 * sequence is exactly the "small separator, important accent" use the brief
 * reserves it for, and it visually links this block to the brand rather than
 * to the buy button above it. A coloured card per step, or an icon set, would
 * turn a reassurance into an infographic.
 */
interface SparePartDeliveryStepsProps {
  steps: readonly SparePartDeliveryStep[]
  className?: string
}

export function SparePartDeliverySteps({
  steps,
  className,
}: SparePartDeliveryStepsProps) {
  /**
   * An operator who clears every step in Settings hides this section
   * deliberately (an empty array is stored, and is distinct from "never
   * configured", which falls back to the built-in steps). Rendering an empty
   * heading would override that decision.
   */
  if (steps.length === 0) return null

  return (
    <section
      aria-labelledby="delivery-steps-heading"
      className={cn(
        "flex flex-col gap-4 rounded-[4px] border border-border bg-secondary/50 p-4 sm:p-5",
        className
      )}
    >
      <h2 id="delivery-steps-heading" className="eyebrow text-muted-foreground">
        How your part reaches you
      </h2>

      {/*
        An ordered list, because the order is the content.

        `list-none` removes the browser's own numerals: the styled ones below
        carry them visually. The `<ol>` is kept for the semantics — a screen
        reader announces "list of 4 items" and the position of each, which is
        precisely what a sequence needs and what a set of `<div>`s would throw
        away.
      */}
      <ol className="flex list-none flex-col gap-3.5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              // Decorative: the ordered list already conveys the position to
              // assistive technology, so announcing "1" here would say it
              // twice.
              aria-hidden="true"
              className={cn(
                "tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                "bg-accent text-xs font-bold text-gold-ink"
              )}
            >
              {index + 1}
            </span>

            <div className="flex min-w-0 flex-col gap-0.5">
              <h3 className="text-small font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-small text-muted-foreground">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
