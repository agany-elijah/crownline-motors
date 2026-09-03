import { describe, expect, it } from "vitest"

import type { Prisma } from "@/generated/prisma/client"
import { formatReference, generateReference } from "@/lib/utils/generate-reference"

/**
 * Reference numbers are what the business and its customers use to identify
 * a vehicle, a quote, an order and a shipment. They appear on
 * correspondence, in WhatsApp messages and in the "Track My Order" box, so a
 * duplicate or a reused number is not a cosmetic defect — it is two
 * customers holding the same reference.
 *
 * This file previously contained four `it.todo`s and a comment saying the
 * source was still a stub. It has not been a stub for some time.
 *
 * `generateReference` takes a transaction client, so it is exercised here
 * against a fake that models what Postgres actually guarantees about
 * `INSERT ... ON CONFLICT DO UPDATE`: the row is created once, and every
 * subsequent increment is atomic.
 */

/**
 * A counter table, in memory.
 *
 * `upsert` is modelled as Prisma compiles it — create on first use of a key,
 * increment thereafter — and the calls are serialised through a promise
 * chain, which is what the row lock does in the real thing. That is the
 * property being tested: two callers racing must receive different numbers.
 */
function fakeSequenceTx() {
  const rows = new Map<string, number>()
  let queue: Promise<unknown> = Promise.resolve()

  const tx = {
    referenceSequence: {
      upsert: ({
        where,
        create,
      }: {
        where: { sequenceKey: string }
        create: { sequenceKey: string; lastValue: number }
      }) => {
        const run = queue.then(async () => {
          // A yield between read and write, so a non-atomic implementation
          // (read the value, then write it back) would interleave here and
          // hand out duplicates.
          const current = rows.get(where.sequenceKey)
          await Promise.resolve()

          const next = current === undefined ? create.lastValue : current + 1
          rows.set(where.sequenceKey, next)

          return { lastValue: next }
        })

        queue = run
        return run
      },
    },
    /** Test-only view of the counters, for assertions. */
    _rows: rows,
  }

  return tx as unknown as Prisma.TransactionClient & { _rows: Map<string, number> }
}

describe("generateReference", () => {
  it("allocates sequential numbers from the counter", async () => {
    const tx = fakeSequenceTx()

    expect(await generateReference(tx, "VEHICLE", 2026)).toBe("CLM-V-2026-000001")
    expect(await generateReference(tx, "VEHICLE", 2026)).toBe("CLM-V-2026-000002")
    expect(await generateReference(tx, "VEHICLE", 2026)).toBe("CLM-V-2026-000003")
  })

  it("gives each entity its own prefix and its own sequence", async () => {
    const tx = fakeSequenceTx()

    // Independent counters: listing a vehicle must not consume an order
    // number, or the sequences stop being a count of anything.
    expect(await generateReference(tx, "VEHICLE", 2026)).toBe("CLM-V-2026-000001")
    expect(await generateReference(tx, "QUOTE", 2026)).toBe("CLM-Q-2026-000001")
    expect(await generateReference(tx, "ORDER", 2026)).toBe("CLM-O-2026-000001")

    // Tracking carries no letter — it is the one reference a customer types
    // into "Track My Order", and the brief's example is literally
    // CLM-2026-000125.
    expect(await generateReference(tx, "TRACKING", 2026)).toBe("CLM-2026-000001")
  })

  it("resets numbering per calendar year", async () => {
    const tx = fakeSequenceTx()

    await generateReference(tx, "VEHICLE", 2026)
    await generateReference(tx, "VEHICLE", 2026)

    expect(await generateReference(tx, "VEHICLE", 2027)).toBe("CLM-V-2027-000001")
    // And the old year carries on from where it left off, rather than being
    // reset by the new one.
    expect(await generateReference(tx, "VEHICLE", 2026)).toBe("CLM-V-2026-000003")
  })

  it("keys the counter per kind and year", async () => {
    const tx = fakeSequenceTx()

    await generateReference(tx, "VEHICLE", 2026)
    await generateReference(tx, "ORDER", 2027)

    expect([...tx._rows.keys()].sort()).toEqual(["ORDER-2027", "VEHICLE-2026"])
  })

  it("never issues a duplicate under concurrent allocation", async () => {
    const tx = fakeSequenceTx()

    // Twenty callers at once — the two-administrators-saving-together case,
    // which is exactly why this is a counter table and not COUNT(*) + 1.
    const references = await Promise.all(
      Array.from({ length: 20 }, () => generateReference(tx, "VEHICLE", 2026))
    )

    expect(new Set(references).size).toBe(20)
    expect(references.every((ref) => /^CLM-V-2026-\d{6}$/.test(ref))).toBe(true)

    // Contiguous, with no number burned or skipped.
    const numbers = references.map((ref) => Number(ref.slice(-6))).sort((a, b) => a - b)
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it("pads to six digits and stops padding beyond them", async () => {
    // Six digits is 999,999 vehicles in one year. The format must not
    // silently truncate if a sequence ever passes it.
    expect(formatReference("VEHICLE", 2026, 1)).toBe("CLM-V-2026-000001")
    expect(formatReference("VEHICLE", 2026, 999_999)).toBe("CLM-V-2026-999999")
    expect(formatReference("VEHICLE", 2026, 1_000_000)).toBe("CLM-V-2026-1000000")
  })

  it("formats without touching the database", () => {
    // `formatReference` exists for rendering a reference the caller already
    // holds. It must never be used to invent one — hence no counter here.
    expect(formatReference("TRACKING", 2026, 125)).toBe("CLM-2026-000125")
    expect(formatReference("QUOTE", 2026, 45)).toBe("CLM-Q-2026-000045")
    expect(formatReference("ORDER", 2026, 12)).toBe("CLM-O-2026-000012")
  })
})
