import { existsSync } from "node:fs"
import { config } from "dotenv"
import { expect, test as setup } from "@playwright/test"

import { ADMIN_STORAGE_STATE } from "./paths"
import { signInAsAdmin } from "./sign-in"
import { adminPath } from "../../../src/lib/constants/admin-routes"

// Matches prisma.config.ts and the provisioning scripts: read .env.local when
// it exists, otherwise rely on real environment variables (Codespaces, CI).
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

/**
 * Establishes a signed-in administrator session once, and saves the cookies
 * for the authenticated Playwright projects to reuse.
 *
 * ── Why a recovery link rather than the login form ────────────────────
 * Filling in the form would mean keeping a real password in an environment
 * variable — a credential that outlives the test run and has to be rotated
 * like any other. A generated recovery token is single-use and expires on
 * its own, so nothing durable is stored anywhere.
 *
 * The token is redeemed through the application's own /auth/confirm route
 * rather than by injecting a cookie, so this setup exercises the real
 * session-establishment path. A harness that fabricates a session the
 * application would never issue proves nothing about the application.
 *
 * ── Why plain fetch instead of @supabase/supabase-js ──────────────────
 * That library requires Node 22+ and throws on construction under Node 20,
 * where `WebSocket` is not a global — it pulls in a realtime client this
 * code has no use for. One documented POST has no such requirement, so the
 * harness runs on whatever Node the developer happens to have. There is no
 * behaviour here worth a dependency.
 *
 * ── Why this does not weaken anything ─────────────────────────────────
 * It needs SUPABASE_SECRET_KEY, the same operator credential the
 * provisioning scripts use, and never ships to a browser. When it is absent
 * the authenticated projects are omitted from the config entirely, so the
 * suite runs narrower rather than passing on tests that never executed.
 */
setup("authenticate as an administrator", async ({ page }) => {
  /**
   * Generous, because this is the first request against a freshly started
   * `next dev` and every route on the path has to compile. On a slow
   * filesystem that has been measured well past a minute after a change
   * that invalidates the whole graph, such as an edit to globals.css.
   */
  setup.setTimeout(180_000)

  /**
   * Warm the sign-in route before minting anything.
   *
   * Order matters here. Generating the token first and then navigating
   * meant the recovery token sat unused through a cold compile — and the
   * navigation, not the token, is what timed out. Compiling first means the
   * token is created against a server that can already answer.
   */
  await page.goto(adminPath("/login"), { timeout: 120_000 })

  await signInAsAdmin(page)
  await expect(page.getByRole("navigation", { name: "Dashboard" })).toBeVisible()

  await page.context().storageState({ path: ADMIN_STORAGE_STATE })
})
