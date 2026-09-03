import { existsSync } from "node:fs"

import { config } from "dotenv"
import { expect, test } from "@playwright/test"

import { Client } from "pg"

import { adminPath } from "../../src/lib/constants/admin-routes"

/**
 * The administrator sign-in throttle, end to end.
 *
 * The limiter's own logic is covered exhaustively by
 * tests/unit/login-rate-limit.test.ts. What only a browser can prove is that
 * it is actually *wired*: that `signInAction` consults it before checking a
 * password, and that the refusal reaches the form as something a person can
 * read rather than as a generic failure.
 *
 * ── Why this cannot lock the rest of the suite out ────────────────────
 * The limiter counts by email and by client IP, and this test deliberately
 * spends the IP budget. That would be a problem if the authenticated
 * projects signed in the same way — but they do not:
 * `tests/e2e/setup/admin-session.setup.ts` mints a Supabase recovery link
 * and exchanges it at /auth/confirm, never touching `signInAction`. Nothing
 * else in the suite posts the sign-in form.
 *
 * The email used is a random address that belongs to no account, so no real
 * administrator is locked out either.
 *
 * ── Why one project, serial ───────────────────────────────────────────
 * Four browser projects each firing eight attempts would race on the shared
 * IP counter and the assertions would depend on which finished first. This
 * runs once, in order.
 *
 * ── Why it clears the counters around itself ──────────────────────────
 * The email is fresh every run, but the IP counter is not: a previous run
 * leaves attempts in the window, so the second run of the day would trip
 * the limit early and fail against its own history rather than against the
 * code. Clearing before and after makes the test deterministic and leaves
 * nothing behind.
 *
 * The delete is scoped to the "admin-login:" prefix and touches no other
 * table. LoginAttempt is ephemeral throttling state that the limiter prunes
 * on its own, so emptying it costs nothing beyond a brief window in which
 * the limit is unspent — which is exactly the state it is in most of the
 * time anyway.
 *
 * It talks to Postgres through `pg` rather than through Prisma. The
 * application's client is marked `server-only` and cannot be loaded here,
 * and the generated client is an ESM module that Playwright's transform
 * refuses. One parameterised DELETE needs neither — the same spirit as the
 * raw Supabase admin call in setup/admin-session.setup.ts.
 */

test.describe.configure({ mode: "serial" })

// Matches prisma.config.ts and the setup project: read .env.local when it
// exists, otherwise rely on real environment variables (Codespaces, CI).
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

/** Every bucket this spec is allowed to clear. */
const LOGIN_SCOPE_PREFIX = "admin-login:"

async function clearLoginAttempts() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) return

  const client = new Client({ connectionString })
  await client.connect()

  try {
    // Parameterised, and prefix-scoped so it can only ever reach the
    // sign-in buckets — a bare DELETE here would be a footgun the moment
    // another feature starts using this table.
    await client.query('DELETE FROM "LoginAttempt" WHERE "scope" LIKE $1', [
      `${LOGIN_SCOPE_PREFIX}%`,
    ])
  } finally {
    await client.end()
  }
}

test.beforeAll(clearLoginAttempts)
test.afterAll(clearLoginAttempts)

/** Must match ADMIN_LOGIN_MAX_ATTEMPTS in src/lib/auth/rate-limit.ts. */
const MAX_ATTEMPTS = 7

const RATE_LIMITED_MESSAGE = "429 Too many attempts, try again in 15 min"
const CREDENTIAL_ERROR = "Those details did not match an active administrator account."

test("refuses further sign-in attempts after the budget is spent", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chrome",
    "Spends a shared IP budget — running it per project would race with itself."
  )

  // Long: this posts the form eight times, each a full Server Action round
  // trip against a dev server that compiles on first request.
  test.setTimeout(180_000)

  // Unique per run so a previous run's spent budget cannot fail this one,
  // and so no real administrator's account is ever the one being throttled.
  const email = `rate-limit-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`

  await page.goto(adminPath("/login"))

  const alert = page.locator('[data-slot="alert"]')
  const submit = page.getByRole("button", { name: /sign in|signing in/i })

  /**
   * Posts the form once and waits for the action to settle.
   *
   * Waiting on the *button* rather than on the alert is the load-bearing
   * part. An alert from the previous attempt is still on screen when the
   * next one starts, so "wait for an alert" returns immediately and the
   * following `fill` lands while React is mid-submit — which clears the
   * password field and posts an empty one, failing validation instead of
   * the credential check. The button is disabled and reads "Signing in"
   * for exactly the duration of the action, so its return to the enabled
   * state is the unambiguous signal that a response has been rendered.
   */
  async function attempt() {
    await page.getByLabel("Email address").fill(email)
    await page.getByLabel("Password").fill("not-the-right-password")
    await submit.click()
    await expect(submit).toBeDisabled()
    await expect(submit).toBeEnabled({ timeout: 30_000 })
  }

  // The attempts inside the budget must fail on the credentials, not on the
  // limit. If the limiter were off by one this is where it would show.
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await attempt()
    await expect(alert, `attempt ${i + 1} of ${MAX_ATTEMPTS}`).toContainText(
      CREDENTIAL_ERROR
    )
  }

  // The next one is refused before the password is looked at.
  await attempt()
  await expect(alert).toContainText(RATE_LIMITED_MESSAGE)

  // The email field survives the refusal, so the person is not retyping it
  // alongside everything else that has just gone wrong.
  await expect(page.getByLabel("Email address")).toHaveValue(email)
})
