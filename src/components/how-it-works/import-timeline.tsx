import {
  Anchor,
  BadgeCheck,
  ClipboardCheck,
  FileCheck2,
  KeyRound,
  Search,
  Ship,
  Truck,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { InView } from "@/components/motion/in-view"
import { delay } from "@/components/motion/motion"

interface ImportStep {
  icon: LucideIcon
  title: string
  body: string
  /** Where it happens, when that helps a customer picture it. */
  place?: string
}

/**
 * The eight steps of a vehicle import, as the brief sets them out (§7).
 *
 * Service descriptions only: nothing here promises a duration, and the
 * payment wording matches the milestone rules the order system enforces.
 */
const STEPS: ImportStep[] = [
  {
    icon: Search,
    title: "Choose your vehicle",
    body: "Pick a vehicle from our inventory, or tell us the make, model, year and budget you want and we will find it.",
  },
  {
    icon: BadgeCheck,
    title: "Reserve your vehicle",
    body: "Accept your quotation and make the initial payment. The vehicle is then secured for you.",
  },
  {
    icon: ClipboardCheck,
    title: "Inspection and verification",
    body: "We check the vehicle's information, condition and documentation before it leaves.",
    place: "Japan or South Korea",
  },
  {
    icon: FileCheck2,
    title: "Export",
    body: "The vehicle clears export and is taken to the shipping port.",
  },
  {
    icon: Ship,
    title: "International shipping",
    body: "Your vehicle is loaded and shipped by sea towards Mombasa.",
    place: "Towards Mombasa, Kenya",
  },
  {
    icon: Anchor,
    title: "Clearing",
    body: "On arrival it passes port and customs clearing. Your Mombasa payment falls due when it arrives.",
    place: "Mombasa, Kenya",
  },
  {
    icon: Truck,
    title: "Transport",
    body: "Cleared and on the road from Mombasa to South Sudan.",
  },
  {
    icon: KeyRound,
    title: "Delivery",
    body: "We tell you when your vehicle is ready. Once the final payment is made, it is delivered or ready to collect.",
    place: "South Sudan",
  },
]

/** How far apart the steps start, so the line appears to reach each one. */
const STEP_MS = 180

/**
 * A vertical route with the steps set alternately either side of it on a
 * wide screen, and down one side on a phone. The gold line draws itself
 * along the route as the timeline scrolls into view, and each step's node
 * pops in as the line reaches it.
 */
export function ImportTimeline() {
  return (
    <InView className="relative mx-auto max-w-5xl">
      {/* The route. Outside the list, so it is not announced as a step. */}
      <div aria-hidden="true" className="pointer-events-none absolute top-7 bottom-7 left-7 w-px bg-white/10 lg:left-1/2">
        <span
          className="rv-draw-y absolute inset-0 bg-gradient-to-b from-gold via-gold to-gold/30"
          style={{ ...delay(200), transitionDuration: `${STEPS.length * STEP_MS + 600}ms` }}
        />
      </div>

      <ol className="relative flex flex-col gap-10 lg:gap-4">
      {STEPS.map((step, index) => {
        const Icon = step.icon
        const at = 250 + index * STEP_MS
        const onRight = index % 2 === 1

        return (
          <li key={step.title} className="relative grid grid-cols-[3.5rem_1fr] gap-6 lg:grid-cols-[1fr_3.5rem_1fr] lg:gap-10">
            <span className="rv-pop relative z-10 row-start-1 lg:col-start-2" style={delay(at)}>
              <span className="grid size-14 place-items-center rounded-full border border-gold/40 bg-night text-gold shadow-[0_0_0_8px_var(--background)]">
                <Icon aria-hidden="true" className="size-5" />
              </span>
            </span>

            <div
              className={cn(
                "rv-up row-start-1 flex flex-col gap-2 rounded-2xl border border-white/8 bg-card/60 p-6 backdrop-blur-sm",
                "transition-[border-color,translate] duration-slow ease-crownline-soft hover:-translate-y-1 hover:border-gold/35",
                onRight ? "lg:col-start-3" : "lg:col-start-1 lg:text-end"
              )}
              style={delay(at + 100)}
            >
              <span className="tabular text-small font-semibold text-gold">
                Step {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-heading text-h3 text-foreground">{step.title}</h3>
              <p className="text-body text-muted-foreground">{step.body}</p>
              {step.place ? (
                <p className={cn("text-small text-foreground/70", !onRight && "lg:self-end")}>{step.place}</p>
              ) : null}
            </div>
          </li>
        )
      })}
      </ol>
    </InView>
  )
}
