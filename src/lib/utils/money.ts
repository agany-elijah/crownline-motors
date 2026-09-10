/**
 * Money arithmetic in integer cents.
 *
 * Every money column in this schema is `Decimal(12, 2)`, and Prisma hands
 * them to application code as `Decimal` objects that the rest of the codebase
 * converts to `number` at the edge of the data layer. That conversion is
 * exact for two-decimal values — but *arithmetic* on the resulting floats is
 * not: `0.1 + 0.2` is `0.30000000000000004`, and a quotation total or a
 * milestone split computed that way can be a cent out. A cent out on a
 * $22,500 vehicle is the difference between a milestone that reads as paid
 * and one that reads as owing one cent, forever.
 *
 * So sums, products and splits are done here, in whole cents, and converted
 * back once at the end. Decimal(12,2) tops out at 999,999,999,999 cents,
 * comfortably inside `Number.MAX_SAFE_INTEGER`.
 *
 * Pure: shared by server actions, queries, the PDF and client components.
 */

/** A two-decimal amount as whole cents. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Cannot convert ${amount} to cents.`)
  }

  // Rounded rather than truncated: 0.29 * 100 is 28.999999999999996 in
  // IEEE-754, and truncating it would lose a cent that is really there.
  return Math.round(amount * 100)
}

/** Whole cents back to a two-decimal amount. */
export function fromCents(cents: number): number {
  return cents / 100
}

/** Null-preserving `toCents`: an unquoted figure stays unquoted. */
export function toCentsOrNull(amount: number | null | undefined): number | null {
  return amount === null || amount === undefined ? null : toCents(amount)
}

/**
 * Parses an operator- or customer-typed amount — "22,500", "$1,800.50",
 * " 150 " — to a two-decimal number, or null when it is not one.
 *
 * Refuses more than two decimal places rather than rounding them away: the
 * column would store a different figure from the one typed, which is exactly
 * the silent change a price field must never make. Also refuses negatives and
 * anything past the Decimal(12,2) ceiling.
 */
export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/^\$/, "").replace(/,/g, "").trim()

  if (cleaned.length === 0) return null
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null

  const value = Number(cleaned)

  if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY) return null

  return value
}

/** The largest value a Decimal(12, 2) column holds. */
export const MAX_MONEY = 9_999_999_999.99
