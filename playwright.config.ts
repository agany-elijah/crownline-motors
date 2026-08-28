import { defineConfig, devices } from "@playwright/test"

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,

  // Prevents a stray test.only from silently narrowing the suite in CI.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "html",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // Mobile is a first-class target, not an afterthought (brief §16: most
  // customers arrive on a phone). Stage 33 requires every priority workflow
  // to be verified on Android, iPhone and desktop, so those viewports are
  // part of the default run rather than an opt-in extra project.
  //
  // The tablet project completes the Stage 4 validation gate, which calls
  // for the shell to be checked at desktop, tablet AND mobile. It is not a
  // redundant middle size: at 1024px the inline nav has already given way
  // to the drawer while the viewport is nowhere near phone-sized, so it is
  // the only project that exercises the drawer at a width where the layout
  // around it is still desktop-shaped.
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "tablet-safari", use: { ...devices["iPad Pro 11 landscape"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],

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
