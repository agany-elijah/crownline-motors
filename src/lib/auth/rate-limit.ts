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

/**
 * The buckets attempts are counted against.
 *
 * The LoginAttempt table is keyed by scope, so one limiter serves every
 * unauthenticated write path without a table each. The model is named for
 * its first use; renaming it would be a migration that buys nothing.
 *
 *   admin-login:*      failed sign-ins (only failures are recorded)
 *   password-reset:*   reset-email requests — each one sends a real email
 *                      from our Supabase project, so an unthrottled form is
 *                      an email-bombing tool aimed at staff inboxes and a
 *                      way to exhaust the project's hourly email quota
 *   quote-request:*    public quotation requests — the one form anyone on
 *                      the internet can write to the database through
 *   quotation-pdf:*    reads of the public quotation PDF endpoint. The
 *                      256-bit share token already makes guessing one
 *                      infeasible; this is defence in depth against a script
 *                      hammering the endpoint, not the actual protection.
 */
export const RATE_LIMIT_SCOPES = {
  adminLoginEmail: "admin-login:email",
  adminLoginIp: "admin-login:ip",
  passwordResetEmail: "password-reset:email",
  passwordResetIp: "password-reset:ip",
  quoteRequestIp: "quote-request:ip",
  quoteRequestPhone: "quote-request:phone",
  quotationPdfIp: "quotation-pdf:ip",
  trackingLookupIp: "tracking-lookup:ip",
} as const

/** Quotation PDF reads per host inside the window. Generous: a customer may
 *  reload the page, forward the link, and reopen it themselves. */
export const QUOTATION_PDF_MAX_PER_IP = 30
export const QUOTATION_PDF_WINDOW_MS = 60 * 60 * 1000

/**
 * Track My Order lookups per host inside the window.
 *
 * Tracking numbers are sequential, so this is what stops a script walking
 * through them. Forty an hour is far past a customer refreshing their own
 * order, or a family checking two, and still turns enumeration into a crawl.
 */
export const TRACKING_LOOKUP_MAX_PER_IP = 40
export const TRACKING_LOOKUP_WINDOW_MS = 60 * 60 * 1000

/** Reset emails per address/host inside the window. Three covers "I did not
 *  get it, let me try again" twice over; a fourth in fifteen minutes is not
 *  a person waiting for an email. */
export const PASSWORD_RESET_MAX_ATTEMPTS = 3

/**
 * Quote requests per host / per phone number inside the window.
 *
 * Generous on purpose: a customer may reasonably ask about a car, then a
 * set of parts, then a second car, in one sitting — and a household or an
 * office behind one NAT shares the IP budget. Six an hour per host still
 * turns a spam run into a trickle, and the per-phone bucket stops one number
 * being used to flood the queue from many hosts.
 */
export const QUOTE_REQUEST_MAX_PER_IP = 6
export const QUOTE_REQUEST_MAX_PER_PHONE = 4
export const QUOTE_REQUEST_WINDOW_MS = 60 * 60 * 1000

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

/** One key and the number of uses it may make inside the window. */
export interface RateLimitBudget {
  key: RateLimitKey
  max: number
}

/**
 * Counts a use against every budget and decides, as one step.
 *
 * For limits on *uses* — a quote request, a tracking lookup, a reset email —
 * where `checkRateLimit` followed by `recordAttempt` leaves a gap: a burst of
 * parallel requests all read the count before any of them writes, and all
 * get through. Here the use is recorded first and the count read afterwards,
 * so every request in a burst sees the others. A refused use is removed
 * again, so a customer retrying while limited does not extend their own
 * lockout.
 *
 * The one cost of recording first is that two requests arriving together at
 * the very edge of a budget can both be refused. A throttle erring towards
 * refusal for a moment is the right way round.
 *
 * Fails open on a database error, like `checkRateLimit` and for the same
 * reason: this is a throttle, not a gate.
 */
export async function consumeRateLimit(
  budgets: readonly RateLimitBudget[],
  windowMs: number = WINDOW_MS
): Promise<RateLimitVerdict> {
  if (budgets.length === 0) return { allowed: true, remaining: Number.MAX_SAFE_INTEGER }

  const since = new Date(Date.now() - windowMs)
  let insertedIds: string[]
  let counts: number[]

  try {
    const inserted = await prisma.loginAttempt.createManyAndReturn({
      data: budgets.map(({ key }) => ({
        scope: key.scope,
        identifierHash: hashIdentifier(key.scope, key.identifier),
      })),
      select: { id: true },
    })
    insertedIds = inserted.map((row) => row.id)

    counts = await Promise.all(
      budgets.map(({ key }) =>
        prisma.loginAttempt.count({
          where: {
            scope: key.scope,
            identifierHash: hashIdentifier(key.scope, key.identifier),
            createdAt: { gte: since },
          },
        })
      )
    )
  } catch (error) {
    console.error("[rate-limit] failed to consume an attempt", error)

    return { allowed: true, remaining: 0 }
  }

  if (budgets.some((budget, index) => counts[index] > budget.max)) {
    try {
      await prisma.loginAttempt.deleteMany({ where: { id: { in: insertedIds } } })
    } catch (error) {
      // The refusal stands either way; a leftover row only shortens the
      // caller's next window slightly.
      console.error("[rate-limit] failed to remove a refused attempt", error)
    }

    return { allowed: false, remaining: 0 }
  }

  return {
    allowed: true,
    remaining: Math.min(...budgets.map((budget, index) => budget.max - counts[index])),
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
  await recordAttempt(keys)
}

/**
 * Records one attempt against every key, whatever its outcome.
 *
 * For limits that count *uses* rather than failures — a reset email is sent,
 * a quote request is stored — where success is the very thing being
 * throttled. Same best-effort contract as `recordFailedAttempt`.
 */
export async function recordAttempt(keys: RateLimitKey[]): Promise<void> {
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
 * The cutoff is a multiple of the *longest* window any scope uses rather than
 * of the sign-in window, so a row is only removed once it is comfortably
 * irrelevant to every live count — the quote-request window is an hour, and
 * pruning at four sign-in windows would have cut exactly on its edge.
 */
export async function pruneExpiredAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - Math.max(WINDOW_MS, QUOTE_REQUEST_WINDOW_MS) * 2)

  try {
    await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } })
  } catch (error) {
    console.error("[rate-limit] failed to prune expired attempts", error)
  }
}
