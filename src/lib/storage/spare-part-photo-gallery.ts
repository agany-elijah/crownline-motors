import type { Prisma } from "@/generated/prisma/client"

/**
 * The rule a spare part's gallery must always satisfy.
 *
 * ── Why this is a mirror of vehicle-photo-gallery.ts and not a generic ──
 * The two functions differ in exactly one token: `tx.sparePartPhoto` where
 * the other says `tx.vehiclePhoto`, and `sparePartId` where the other says
 * `vehicleId`. The obvious move is one generic function taking the delegate
 * as a parameter — and it is the wrong one here.
 *
 * Prisma's model delegates are not structurally interchangeable: their
 * `findMany`/`updateMany` signatures are generic over per-model argument
 * types, so unifying them means widening the parameter to something like
 * `any` or asserting through a hand-written interface. Either way the
 * where-clauses stop being type-checked against the model they run against —
 * and a mistyped filter here does not fail loudly, it silently matches the
 * wrong set of rows and leaves a listing with no cover image or two.
 *
 * This is also the one piece of the media pipeline that has already drifted
 * against live data (migration `20260829093000_repair_vehicle_photo_primary`
 * exists to repair a vehicle found with a live photograph and no main image).
 * Code with that history gets the version the compiler can check, even at the
 * cost of twenty duplicated lines — and both versions have unit tests, which
 * is what actually stops them diverging in behaviour.
 *
 * ── Why the module has no runtime imports ─────────────────────────────
 * The only import above is a *type*, erased at compile time. No `prisma`, no
 * `server-only`. That is what makes this directly unit-testable against a
 * fake transaction client rather than reachable only through a Server Action
 * and a database.
 */

/**
 * Restores the "exactly one main photograph" invariant for a part.
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
 * A part with no live photographs is left alone: zero primaries is the
 * correct state for an empty gallery, and promoting a soft-deleted row to
 * satisfy a counting rule would put a removed photograph back on the website.
 */
export async function reconcileSparePartPrimary(
  tx: Prisma.TransactionClient,
  sparePartId: string
): Promise<void> {
  const live = await tx.sparePartPhoto.findMany({
    where: { sparePartId, deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, isPrimary: true },
  })

  if (live.length === 0) return

  const primaries = live.filter((photo) => photo.isPrimary)

  if (primaries.length === 1) return

  // Keep the earliest existing primary if there are several (the state a
  // concurrent write could leave behind); otherwise promote the first photo.
  const keep = primaries[0] ?? live[0]

  await tx.sparePartPhoto.updateMany({
    where: { sparePartId, deletedAt: null, isPrimary: true, id: { not: keep.id } },
    data: { isPrimary: false },
  })

  if (!keep.isPrimary) {
    await tx.sparePartPhoto.update({
      where: { id: keep.id },
      data: { isPrimary: true },
    })
  }
}
