/**
 * The page numbers a pager should show.
 *
 * ── Why a window rather than every page ───────────────────────────────
 * A list that grows past a few pages turns a full run of numbers into a
 * wall of near-identical tap targets — and on a phone, into a row that
 * wraps or overflows. The window keeps the pager a fixed size whatever the
 * inventory does: the first page, the last page, the current page and its
 * immediate neighbours, with gaps standing in for the rest.
 *
 * A gap is emitted as `null` rather than as a string, so the renderer
 * cannot mistake it for a page number and try to link it.
 *
 * ── Why the length is stable ──────────────────────────────────────────
 * The window is widened when the current page sits at either end, so the
 * pager holds the same number of slots whether the customer is on page 1,
 * page 5 or the last page. Without that, the control visibly changes width
 * as they step through it and the Next button moves under their thumb.
 *
 * Pure and side-effect free so it can be unit tested directly — the
 * off-by-one errors this kind of function attracts are invisible until an
 * inventory reaches a particular size in production.
 */
export function paginationRange(
  page: number,
  pageCount: number,
  /** Pages shown either side of the current one. */
  siblings = 1
): (number | null)[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) return []

  const current = Math.min(Math.max(1, Math.trunc(page)), pageCount)

  // First, last, the current page, its siblings, and the two gap markers.
  const slots = siblings * 2 + 5

  if (pageCount <= slots) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  // Widened at the ends so the control keeps its width. At page 1 the
  // window has no left-hand neighbours to show, so the space they would
  // have taken goes to the right-hand ones instead.
  const start = Math.max(2, Math.min(current - siblings, pageCount - slots + 3))
  const end = Math.min(pageCount - 1, Math.max(current + siblings, slots - 2))

  const range: (number | null)[] = [1]

  if (start > 2) range.push(null)

  for (let value = start; value <= end; value += 1) range.push(value)

  if (end < pageCount - 1) range.push(null)

  range.push(pageCount)

  return range
}
