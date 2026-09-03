import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The administrator sign-in throttle: seven attempts per fifteen minutes,
 * counted per email address and per client IP.
 *
 * Written against the limiter rather than the action because this is where
 * the decisions live, and because the interesting cases are the ones that
 * must refuse. What is pinned here:
 *
 *   - the budget and window the business asked for, so a later "tidy-up"
 *     cannot quietly loosen them;
 *   - that the identifier is hashed before it reaches the database, because
 *     this table would otherwise accumulate staff addresses beside the IPs
 *     they sign in from;
 *   - that the strictest key decides, so an exhausted IP is not rescued by a
 *     fresh email;
 *   - that a database failure lets the request through rather than locking
 *     the dashboard, which is the one place this module deliberately fails
 *     open.
 */

interface CountCall {
  where: {
    scope: string
    identifierHash: string
    createdAt: { gte: Date }
  }
}

let countCalls: CountCall[] = []
let createManyData: { scope: string; identifierHash: string }[] = []
let deleteManyCalls: unknown[] = []

/** Per-scope answer for the next `count`, keyed by scope. */
let countsByScope: Record<string, number> = {}
let countShouldThrow = false

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loginAttempt: {
      count: async (args: CountCall) => {
        if (countShouldThrow) throw new Error("database unavailable")
        countCalls.push(args)
        return countsByScope[args.where.scope] ?? 0
      },
      createMany: async (args: { data: { scope: string; identifierHash: string }[] }) => {
        createManyData.push(...args.data)
        return { count: args.data.length }
      },
      deleteMany: async (args: unknown) => {
        deleteManyCalls.push(args)
        return { count: 0 }
      },
    },
  },
}))

const {
  ADMIN_LOGIN_MAX_ATTEMPTS,
  ADMIN_LOGIN_RATE_LIMITED_MESSAGE,
  ADMIN_LOGIN_WINDOW_MINUTES,
  RATE_LIMIT_SCOPES,
  checkRateLimit,
  clearAttempts,
  recordFailedAttempt,
} = await import("@/lib/auth/rate-limit")

const EMAIL_KEY = {
  scope: RATE_LIMIT_SCOPES.adminLoginEmail,
  identifier: "operator@crownlinemotors.com",
} as const

const IP_KEY = {
  scope: RATE_LIMIT_SCOPES.adminLoginIp,
  identifier: "203.0.113.10",
} as const

beforeEach(() => {
  countCalls = []
  createManyData = []
  deleteManyCalls = []
  countsByScope = {}
  countShouldThrow = false
})

describe("the configured limit", () => {
  it("is seven attempts over fifteen minutes", () => {
    // The numbers the business specified. A test that merely restates a
    // constant is usually noise; here it is the record of a decision, and
    // the message below quotes both.
    expect(ADMIN_LOGIN_MAX_ATTEMPTS).toBe(7)
    expect(ADMIN_LOGIN_WINDOW_MINUTES).toBe(15)
  })

  it("states the limit in the message the operator sees", () => {
    expect(ADMIN_LOGIN_RATE_LIMITED_MESSAGE).toBe(
      "429 Too many attempts, try again in 15 min"
    )
  })
})

describe("checkRateLimit", () => {
  it("allows an attempt while the budget is unspent", async () => {
    countsByScope[RATE_LIMIT_SCOPES.adminLoginEmail] = ADMIN_LOGIN_MAX_ATTEMPTS - 1

    const verdict = await checkRateLimit([EMAIL_KEY])

    expect(verdict.allowed).toBe(true)
    expect(verdict.remaining).toBe(1)
  })

  it("refuses the attempt that would exceed the budget", async () => {
    // Seven recorded failures means seven have been *used*, so the eighth is
    // the one refused. Off-by-one here is the difference between the limit
    // the business asked for and one more try than they agreed to.
    countsByScope[RATE_LIMIT_SCOPES.adminLoginEmail] = ADMIN_LOGIN_MAX_ATTEMPTS

    const verdict = await checkRateLimit([EMAIL_KEY])

    expect(verdict.allowed).toBe(false)
    expect(verdict.remaining).toBe(0)
  })

  it("refuses when any single key is exhausted", async () => {
    // The attack this closes: rotating the email address from one host would
    // keep every per-email counter fresh, so the host's own counter has to
    // be able to refuse on its own.
    countsByScope[RATE_LIMIT_SCOPES.adminLoginEmail] = 0
    countsByScope[RATE_LIMIT_SCOPES.adminLoginIp] = ADMIN_LOGIN_MAX_ATTEMPTS

    const verdict = await checkRateLimit([EMAIL_KEY, IP_KEY])

    expect(verdict.allowed).toBe(false)
    expect(verdict.remaining).toBe(0)
  })

  it("counts only attempts inside the rolling window", async () => {
    const before = Date.now()
    await checkRateLimit([EMAIL_KEY])
    const after = Date.now()

    const cutoff = countCalls[0].where.createdAt.gte.getTime()
    const windowMs = ADMIN_LOGIN_WINDOW_MINUTES * 60 * 1000

    expect(cutoff).toBeGreaterThanOrEqual(before - windowMs)
    expect(cutoff).toBeLessThanOrEqual(after - windowMs)
  })

  it("never sends the raw identifier to the database", async () => {
    await checkRateLimit([EMAIL_KEY, IP_KEY])

    for (const call of countCalls) {
      expect(call.where.identifierHash).not.toContain(EMAIL_KEY.identifier)
      expect(call.where.identifierHash).not.toContain(IP_KEY.identifier)
      // SHA-256, hex.
      expect(call.where.identifierHash).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it("gives the same identifier different hashes in different scopes", async () => {
    // The hash is over "<scope>:<identifier>". Without the scope, a value
    // that happened to appear as both an email and an IP would share a
    // counter, and expiring one bucket would expire the other.
    await checkRateLimit([
      { scope: RATE_LIMIT_SCOPES.adminLoginEmail, identifier: "same-value" },
      { scope: RATE_LIMIT_SCOPES.adminLoginIp, identifier: "same-value" },
    ])

    expect(countCalls[0].where.identifierHash).not.toBe(
      countCalls[1].where.identifierHash
    )
  })

  it("allows the attempt when the datastore is unreachable", async () => {
    // Deliberately fails open. This is a throttle, not an authorisation
    // gate: failing closed would turn any database blip into a total
    // lockout of the dashboard, including for whoever is trying to fix it.
    // Authentication itself still has to succeed afterwards.
    countShouldThrow = true
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const verdict = await checkRateLimit([EMAIL_KEY])

    expect(verdict.allowed).toBe(true)
    // Failing open silently would be the actual bug — the operator has to be
    // able to find out the limiter stopped working.
    expect(errorSpy).toHaveBeenCalled()
  })
})

describe("recordFailedAttempt", () => {
  it("records one hashed row per key", async () => {
    await recordFailedAttempt([EMAIL_KEY, IP_KEY])

    expect(createManyData).toHaveLength(2)
    expect(createManyData.map((row) => row.scope)).toEqual([
      RATE_LIMIT_SCOPES.adminLoginEmail,
      RATE_LIMIT_SCOPES.adminLoginIp,
    ])

    for (const row of createManyData) {
      expect(row.identifierHash).toMatch(/^[0-9a-f]{64}$/)
      expect(row.identifierHash).not.toContain("@")
    }
  })

  it("writes the same hash the check reads", async () => {
    // If these two ever disagree, every attempt is recorded and none is
    // ever counted — a limiter that looks busy and blocks nothing.
    await recordFailedAttempt([EMAIL_KEY])
    await checkRateLimit([EMAIL_KEY])

    expect(countCalls[0].where.identifierHash).toBe(createManyData[0].identifierHash)
  })

  it("does nothing when given no keys", async () => {
    await recordFailedAttempt([])

    expect(createManyData).toHaveLength(0)
  })
})

describe("clearAttempts", () => {
  it("clears every key of a successful sign-in together", async () => {
    await clearAttempts([EMAIL_KEY, IP_KEY])

    expect(deleteManyCalls).toHaveLength(1)
    expect(deleteManyCalls[0]).toMatchObject({
      where: {
        OR: [
          { scope: RATE_LIMIT_SCOPES.adminLoginEmail },
          { scope: RATE_LIMIT_SCOPES.adminLoginIp },
        ],
      },
    })
  })

  it("does nothing when given no keys", async () => {
    // A no-key call must not compile down to `deleteMany({ where: { OR: [] } })`,
    // which Postgres reads as "match everything" — that would wipe the whole
    // table and disarm the limiter for every account at once.
    await clearAttempts([])

    expect(deleteManyCalls).toHaveLength(0)
  })
})
