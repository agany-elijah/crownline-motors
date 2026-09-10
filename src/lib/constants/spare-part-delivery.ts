/**
 * The "how this reaches you" steps shown on every spare-part page.
 *
 * ── What this file is, and what the database is ───────────────────────
 * This is the *fallback*, not the source of truth. The operator edits the
 * real steps in Settings, and they are stored on `BusinessSettings`
 * (`sparePartDeliverySteps`). What lives here is what a page shows before
 * anybody has opened that screen — on a fresh install, or on an environment
 * restored from a backup taken before the field existed.
 *
 * A fallback matters more than it looks. The alternative is a part page that
 * renders nothing where the reassurance should be, on the section of the site
 * whose entire job is to convince someone in Juba that money sent abroad
 * comes back as a part. An empty space says less than an honest default.
 *
 * ── Why these four ────────────────────────────────────────────────────
 * They are the parts pipeline as the business actually runs it, and they are
 * deliberately *not* the vehicle timeline. A car goes through inspection,
 * export documentation, a ship to Mombasa and a customs clearance, and every
 * one of those steps is real and none of them describes a box of brake pads.
 * Forcing parts through the vehicle narrative is exactly what the brief warns
 * against, and a customer who reads "arrives at Mombasa" under a set of
 * filters learns that the page was written for something else.
 *
 * Four steps, because a list a customer will not read is not reassurance. The
 * detail of any one of them is a WhatsApp message away, which every page
 * already offers.
 */

/** One step, as both the fallback below and the settings form produce it. */
export interface SparePartDeliveryStep {
  /** Two or three words. It is set as a heading beside a numeral. */
  title: string
  /** One sentence. What actually happens, and what the customer does. */
  description: string
}

/**
 * How many steps the settings form will accept.
 *
 * Not arbitrary: this list is rendered as a horizontal band on a desktop and
 * a stacked list on a phone, and past six it stops being a reassuring
 * summary and becomes a policy document. It is also the bound on what a
 * single Json column is asked to hold.
 */
export const MAX_SPARE_PART_DELIVERY_STEPS = 6

/** How long each field of a step may run. Bounded because these are rendered
 *  into a fixed layout, and because a Json column has no length of its own. */
export const SPARE_PART_DELIVERY_STEP_TITLE_MAX = 40
export const SPARE_PART_DELIVERY_STEP_DESCRIPTION_MAX = 220

export const DEFAULT_SPARE_PART_DELIVERY_STEPS: readonly SparePartDeliveryStep[] = [
  {
    title: "You enquire",
    description:
      "Add the parts you need to your list and send it to us. We confirm the exact fitment against your car before anything is ordered.",
  },
  {
    title: "We confirm and quote",
    description:
      "You get a written quotation covering the part, shipping and clearing, with the lead time stated. Nothing is charged until you accept it.",
  },
  {
    title: "Sourced and shipped",
    description:
      "Stocked parts are set aside immediately. Anything we source is bought from our suppliers in Japan and Korea and sent on the next consolidation.",
  },
  {
    title: "Delivered in South Sudan",
    description:
      "We let you know the moment your parts land in Juba, and you collect them or we arrange delivery to you.",
  },
] as const
