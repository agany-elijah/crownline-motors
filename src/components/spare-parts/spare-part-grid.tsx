import Link from "next/link"
import { SearchX, Wrench } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Reveal } from "@/components/shared/reveal"
import { SparePartCard } from "@/components/spare-parts/spare-part-card"
import { Button } from "@/components/ui/button"
import type { PublicSparePartCard } from "@/lib/queries/public-spare-part.queries"
import { PartsCatalogueQuoteButton } from "@/components/quotes/quote-request-triggers"

/**
 * The parts catalogue grid.
 *
 * Two columns on a phone — the cards are small enough to read side by side,
 * and a parts customer is comparing rather than admiring. Three from `sm`,
 * four only from `xl`.
 *
 * ── Why the fourth column waits for `xl` ──────────────────────────────
 * It used to arrive at `lg`, which put four ~14rem cards across a 1024px
 * laptop. At that width the photograph is a thumbnail and the four rows of
 * detail beneath it are set in the smallest steps the type scale has — a grid
 * that reads as a spreadsheet rather than a catalogue. Holding three columns
 * until 1280px gives each card around 19rem, which is where the photograph
 * becomes something a buyer can actually identify a part from.
 *
 * ── The gutters ───────────────────────────────────────────────────────
 * Tighter than the vehicle grid's, and deliberately so. A parts catalogue is
 * scanned rather than admired: the cards now carry a full-bleed photograph
 * with a hard edge, so a narrow gutter reads as an organised rack instead of
 * letting each card float. The vehicle grid keeps its wider gutter because a
 * car photograph is a composed scene that needs room around it.
 *
 * ── Why the stagger stops after the first row ─────────────────────────
 * Each card is revealed with a delay derived from its position, taken modulo
 * the row width. A delay that kept growing down a twenty-four card page would
 * leave the last card waiting most of a second after entering view, which
 * reads as a slow site rather than an elegant one.
 *
 * The reveal degrades correctly on its own: the hidden starting state in
 * globals.css is scoped to `(scripting: enabled)` and
 * `prefers-reduced-motion: no-preference`.
 */
interface SparePartGridProps {
  parts: PublicSparePartCard[]
  /**
   * How many cards sit above the fold and should load their photograph
   * eagerly. Four matches the widest grid — one full row on a desktop.
   */
  priorityCount?: number
  /**
   * True when the empty result is the answer to a search rather than the
   * state of the inventory. The two need different words and a different way
   * out.
   */
  filtered?: boolean
}

/** Cards per row at the widest breakpoint. Also the stagger's wrap point. */
const COLUMNS = 4

export function SparePartGrid({
  parts,
  priorityCount = COLUMNS,
  filtered = false,
}: SparePartGridProps) {
  if (parts.length === 0) {
    /**
     * Two different empty states, because they are two different situations
     * and a customer can act on only one of them.
     *
     * An empty *catalogue* is the dealership's state: nothing the visitor did
     * caused it, and the useful next step is to have us source the part. An
     * empty *search* is the visitor's own doing, and the useful next step is
     * to widen it.
     */
    return filtered ? (
      <EmptyState
        icon={<SearchX />}
        title="No parts match that search"
        description="Nothing in the current catalogue matches. Try a different category or a shorter search — or tell us the part number and the car it is for, and we will source it."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button render={<Link href="/spare-parts" />} variant="outline">
              Show all parts
            </Button>
            <PartsCatalogueQuoteButton size="default">Request a part</PartsCatalogueQuoteButton>
          </div>
        }
      />
    ) : (
      <EmptyState
        icon={<Wrench />}
        title="No parts listed yet"
        description="Parts from Japan and Korea are added as they arrive. Tell us what you need — the part number or the make, model and year — and we will source it for you."
        action={
          <PartsCatalogueQuoteButton variant="outline" size="default">
            Request a part
          </PartsCatalogueQuoteButton>
        }
      />
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4 xl:gap-4">
      {parts.map((part, index) => (
        <li key={part.slug} className="flex">
          <Reveal delay={(index % COLUMNS) * 60} className="flex w-full">
            <SparePartCard part={part} priority={index < priorityCount} />
          </Reveal>
        </li>
      ))}
    </ul>
  )
}
