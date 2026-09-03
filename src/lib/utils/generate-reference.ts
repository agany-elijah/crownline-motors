import type { Prisma } from "@/generated/prisma/client"

/**
 * Human-readable reference numbers, backed by an atomic counter.
 *
 * ── Why a counter table and not COUNT(*) + 1 ──────────────────────────
 * Two administrators saving a vehicle at the same moment would both read
 * the same count and both write the same reference. The unique constraint
 * on `referenceNumber` means one of them gets an error instead of a
 * duplicate — but that is a race that fails a real person's save for no
 * reason they can understand, at exactly the moment the business is busiest.
 *
 * `UPDATE ... SET lastValue = lastValue + 1 RETURNING lastValue` is a single
 * statement. Postgres takes a row lock for its duration, so concurrent
 * callers queue and each receives a distinct number. There is deliberately
 * no read-then-write anywhere in this file: splitting it into two statements
 * reintroduces exactly the race the table exists to prevent.
 *
 * ── Why there is no `server-only` marker here ─────────────────────────
 * Every other data-layer module in this codebase carries one. This does not,
 * because it has nothing to protect: the only import is a *type*, erased at
 * compile time, and `generateReference` cannot do anything without a Prisma
 * transaction client the caller supplies. There is no secret to leak and no
 * connection to open. Adding the marker anyway would cost the pure
 * formatting below its unit tests — and that formatting is what produces the
 * references printed on customer correspondence.
 *
 * ── Why the caller must pass a transaction ────────────────────────────
 * The number must be allocated in the same transaction as the row it
 * belongs to. Allocate outside one and a failed insert silently burns a
 * reference, leaving gaps in a sequence the business reads as a count of
 * vehicles listed. `tx` is required rather than optional so that is not a
 * decision each call site makes independently.
 */

/** The sequences in use. Each resets per calendar year. */
export type ReferenceKind = "VEHICLE" | "QUOTE" | "ORDER" | "TRACKING"

/**
 * Formats differ by design.
 *
 * Tracking has no letter after `CLM-` because it is the one reference a
 * customer types into "Track My Order", and the brief's example is literally
 * `CLM-2026-000125`. The others carry a letter so an administrator reading
 * a reference out of context knows immediately what kind of record it is.
 */
const PREFIXES: Record<ReferenceKind, string> = {
  VEHICLE: "CLM-V",
  QUOTE: "CLM-Q",
  ORDER: "CLM-O",
  TRACKING: "CLM",
}

const SEQUENCE_PADDING = 6

/**
 * Allocates the next reference of `kind` for `year`.
 *
 * @param tx    A Prisma transaction client. Required — see above.
 * @param kind  Which sequence to draw from.
 * @param year  Defaults to the current year. Passed explicitly by tests so
 *              they do not depend on the calendar.
 */
export async function generateReference(
  tx: Prisma.TransactionClient,
  kind: ReferenceKind,
  year: number = new Date().getFullYear()
): Promise<string> {
  const sequenceKey = `${kind}-${year}`

  /**
   * `upsert` creates the row on the first use of a new year and increments
   * it thereafter. Prisma compiles this to `INSERT ... ON CONFLICT DO
   * UPDATE`, which is itself atomic — two callers racing on the first
   * vehicle of January both succeed, and one of them gets 2.
   */
  const sequence = await tx.referenceSequence.upsert({
    where: { sequenceKey },
    create: { sequenceKey, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
    select: { lastValue: true },
  })

  const padded = String(sequence.lastValue).padStart(SEQUENCE_PADDING, "0")

  return `${PREFIXES[kind]}-${year}-${padded}`
}

/**
 * Formats a reference without allocating one.
 *
 * Exported for tests and for rendering a reference the caller already holds.
 * It does not touch the database and must never be used to invent a number.
 */
export function formatReference(
  kind: ReferenceKind,
  year: number,
  value: number
): string {
  return `${PREFIXES[kind]}-${year}-${String(value).padStart(SEQUENCE_PADDING, "0")}`
}
