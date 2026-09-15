import {
  OrderType,
  SparePartAvailability,
  SparePartCondition,
  SparePartPricingMode,
  SparePartStatus,
} from "@/generated/prisma/enums"

/**
 * Human-readable labels for every spare-parts enum, plus the starting
 * category taxonomy the seed installs.
 *
 * One source for the admin forms and the public catalogue, for the reason
 * spelled out in vehicle-options.ts: if the dashboard said "Reconditioned"
 * and the catalogue filter said "Refurbished", a customer would be searching
 * for something they cannot see and an operator would swear they had listed
 * it. Every map is typed as `Record<Enum, string>`, so adding a value to the
 * Prisma enum without labelling it is a compile error rather than a blank
 * dropdown discovered in production.
 */

/**
 * What the condition tag says on a part listing.
 *
 * "Used" rather than "Pre-owned", matching the vehicle side — the euphemism
 * is what a seller reaches for when it would rather the buyer did not dwell
 * on it, and this business is selling trust to customers wiring money abroad.
 *
 * "Refurbished" rather than "Reconditioned" or "Rebuilt": all three are used
 * in the trade, and the one that reads most plainly to someone whose first
 * language is not English wins. The description is where the detail of what
 * was replaced belongs.
 */
export const SPARE_PART_CONDITION_LABELS: Record<SparePartCondition, string> = {
  NEW: "New",
  USED: "Used",
  REFURBISHED: "Refurbished",
}

export const SPARE_PART_STATUS_LABELS: Record<SparePartStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
}

/**
 * Severity for the status badge, reusing the vehicle tones so the two
 * dashboards read identically. Encoding state in the label as well as the
 * colour, so a viewer who cannot distinguish the hues still reads it.
 */
export type SparePartStatusTone = "neutral" | "positive" | "muted"

export const SPARE_PART_STATUS_TONES: Record<SparePartStatus, SparePartStatusTone> = {
  DRAFT: "neutral",
  PUBLISHED: "positive",
  ARCHIVED: "muted",
}

/**
 * What the availability tag says on a listing.
 *
 * ── Short, because it is rendered as a tag on a card ──────────────────
 * Two words at most. The catalogue puts this over the photograph of every
 * part in a four-column grid, and a phrase that wraps to two lines there
 * stops being a tag and becomes a paragraph fighting the part name.
 *
 * ── Written as a promise, not as an inventory state ───────────────────
 * "Available to order" rather than "Not stocked"; "Made to order" would be a
 * lie about a part we buy in finished. Every one of these is something an
 * operator can say to a customer on WhatsApp without qualifying it, which is
 * the test for anything published beside a price.
 */
export const SPARE_PART_AVAILABILITY_LABELS: Record<SparePartAvailability, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  READY_TO_SHIP: "Ready to ship",
  ON_ORDER: "Available to order",
  OUT_OF_STOCK: "Out of stock",
  DISCONTINUED: "Discontinued",
}

/**
 * How each state is coloured, on the public tag and in the dashboard.
 *
 * Four tones for six states, and the grouping is the point: a customer
 * scanning a grid is answering "can I have it soon, or do I need to talk to
 * someone", not reading six distinct signals. The label carries the precise
 * meaning; the colour carries the answer to that one question.
 *
 * Gold is deliberately absent. The brief reserves it for the actions a
 * customer takes, and a rail of cards each wearing a gold tag would put gold
 * at every scroll position — the one place that rule is easiest to break.
 */
export type SparePartAvailabilityTone = "positive" | "warning" | "neutral" | "muted"

export const SPARE_PART_AVAILABILITY_TONES: Record<
  SparePartAvailability,
  SparePartAvailabilityTone
> = {
  IN_STOCK: "positive",
  LOW_STOCK: "warning",
  READY_TO_SHIP: "positive",
  ON_ORDER: "neutral",
  OUT_OF_STOCK: "muted",
  DISCONTINUED: "muted",
}

/**
 * How the part is priced, for the admin list's price column.
 *
 * Not offered as a choice anywhere: the mode is derived from whether a price
 * was entered (see `derivePricingMode`), so there is no select to populate
 * and no `OPTIONS` list here. These labels exist because a list of parts
 * still has to print something in the price column for one that has none,
 * and "Price on enquiry" is a promise that a real figure is coming — where a
 * dash would read as an unfinished listing.
 */
export const SPARE_PART_PRICING_MODE_LABELS: Record<SparePartPricingMode, string> = {
  FIXED: "Fixed price",
  QUOTE_ONLY: "Price on enquiry",
}

/**
 * Which workflow an order follows.
 *
 * Labelled here rather than in vehicle-options.ts because the discriminator
 * exists to tell the two product domains apart, and this is the file that
 * knows about the second one.
 */
export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  VEHICLE: "Vehicle",
  SPARE_PART: "Spare parts",
}

/**
 * The ceiling on stock quantity.
 *
 * Not a warehouse limit — a typo detector. An importer counting brake pads
 * does not hold a hundred thousand of anything, and a figure that large is a
 * slipped keypress that would otherwise sit on a public page promising stock
 * nobody has.
 *
 * Lives here rather than in the Zod schema so the form's `max` attribute and
 * the server's validation read the same constant without a client component
 * having to import a validation module (and Zod with it).
 */
export const SPARE_PART_STOCK_MAX = 100_000

/** Turns a label map into the `{ value, label }` pairs a select expects. */
function toOptions<T extends string>(
  labels: Record<T, string>
): ReadonlyArray<{ value: T; label: string }> {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }))
}

export const SPARE_PART_CONDITION_OPTIONS = toOptions(SPARE_PART_CONDITION_LABELS)
export const SPARE_PART_AVAILABILITY_OPTIONS = toOptions(
  SPARE_PART_AVAILABILITY_LABELS
)
export const SPARE_PART_STATUS_OPTIONS = toOptions(SPARE_PART_STATUS_LABELS)
export const ORDER_TYPE_OPTIONS = toOptions(ORDER_TYPE_LABELS)

/**
 * The categories the catalogue starts with — the brief's twelve, plus a
 * catch-all.
 *
 * ── Why this is seed data and not an enum ─────────────────────────────
 * Categories are a table precisely so the operator can add, rename and
 * retire them without a deploy (brief §22). This list is therefore a
 * *starting point*, not a definition: after the seed runs, the database is
 * the source of truth and this array is only consulted again if a fresh
 * environment is being provisioned.
 *
 * The seed upserts by `slug`, so re-running it neither duplicates a category
 * nor overwrites a name or description the operator has since edited. That
 * makes the slug the stable identity — which is also why it is written out
 * here rather than derived from the name: deriving it would mean a future
 * change to the slugifier could silently repoint an existing category's
 * public URL.
 *
 * `displayOrder` follows the brief's own ordering, which runs roughly from
 * the mechanically serious to the cosmetic. Ties are broken by name, so
 * inserting a category later without renumbering everything still sorts
 * sensibly.
 */
export interface SparePartCategorySeed {
  slug: string
  name: string
  description: string
  displayOrder: number
}

export const SPARE_PART_CATEGORY_SEEDS: readonly SparePartCategorySeed[] = [
  {
    slug: "engine",
    name: "Engine",
    description: "Engine assemblies, internals, gaskets, belts and mountings.",
    displayOrder: 10,
  },
  {
    slug: "transmission",
    name: "Transmission",
    description: "Gearboxes, clutches, driveshafts and differential components.",
    displayOrder: 20,
  },
  {
    slug: "brakes",
    name: "Brakes",
    description: "Pads, discs, drums, callipers, hoses and brake hydraulics.",
    displayOrder: 30,
  },
  {
    slug: "suspension",
    name: "Suspension",
    description: "Shocks, struts, springs, bushings, arms and steering linkage.",
    displayOrder: 40,
  },
  {
    slug: "cooling",
    name: "Cooling",
    description: "Radiators, water pumps, thermostats, fans and hoses.",
    displayOrder: 50,
  },
  {
    slug: "electrical",
    name: "Electrical",
    description: "Alternators, starters, batteries, sensors, switches and wiring.",
    displayOrder: 60,
  },
  {
    slug: "filters",
    name: "Filters",
    description: "Oil, air, fuel and cabin filters.",
    displayOrder: 70,
  },
  {
    slug: "lighting",
    name: "Lighting",
    description: "Headlamps, tail lamps, indicators, bulbs and lenses.",
    displayOrder: 80,
  },
  {
    slug: "body",
    name: "Body",
    description: "Panels, bumpers, mirrors, grilles, glass and trim.",
    displayOrder: 90,
  },
  {
    slug: "interior",
    name: "Interior",
    description: "Seats, dashboard components, trim, mats and interior fittings.",
    displayOrder: 100,
  },
  {
    slug: "wheels-and-tyres",
    name: "Wheels & Tyres",
    description: "Rims, tyres, hubs, bearings and wheel fittings.",
    displayOrder: 110,
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "Roof racks, mats, covers, audio and other fitted extras.",
    displayOrder: 120,
  },
  /**
   * The catch-all, and deliberately last.
   *
   * Every part must have a category, and the twelve above are a taxonomy of
   * what this business expects to stock — not a proof that nothing else
   * exists. Without somewhere honest to put a trailer coupling or a set of
   * mudflaps, an operator does what everyone does under that pressure and
   * files it under whichever category is closest, which is how "Brakes"
   * quietly stops meaning brakes.
   *
   * `displayOrder: 130` keeps it at the end of the category rail on the
   * public catalogue as well as in the admin select, where a catch-all
   * belongs: it is the option you reach after the specific ones, never
   * before.
   *
   * It is a normal row, not a special case — it can be renamed, retired or
   * emptied like any other, and nothing in the code branches on its slug.
   */
  {
    slug: "others",
    name: "Others",
    description: "Anything that does not belong under one of the categories above.",
    displayOrder: 130,
  },
] as const
