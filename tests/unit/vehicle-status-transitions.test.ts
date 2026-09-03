import { describe, expect, it } from "vitest"

import { VehicleStatus } from "@/generated/prisma/enums"
import {
  ALLOWED_VEHICLE_TRANSITIONS,
  canTransitionVehicleStatus,
  describeRefusedTransition,
} from "@/lib/constants/vehicle-status-transitions"

/**
 * These exist because the rule they cover used to live only in a
 * `"use client"` component, which meant it was enforced in the browser and
 * nowhere else — a crafted POST could move any vehicle to any status. The
 * matrix is now shared and the Server Action refuses a move that fails it,
 * so what these tests pin is the matrix itself.
 *
 * Written negative-first (SECURITY.MD §63): the interesting cases are the
 * moves that must be refused, because those are the ones that put a car
 * someone has already paid for back on the marketplace.
 */

const ALL_STATUSES = Object.values(VehicleStatus)

describe("vehicle status transitions", () => {
  describe("refusals that protect a committed sale", () => {
    it("never lets a sold vehicle return to the marketplace", () => {
      // The one that matters most. By Phase 11 a SOLD vehicle has a
      // confirmed deposit against it; re-publishing would offer a car that
      // is no longer available and that someone has already paid for.
      expect(
        canTransitionVehicleStatus(VehicleStatus.SOLD, VehicleStatus.PUBLISHED)
      ).toBe(false)
      expect(
        canTransitionVehicleStatus(VehicleStatus.SOLD, VehicleStatus.RESERVED)
      ).toBe(false)
      expect(
        canTransitionVehicleStatus(VehicleStatus.SOLD, VehicleStatus.DRAFT)
      ).toBe(false)
    })

    it("archives as the only way out of sold", () => {
      expect(ALLOWED_VEHICLE_TRANSITIONS.SOLD).toEqual([VehicleStatus.ARCHIVED])
    })

    it("never republishes an archived vehicle without a pass through draft", () => {
      // An archived listing has usually been away long enough that its price
      // and photographs want checking before customers see it again.
      expect(
        canTransitionVehicleStatus(VehicleStatus.ARCHIVED, VehicleStatus.PUBLISHED)
      ).toBe(false)
      expect(
        canTransitionVehicleStatus(VehicleStatus.ARCHIVED, VehicleStatus.SOLD)
      ).toBe(false)
      expect(
        canTransitionVehicleStatus(VehicleStatus.ARCHIVED, VehicleStatus.DRAFT)
      ).toBe(true)
    })

    it("never returns a live vehicle straight to draft", () => {
      // Withdrawing a listing is archiving it. Silently re-drafting would
      // remove it from the website with no record of the withdrawal.
      expect(
        canTransitionVehicleStatus(VehicleStatus.PUBLISHED, VehicleStatus.DRAFT)
      ).toBe(false)
      expect(
        canTransitionVehicleStatus(VehicleStatus.RESERVED, VehicleStatus.DRAFT)
      ).toBe(false)
    })

    it("treats a move to the status already held as not a transition", () => {
      // The action reports this as a no-op rather than a refusal — most
      // often it is a double submit — but the matrix itself must not claim
      // it is a legal move, or a second audit row would be written for a
      // change that did not happen.
      for (const status of ALL_STATUSES) {
        expect(canTransitionVehicleStatus(status, status)).toBe(false)
      }
    })
  })

  describe("moves the business actually needs", () => {
    it("publishes a draft", () => {
      expect(
        canTransitionVehicleStatus(VehicleStatus.DRAFT, VehicleStatus.PUBLISHED)
      ).toBe(true)
    })

    it("lets a reservation fall through back to published", () => {
      // Sales collapse. If this were one-way, a vehicle whose buyer withdrew
      // would have to be archived and re-listed under a new reference.
      expect(
        canTransitionVehicleStatus(VehicleStatus.RESERVED, VehicleStatus.PUBLISHED)
      ).toBe(true)
    })

    it("sells from either published or reserved", () => {
      // Not every sale passes through a reservation — a walk-in buys a
      // published car outright.
      expect(
        canTransitionVehicleStatus(VehicleStatus.PUBLISHED, VehicleStatus.SOLD)
      ).toBe(true)
      expect(
        canTransitionVehicleStatus(VehicleStatus.RESERVED, VehicleStatus.SOLD)
      ).toBe(true)
    })

    it("archives from every state, so nothing can become unwithdrawable", () => {
      for (const status of ALL_STATUSES) {
        if (status === VehicleStatus.ARCHIVED) continue

        expect(
          canTransitionVehicleStatus(status, VehicleStatus.ARCHIVED),
          `${status} must be archivable`
        ).toBe(true)
      }
    })
  })

  describe("the matrix is total and reachable", () => {
    it("covers every status in the Prisma enum", () => {
      // A status added to the schema without a row here would throw at
      // runtime on `ALLOWED_VEHICLE_TRANSITIONS[status].includes(...)`. The
      // Record type catches it at compile time; this catches it if the type
      // is ever loosened.
      for (const status of ALL_STATUSES) {
        expect(ALLOWED_VEHICLE_TRANSITIONS[status]).toBeDefined()
      }
    })

    it("names only real statuses as destinations", () => {
      for (const [from, targets] of Object.entries(ALLOWED_VEHICLE_TRANSITIONS)) {
        for (const target of targets) {
          expect(ALL_STATUSES, `${from} -> ${target}`).toContain(target)
        }
      }
    })

    it("leaves every status reachable from somewhere", () => {
      // Otherwise a state exists that no vehicle can ever enter, which means
      // either the matrix or the enum is wrong.
      for (const status of ALL_STATUSES) {
        if (status === VehicleStatus.DRAFT) continue // where every vehicle starts

        const reachable = ALL_STATUSES.some((from) =>
          canTransitionVehicleStatus(from, status)
        )

        expect(reachable, `nothing can reach ${status}`).toBe(true)
      }
    })
  })

  describe("listing status stays separate from shipment status", () => {
    it("carries no shipping state of its own", () => {
      /**
       * The brief's Stage 8 sketch listed "In Transit" and "Delivered"
       * alongside the listing states. They belong to `TrackingStatus`, on
       * Shipment/TrackingEvent — see the note on `enum VehicleStatus` in
       * prisma/schema.prisma.
       *
       * Asserted rather than only documented because the pull to add one is
       * real and the cost is not obvious: the marketplace card and the
       * customer's tracking page would then hold two independently-edited
       * answers to "where is my car", and would eventually disagree.
       */
      const shipmentStates = [
        "IN_TRANSIT",
        "DELIVERED",
        "ARRIVED_AT_MOMBASA",
        "CLEARING",
        "EXPORTED",
        "READY_FOR_COLLECTION",
        "PROCESSING",
        "DISPATCHED",
      ]

      for (const state of shipmentStates) {
        expect(ALL_STATUSES, `${state} is a shipment state`).not.toContain(state)
      }
    })

    it("marks a vehicle that is shipping as sold, with archive as its only exit", () => {
      // A car on a ship is not for sale, and SOLD is how the listing says
      // so — there is no listing state between sold and withdrawn.
      expect(ALLOWED_VEHICLE_TRANSITIONS[VehicleStatus.SOLD]).toEqual([
        VehicleStatus.ARCHIVED,
      ])
    })
  })

  describe("the refusal message", () => {
    it("names both states so a stale page can be diagnosed", () => {
      const message = describeRefusedTransition(
        VehicleStatus.SOLD,
        VehicleStatus.PUBLISHED
      )

      expect(message).toContain("sold")
      expect(message).toContain("published")
      expect(message).toContain("Reload")
    })
  })
})
