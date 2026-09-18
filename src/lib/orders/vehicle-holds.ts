import "server-only"

import type { Prisma } from "@/generated/prisma/client"

/**
 * Serialises writes to one vehicle row.
 *
 * Order cancellation is the remaining caller: it relists a car an older
 * order reserved, and the lock keeps that from racing an operator changing
 * the same car's status by hand.
 *
 * `findOpenOrderForVehicle` used to live here, answering "is this car
 * committed to a customer?" so that a second quote conversion or a
 * republish could be refused. Both refusals are gone — the dealership
 * sources from external suppliers, so an order against a listing does not
 * take it off the marketplace (see create-order-from-quote.ts) — and the
 * query went with them rather than being left as an exported function with
 * no caller.
 */
export async function lockVehicle(tx: Prisma.TransactionClient, vehicleId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${vehicleId} FOR UPDATE`
}
