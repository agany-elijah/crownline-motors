import { Prisma } from "@/generated/prisma/client"

/**
 * Narrowing helpers for the Prisma errors application code has a real
 * answer to.
 *
 * Everything else is an unexpected failure and should propagate to the
 * caller's generic handler — these exist so that "someone else just created
 * the row you were about to create" is handled as the ordinary race it is,
 * not reported to a customer as a server fault.
 */

/** A unique constraint rejected the write (Postgres 23505, Prisma P2002). */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}
