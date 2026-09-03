import { existsSync } from "node:fs"
import { config } from "dotenv"
import { defineConfig, devices, type Project } from "@playwright/test"

import { ADMIN_STORAGE_STATE } from "./tests/e2e/setup/paths"

// Loaded here as well as in the setup file, because this config is evaluated
// before any test file and decides which projects exist based on env.
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

/**
 * Whether a signed-in session can be created for this run.
 *
 * The authenticated projects are omitted entirely when it cannot, rather
 * than being scheduled and skipped. A skipped project still reports as a
 * kind of success, and "the admin tests did not run" is exactly the thing
 * that should be obvious rather than buried in a summary line.
 *
 * E2E_ADMIN_EMAIL must be set deliberately: defaulting it would let the
 * suite sign in as, and write settings for, whichever administrator happened
 * to exist — including in an environment nobody meant to point it at.
 */
const canAuthenticate = Boolean(
  process.env.E2E_ADMIN_EMAIL &&
    process.env.SUPABASE_SECRET_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL
)

// Mobile is a first-class target, not an afterthought (brief §16: most
// customers arrive on a phone). Stage 33 requires every priority workflow to
// be verified on Android, iPhone and desktop, so those viewports are part of
// the default run rather than an opt-in extra project.
//
// The tablet project completes the Stage 4 validation gate, which calls for
// the shell to be checked at desktop, tablet AND mobile. It is not a
// redundant middle size: at 1024px the inline nav has already given way to
// the drawer while the viewport is nowhere near phone-sized, so it is the
// only project that exercises the drawer at a width where the layout around
// it is still desktop-shaped.
const publicProjects: Project[] = [
  { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  { name: "tablet-safari", use: { ...devices["iPad Pro 11 landscape"] } },
  { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
].map((project) => ({
  ...project,
  // Everything outside tests/e2e/admin/ runs signed out. Keeping the split
  // by directory rather than by filename means a new spec lands in the right
  // mode by where it is saved, not by remembering a naming convention.
  testIgnore: ["**/admin/**", "**/setup/**"],
}))

/**
 * Signed-in projects.
 *
 * Desktop and one phone only. The admin dashboard's responsive behaviour
 * worth testing is "does the sidebar become a drawer", and that is one
 * breakpoint — running four browsers over the same authenticated flows would
 * quadruple the slowest part of the suite to re-prove it.
 */
const authenticatedProjects: Project[] = canAuthenticate
  ? [
      {
        name: "setup",
        testMatch: /setup\/.*\.setup\.ts/,
      },
      {
        name: "admin-desktop",
        use: { ...devices["Desktop Chrome"], storageState: ADMIN_STORAGE_STATE },
        dependencies: ["setup"],
        testMatch: "**/admin/**",
      },
      {
        name: "admin-mobile",
        use: { ...devices["Pixel 7"], storageState: ADMIN_STORAGE_STATE },
        dependencies: ["setup"],
        testMatch: "**/admin/**",
      },
    ]
  : []

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,

  /**
   * 60s rather than Playwright's 30s default.
   *
   * The webServer below runs `next dev`, which compiles each route on first
   * request. On a slower filesystem — a Codespace, most CI runners — a cold
   * the dashboard's own compile alone has been measured at 17s, and the first request
   * to any route can exceed the default before the page has even been
   * served. That produced timeouts that looked like application faults and
   * were not.
   *
   * This comes back down when the webServer switches to `build && start`
   * (see the note there), where routes are compiled ahead of time and a
   * request that takes 30s genuinely is a fault.
   */
  timeout: 60_000,

  /**
   * 15s rather than Playwright's 5s default for `expect(...)`.
   *
   * Assertions that wait on a navigation — `toHaveURL` after a form submit —
   * are bounded by this, not by `navigationTimeout`. In dev the destination
   * route compiles on first request, which on this filesystem has been
   * measured at 17s, so the default expired while the server was still
   * working and reported a passing action as a failure. Four vehicles were
   * created correctly by a run that reported four failures.
   */
  expect: { timeout: 15_000 },

  // Prevents a stray test.only from silently narrowing the suite in CI.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "html",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Same reasoning as `timeout` above: a first navigation to an
    // uncompiled route is slow in dev, and that is not the application
    // being slow.
    navigationTimeout: 45_000,
  },

  projects: [...publicProjects, ...authenticatedProjects],

  webServer: {
    // Dev server keeps the local loop fast. When Playwright joins CI
    // (Stage 40 defers it until the runner supports it reliably), switch
    // this to a production `build && start` so the suite exercises the
    // same output that ships.
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
