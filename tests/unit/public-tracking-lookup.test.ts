import { beforeEach, describe, expect, it, vi } from "vitest"

import { ShipmentType, TrackingStatus } from "@/generated/prisma/enums"

/**
 * Track My Order answers a guessable, sequential number, so what it reads is
 * as important as what it returns. These tests hold the lookup to the journey:
 * no customer, no money, no staff notes, no voided events.
 */

const state = vi.hoisted(() => ({ shipmentArgs: null as unknown, shipment: null as unknown }))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    shipment: {
      findUnique: async (args: unknown) => {
        state.shipmentArgs = args
        return state.shipment
      },
    },
    order: { findUnique: async () => null },
  },
}))
vi.mock("@/lib/storage/vehicle-media", () => ({ vehiclePhotoPublicUrl: (path: string) => `https://cdn.test/v/${path}` }))
vi.mock("@/lib/storage/spare-part-media", () => ({
  sparePartPhotoPublicUrl: (path: string) => `https://cdn.test/p/${path}`,
}))

const { lookupPublicTracking } = await import("@/lib/queries/tracking.queries")

beforeEach(() => {
  state.shipment = {
    trackingNumber: "CLM-2026-000001",
    shipmentType: ShipmentType.VEHICLE,
    currentStatus: TrackingStatus.IN_TRANSIT,
    currentLocation: "Indian Ocean",
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    vehicle: { year: 2021, make: "Toyota", model: "Harrier", photos: [{ storagePath: "harrier.jpg" }] },
    order: {
      estimatedDeliveryDate: new Date("2026-10-17T00:00:00Z"),
      estimatedDeliveryLatest: new Date("2026-10-30T00:00:00Z"),
      items: [{ description: "2021 Toyota Harrier", sparePart: null }],
    },
    events: [{ status: TrackingStatus.IN_TRANSIT, eventDate: new Date("2026-10-05T00:00:00Z"), location: "Yokohama" }],
  }
})

describe("lookupPublicTracking", () => {
  it("returns the journey, the delivery window and the listing photograph", async () => {
    const outcome = await lookupPublicTracking({ kind: "TRACKING", value: "CLM-2026-000001" })

    expect(outcome).toMatchObject({
      kind: "FOUND",
      subject: "2021 Toyota Harrier",
      currentStatus: TrackingStatus.IN_TRANSIT,
      imageUrl: "https://cdn.test/v/harrier.jpg",
      expectedDelivery: {
        earliest: new Date("2026-10-17T00:00:00Z"),
        latest: new Date("2026-10-30T00:00:00Z"),
      },
      lastUpdated: new Date("2026-10-05T00:00:00Z"),
    })
  })

  it("reads nothing about the customer, the money or staff notes, and skips voided events", async () => {
    await lookupPublicTracking({ kind: "TRACKING", value: "CLM-2026-000001" })
    const select = JSON.stringify(state.shipmentArgs)

    for (const forbidden of ["customer", "quote", "totalAmount", "payments", "milestones", "notes", "contact", "price"]) {
      expect(select, `the lookup must not read ${forbidden}`).not.toContain(`"${forbidden}"`)
    }
    expect(select).toContain('"isVoided":false')
  })

  it("has no delivery window when staff have not given one", async () => {
    ;(state.shipment as { order: { estimatedDeliveryDate: Date | null } }).order.estimatedDeliveryDate = null

    const outcome = await lookupPublicTracking({ kind: "TRACKING", value: "CLM-2026-000001" })
    expect(outcome).toMatchObject({ expectedDelivery: null })
  })

  it("reports an unknown number as not found", async () => {
    state.shipment = null
    expect(await lookupPublicTracking({ kind: "TRACKING", value: "CLM-2026-999999" })).toEqual({ kind: "NOT_FOUND" })
  })
})
