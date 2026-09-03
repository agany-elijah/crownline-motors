import "server-only"

import { createHash } from "node:crypto"

import { prisma } from "@/lib/prisma"

/**
 * Rate limiting for administrator sign-in (SECURITY.MD §5.5, brief §17).
 *
 * ── What this is defending against ────────────────────────────────────
 * Credential stuffing and password guessing against a dashboard that can
 * publish listings, change prices and confirm payments. Supabase applies its
 * own limits to `signInWithPassword`, which is real but not ours to tune,
 * not visible to the operator, and not expressible in the business's terms.
 * This layer is the one Crownline controls: seven attempts, fifteen minutes,
 * stated in a message the person reading it can act on.
 *
 * ── Why two keys, not one ─────────────────────────────────────────────
 * Limiting only by email lets one host walk a list of addresses at full
 * speed, never tripping any single account's budget. Limiting only by IP
 * lets a botnet spread the same attack across hosts and never trip that
 * one. Both counters therefore run on every attempt and either can refuse.
 *
 * The consequence worth knowing: staff behind a single office NAT share the
 * IP budget. With a handful of administrators that is the right trade — the
 * lockout is fifteen minutes, not permanent, and a shared address that has
 * produced seven failures in that time is worth pausing either way.
 *
 * ── Why failures only ─────────────────────────────────────────────────
 * Only failed attempts are recorded, and a success clears the counters for
 * both of that attempt's keys. An administrator who signs in correctly is
 * never a step closer to being locked out by their own work.
 *
 * ── Where this is going ───────────────────────────────────────────────
 * The roadmap puts Upstash Redis in Phase 2, and this is exactly the
 * workload it is for. This module is the only place that reads or writes
 * LoginAttempt, so that migration is a change to one file. See the model's
 * comment in prisma/schema.prisma for why Postgres, and not an in-memory
 * Map, is correct in the meantime.
 */

/** Attempts allowed inside the window, per key. */
export const ADMIN_LOGIN_MAX_ATTEMPTS = 7

/** Length of the rolling window. */
export const ADMIN_LOGIN_WINDOW_MINUTES = 15

const WINDOW_MS = ADMIN_LOGIN_WINDOW_MINUTES * 60 * 1000

/**
 * The message shown when the limit is reached.
 *
 * Carries the "429" deliberately, at the client's request: a Server Action
 * returns a value rather than an HTTP status, so the code that would
 * normally appear in the response line is stated in the text instead. The
 * duration is the *window*, which is the honest thing to promise — a rolling
 * window means the oldest attempt ages out sooner than that, so the person
 * may well get in before the fifteen minutes are up, and never later.
 */
export const ADMIN_LOGIN_RATE_LIMITED_MESSAGE = `429 Too many attempts, try again in ${ADMIN_LOGIN_WINDOW_MINUTES} min`

/** The buckets a sign-in attempt is counted against. */
export const RATE_LIMIT_SCOPES = {
  adminLoginEmail: "admin-login:email",
  adminLoginIp: "admin-login:ip",
} as const

export type RateLimitScope =
  (typeof RATE_LIMIT_SCOPES)[keyof typeof RATE_LIMIT_SCOPES]

/**
 * One key the limiter counts against.
 *
 * `identifier` is the raw value — an email address, an IP. It is hashed
 * before it reaches the database and never stored or logged in the clear.
 */
export interface RateLimitKey {
  scope: RateLimitScope
  identifier: string
}

/**
 * SHA-256 of "<scope>:<identifier>".
 *
 * Not a password hash and not trying to be: the input space is small enough
 * that a determined holder of the table could confirm a *guessed* address,
 * so this is not secrecy. What it does buy is that the table is not itself a
 * readable list of staff addresses and the IPs they work from — which is the
 * form the data would otherwise take, retained far longer than any request
 * (SECURITY.MD §38). Scoping the input keeps the same value in two buckets
 * from producing the same hash.
 */
function hashIdentifier(scope: string, identifier: string): string {
  return createHash("sha256").update(`${scope}:${identifier}`).digest("hex")
}

export interface RateLimitVerdict {
  /** True when the caller may proceed. */
  allowed: boolean
  /** Attempts left before the limit trips. Zero once it has. */
  remaining: number
}

/**
 * Has any of these keys used up its budget?
 *
 * Read-only — this records nothing. `recordFailedAttempt` is what writes,
 * and it is called only when an attempt actually fails, so a caller that
 * checks and then succeeds leaves no trace.
 *
 * ── Why a failure here allows the request ─────────────────────────────
 * If the database is unreachable, this returns `allowed: true` rather than
 * refusing everyone. That is the deliberate choice: the alternative fails
 * closed and turns any database blip into a total lockout of the dashboard,
 * including for the administrator trying to fix it. Supabase's own limiter
 * still stands behind this, and the failure is logged loudly rather than
 * swallowed (CLAUDE.md rule 13). Note the asymmetry with authorisation,
 * where a failed check must always deny — this is a throttle, not a gate.
 */
export async function checkRateLimit(
  keys: RateLimitKey[],
  options?: { max?: number; windowMs?: number }
): Promise<RateLimitVerdict> {
  const max = options?.max ?? ADMIN_LOGIN_MAX_ATTEMPTS
  const windowMs = options?.windowMs ?? WINDOW_MS
  const since = new Date(Date.now() - windowMs)

  try {
    const counts = await Promise.all(
      keys.map((key) =>
        prisma.loginAttempt.count({
          where: {
            scope: key.scope,
            identifierHash: hashIdentifier(key.scope, key.identifier),
            createdAt: { gte: since },
          },
        })
      )
    )

    // The tightest key decides. One exhausted bucket is enough to refuse,
    // and `remaining` reports the smallest headroom so a caller cannot
    // report more attempts than the strictest counter would actually allow.
    const used = counts.length > 0 ? Math.max(...counts) : 0

    return { allowed: used < max, remaining: Math.max(0, max - used) }
  } catch (error) {
    console.error("[rate-limit] failed to read attempt counts", error)

    return { allowed: true, remaining: max }
  }
}

/**
 * Records one failed attempt against every key.
 *
 * Best-effort by design. A limiter that could break sign-in by failing to
 * write its own bookkeeping would be worse than the attack it prevents, so a
 * write failure is logged and the caller carries on returning its (already
 * decided) authentication error.
 */
export async function recordFailedAttempt(keys: RateLimitKey[]): Promise<void> {
  if (keys.length === 0) return

  try {
    await prisma.loginAttempt.createMany({
      data: keys.map((key) => ({
        scope: key.scope,
        identifierHash: hashIdentifier(key.scope, key.identifier),
      })),
    })
  } catch (error) {
    console.error("[rate-limit] failed to record attempt", error)
  }
}

/**
 * Clears the counters for these keys.
 *
 * Called after a *fully* successful sign-in — valid credentials belonging to
 * an active administrator. Credentials that authenticate but do not belong
 * to an administrator must NOT clear anything: that is the shape of a
 * compromised or leftover Supabase account being probed, and it is precisely
 * what the limit is for.
 */
export async function clearAttempts(keys: RateLimitKey[]): Promise<void> {
  if (keys.length === 0) return

  try {
    await prisma.loginAttempt.deleteMany({
      where: {
        OR: keys.map((key) => ({
          scope: key.scope,
          identifierHash: hashIdentifier(key.scope, key.identifier),
        })),
      },
    })
  } catch (error) {
    console.error("[rate-limit] failed to clear attempts", error)
  }
}

/**
 * Drops rows that no window can still see.
 *
 * There is no scheduler in Wave A — background jobs are a Phase 2 item — so
 * housekeeping rides along with the writes. Called after recording a
 * failure, where one extra statement on an already-failing request costs
 * nothing a user will notice, and never on the success path.
 *
 * The cutoff is a multiple of the window rather than the window itself, so a
 * row is only removed once it is comfortably irrelevant to any live count.
 */
export async function pruneExpiredAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - WINDOW_MS * 4)

  try {
    await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } })
  } catch (error) {
    console.error("[rate-limit] failed to prune expired attempts", error)
  }
}
