import type { Prisma } from "@/generated/prisma/client"

/**
 * The two rules a vehicle's gallery must always satisfy.
 *
 * ── Why these live in a module of their own ───────────────────────────
 * Neither imports `prisma`, `server-only`, or anything else with a runtime
 * side effect — the only import above is a *type*, erased at compile time.
 * That is deliberate. `reconcilePrimary` is the code whose invariant already
 * drifted in live data once (see migration
 * `20260829093000_repair_vehicle_photo_primary`, which exists to repair a
 * vehicle found with a live photograph and no main image), and code with
 * that history has to be directly unit-testable rather than reachable only
 * through a Server Action and a database.
 *
 * `vehicle-photo-service.ts` re-exports both, so no caller had to change.
 */

/**
 * Restores the "exactly one main photograph" invariant for a vehicle.
 *
 * Called after any change that could break it — an upload into an empty
 * gallery, a removal of the current main image, an explicit change of main
 * image. Runs inside the caller's transaction so the gallery is never
 * observed mid-repair.
 *
 * The rule when the main image is gone is "the first photograph in display
 * order", which is what an operator would pick themselves and what the
 * gallery already shows first.
 *
 * A vehicle with no live photographs is left alone: zero primaries is the
 * correct state for an empty gallery, and promoting a soft-deleted row to
 * satisfy a counting rule would put a removed photograph back on the website.
 */
export async function reconcilePrimary(
  tx: Prisma.TransactionClient,
  vehicleId: string
): Promise<void> {
  const live = await tx.vehiclePhoto.findMany({
    where: { vehicleId, deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, isPrimary: true },
  })

  if (live.length === 0) return

  const primaries = live.filter((photo) => photo.isPrimary)

  if (primaries.length === 1) return

  // Keep the earliest existing primary if there are several (the state a
  // concurrent write could leave behind); otherwise promote the first photo.
  const keep = primaries[0] ?? live[0]

  await tx.vehiclePhoto.updateMany({
    where: { vehicleId, deletedAt: null, isPrimary: true, id: { not: keep.id } },
    data: { isPrimary: false },
  })

  if (!keep.isPrimary) {
    await tx.vehiclePhoto.update({ where: { id: keep.id }, data: { isPrimary: true } })
  }
}

/**
 * Is `submitted` a rearrangement of exactly `stored` — nothing added,
 * nothing dropped, nothing repeated?
 *
 * This is what makes the reorder action safe to expose. Without it, a
 * request could name a photograph belonging to a different listing (which
 * would then be renumbered against this vehicle), omit one (leaving it
 * stranded at a stale position), or repeat one (silently discarding
 * another). Comparing the two as sets refuses all three, and refuses them
 * wholesale — there is no partial application to reason about.
 *
 * Duplicates inside `submitted` are caught by the size comparison: a list
 * with a repeat is shorter as a set than as an array, so it can never match
 * a stored set of the same length.
 */
export function isSamePhotoSet(
  submitted: readonly string[],
  stored: readonly string[]
): boolean {
  if (submitted.length !== stored.length) return false

  const storedIds = new Set(stored)
  const submittedIds = new Set(submitted)

  if (submittedIds.size !== submitted.length) return false

  return submitted.every((id) => storedIds.has(id))
}
