/**
 * The examples that cycle through the two catalogue search boxes.
 *
 * ── They are teaching, not decorating ─────────────────────────────────
 * Each list is ordered deliberately, and the ordering is the content: every
 * entry demonstrates a *different kind* of query the box understands, so a
 * customer watching for two seconds learns the range of the control rather
 * than reading four variations on one idea.
 *
 * ── Why the first entry matters more than the rest ────────────────────
 * It is what the server renders, what a visitor with reduced motion sees, and
 * what shows before the bundle has loaded on a slow connection. So it is the
 * most representative query, not the most interesting one.
 *
 * ── Keep them true ────────────────────────────────────────────────────
 * These are suggestions in a shop, so they carry an implied promise that
 * typing one would find something. They are therefore generic enough to stay
 * honest against a changing inventory — a make and a body part rather than a
 * specific listing that may be sold by Thursday. The one part number present
 * is a real Toyota format, which is the point of including it: it teaches that
 * the box takes numbers, and half of one at that.
 */

/** Spare-parts catalogue. Matched against name, OEM number and our reference. */
export const SPARE_PART_SEARCH_SUGGESTIONS: readonly string[] = [
  "brake pads",
  "oil filter",
  "04465-33471",
  "Harrier headlight",
  "alternator",
  "suspension bush",
] as const

/**
 * Vehicle catalogue. Matched against make, model and year.
 *
 * Deliberately shorter phrases than the parts list: the vehicle box sits
 * beside make/model/year dropdowns that already cover structured narrowing, so
 * what it is teaching is that free text works at all.
 */
export const VEHICLE_SEARCH_SUGGESTIONS: readonly string[] = [
  "Toyota Harrier",
  "Land Cruiser Prado",
  "Nissan X-Trail",
  "2021 automatic",
  "Mark X",
] as const
