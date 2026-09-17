import { expect, test } from "@playwright/test"
import { ADMIN_BASE_PATH, adminPath } from "../../../src/lib/constants/admin-routes"
import { adminUrlPattern } from "../setup/paths"
import { signInAsAdmin } from "../setup/sign-in"

/**
 * Signed-in tests for the dashboard shell.
 *
 * These run only when a session can be created (see playwright.config.ts).
 * Everything in tests/e2e/*.spec.ts stays signed out and covers the refusal
 * side; this directory covers what an administrator actually sees.
 *
 * The sign-out test signs in with a session of its own and ends only that one.
 */

test.describe("dashboard shell", () => {
  test("shows the navigation, grouped, with the current page marked", async ({ page, isMobile }) => {
    await page.goto(ADMIN_BASE_PATH)

    if (isMobile) {
      // Below lg the rail is not rendered at all — not rendered-and-hidden,
      // which would put every link in a phone user's tab order invisibly.
      await expect(page.getByRole("navigation", { name: "Dashboard" })).toBeHidden()
      await page.getByRole("button", { name: "Open dashboard menu" }).click()
    }

    const nav = page.getByRole("navigation", { name: "Dashboard" })
    await expect(nav).toBeVisible()

    await expect(nav.getByRole("heading", { name: "Inventory" })).toBeVisible()
    await expect(nav.getByRole("heading", { name: "Commerce" })).toBeVisible()

    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page")
    await expect(nav.getByRole("link", { name: "Vehicles" })).toHaveAttribute("href", adminPath("/vehicles"))
    await expect(nav.getByRole("link", { name: "Spare Parts" })).toHaveAttribute("href", adminPath("/spare-parts"))
  })

  test("moves between sections and updates the active item", async ({ page, isMobile }) => {
    await page.goto(ADMIN_BASE_PATH)

    if (isMobile) {
      await page.getByRole("button", { name: "Open dashboard menu" }).click()
    }

    await page.getByRole("navigation", { name: "Dashboard" }).getByRole("link", { name: "Settings" }).click()

    await expect(page).toHaveURL(adminUrlPattern("/settings", { exact: true }))
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings")

    if (isMobile) {
      // The drawer must close on navigation, or the page the operator asked
      // for is hidden behind the menu they used to get there.
      await expect(page.getByRole("navigation", { name: "Dashboard" })).toBeHidden()
    }
  })

  test("keeps View site in the top bar at every width", async ({ page }) => {
    await page.goto(ADMIN_BASE_PATH)

    const viewSite = page.getByRole("link", { name: /View site/ })
    await expect(viewSite).toBeVisible()
    await expect(viewSite).toHaveAttribute("target", "_blank")
  })

  test("opens the account menu with the administrator, account settings and theme", async ({ page }) => {
    await page.goto(ADMIN_BASE_PATH)

    await page.getByRole("button", { name: /Account menu for/ }).click()

    const menu = page.getByRole("menu")
    await expect(menu).toBeVisible()
    await expect(menu.getByText("Administrator")).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: "Account settings" })).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeVisible()

    // The theme switch applies immediately, keeps the menu open, and survives
    // a reload — so it is restored to what it was before the test.
    const root = page.locator("html")
    const wasDark = await root.evaluate((element) => element.classList.contains("dark"))

    await menu.getByRole("menuitem", { name: "Dark mode" }).click()
    await expect(menu).toBeVisible()
    await expect(root).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/)

    await page.reload()
    await expect(root).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/)

    await page.getByRole("button", { name: /Account menu for/ }).click()
    await page.getByRole("menu").getByRole("menuitem", { name: "Dark mode" }).click()
    await expect(root).toHaveClass(wasDark ? /\bdark\b/ : /^(?!.*\bdark\b)/)
  })

  test("takes the administrator to their account from the menu", async ({ page }) => {
    await page.goto(ADMIN_BASE_PATH)

    await page.getByRole("button", { name: /Account menu for/ }).click()
    await page.getByRole("menuitem", { name: "Account settings" }).click()

    await expect(page).toHaveURL(adminUrlPattern("/settings/security", { exact: true }))
  })

  test("offers a working way out", async ({ browser }) => {
    // Its own session, never the shared one: signing out really ends a
    // session, so ending the shared one would sign every other test out too.
    const context = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    await signInAsAdmin(page)

    await page.getByRole("button", { name: /Account menu for/ }).click()
    await page.getByRole("menuitem", { name: "Sign out" }).click()

    await expect(page).toHaveURL(adminUrlPattern("/login"))

    // And the session is genuinely gone, not just navigated away from.
    await page.goto(ADMIN_BASE_PATH)
    await expect(page).toHaveURL(adminUrlPattern("/login"))

    await context.close()
  })
})
