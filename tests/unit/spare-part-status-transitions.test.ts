import { describe, expect, it } from "vitest"

import { SparePartStatus } from "@/generated/prisma/enums"
import {
  ALLOWED_SPARE_PART_TRANSITIONS,
  canTransitionSparePartStatus,
  describeRefusedSparePartTransition,
} from "@/lib/constants/spare-part-status-transitions"
import { ALLOWED_VEHICLE_TRANSITIONS } from "@/lib/constants/vehicle-status-transitions"

/**
 * The transition table is enforced by `updateSparePartStatusAction`, not by
 * the buttons that read it. These tests cover the table itself, because it
 * is the single definition both sides consult — a wrong entry here is
 * simultaneously a button that should not be there and a write the server
 * would allow.
 *
 * What it protects against is a listing going live by a route nobody
 * intended: an archived part with a stale price returning straight to the
 * public catalogue without passing back through draft, where its price,
 * stock and fitment get checked.
 */

const ALL_STATUSES = Object.values(SparePartStatus)

describe("ALLOWED_SPARE_PART_TRANSITIONS", () => {
  it("covers every status", () => {
    // A missing key would be a runtime crash on `.includes` in both the
    // action and the control. The Record type catches it at compile time;
    // this catches a key added with an empty array by mistake.
    for (const status of ALL_STATUSES) {
      expect(ALLOWED_SPARE_PART_TRANSITIONS[status]).toBeDefined()
    }
  })

  it("never lists a status as a transition to itself", () => {
    for (const status of ALL_STATUSES) {
      expect(ALLOWED_SPARE_PART_TRANSITIONS[status]).not.toContain(status)
    }
  })

  it("lets a draft go live or be put away", () => {
    expect(canTransitionSparePartStatus(SparePartStatus.DRAFT, SparePartStatus.PUBLISHED)).toBe(true)
    expect(canTransitionSparePartStatus(SparePartStatus.DRAFT, SparePartStatus.ARCHIVED)).toBe(true)
  })

  it("allows unpublishing — the round trip a part line actually makes", () => {
    /**
     * The deliberate divergence from the vehicle table. Stock cycles: the
     * last set of pads sells, the listing comes down, a new box arrives and
     * it goes back up. Forcing that through ARCHIVED would overload a status
     * meaning "this line is finished" and leave an operator unable to tell a
     * discontinued part from one between shipments.
     */
    expect(canTransitionSparePartStatus(SparePartStatus.PUBLISHED, SparePartStatus.DRAFT)).toBe(true)

    // And the vehicle table still refuses it, because a specific car does
    // not come back. If this ever fails, one of the two was changed without
    // the reasoning behind the other being considered.
    expect(ALLOWED_VEHICLE_TRANSITIONS.PUBLISHED).not.toContain("DRAFT")
  })

  it("never returns an archived part straight to the catalogue", () => {
    // The transition this table exists to refuse. An archived line has
    // usually been away long enough that its price, stock figure and fitment
    // want checking before customers see it again — so it goes back through
    // DRAFT, where they can be.
    expect(canTransitionSparePartStatus(SparePartStatus.ARCHIVED, SparePartStatus.PUBLISHED)).toBe(false)
    expect(canTransitionSparePartStatus(SparePartStatus.ARCHIVED, SparePartStatus.DRAFT)).toBe(true)
  })

  it("treats a move to the status already held as not a transition", () => {
    // False here does not mean "forbidden" — the action reads it as a no-op,
    // most often a double submit, and says nothing rather than writing a
    // second audit row claiming a change that did not happen.
    for (const status of ALL_STATUSES) {
      expect(canTransitionSparePartStatus(status, status)).toBe(false)
    }
  })

  it("keeps every status reachable from every other, directly or not", () => {
    /**
     * A status nothing can reach is a trap: a part that lands in it can
     * never be corrected through the UI. Checked by walking the graph rather
     * than by listing pairs, so it keeps holding if a status is added.
     */
    for (const from of ALL_STATUSES) {
      const seen = new Set<SparePartStatus>([from])
      const queue = [from]

      while (queue.length > 0) {
        for (const next of ALLOWED_SPARE_PART_TRANSITIONS[queue.shift()!]) {
          if (!seen.has(next)) {
            seen.add(next)
            queue.push(next)
          }
        }
      }

      expect([...seen].sort()).toEqual([...ALL_STATUSES].sort())
    }
  })
})

describe("describeRefusedSparePartTransition", () => {
  it("names both states rather than saying 'invalid'", () => {
    // The only people who reach this are administrators, and the two
    // situations that produce it — a stale tab and a crafted request — are
    // both better served by being told what the part's status actually is.
    const message = describeRefusedSparePartTransition(
      SparePartStatus.ARCHIVED,
      SparePartStatus.PUBLISHED
    )

    expect(message).toContain("archived")
    expect(message).toContain("published")
    expect(message).toContain("Reload")
  })
})
