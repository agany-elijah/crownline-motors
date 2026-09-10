import { expect, test } from "@playwright/test"
import { ADMIN_BASE_PATH, adminPath } from "../../../src/lib/constants/admin-routes"
import { adminUrlPattern } from "../setup/paths"

/**
 * Signed-in tests for the dashboard shell.
 *
 * These run only when a session can be created (see playwright.config.ts).
 * Everything in tests/e2e/*.spec.ts stays signed out and covers the refusal
 * side; this directory covers what an administrator actually sees.
 */

test.describe("dashboard shell", () => {
  test("shows the navigation, grouped, with the current page marked", async ({
    page,
    isMobile,
  }) => {
    await page.goto(ADMIN_BASE_PATH)

    if (isMobile) {
      // Below lg the rail is not rendered at all — not rendered-and-hidden,
      // which would put every link in a phone user's tab order invisibly.
      await expect(page.getByRole("navigation", { name: "Dashboard" })).toBeHidden()
      await page.getByRole("button", { name: "Open dashboard menu" }).click()
    }

    const nav = page.getByRole("navigation", { name: "Dashboard" })
    await expect(nav).toBeVisible()

    await expect(nav.getByRole("heading", { name: "Commerce" })).toBeVisible()
    await expect(nav.getByRole("heading", { name: "Logistics" })).toBeVisible()

    // aria-current is the accessible half of the active state; the gold rail
    // is the visual half. Asserting the former means the signal survives for
    // someone who cannot see the latter.
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  test("marks unbuilt sections as coming rather than linking into nothing", async ({
    page,
    isMobile,
  }) => {
    await page.goto(ADMIN_BASE_PATH)

    if (isMobile) {
      await page.getByRole("button", { name: "Open dashboard menu" }).click()
    }

    const nav = page.getByRole("navigation", { name: "Dashboard" })

    // Quotes has no route until Phase 10, so it must render as inert text —
    // a link would be a 404. Both inventory sections shipped (Phase 5 and
    // Phase 9) and are live links, asserted alongside so this test keeps
    // proving the distinction rather than just the disabled case.
    //
    // Spare Parts used to be the disabled example here. When a section is
    // built, move this assertion to the next unbuilt one rather than
    // deleting it — the inert rendering is the behaviour under test, and it
    // has to keep having a subject.
    await expect(nav.getByRole("link", { name: "Quotes" })).toHaveCount(0)
    await expect(nav.getByText("Quotes")).toBeVisible()

    await expect(nav.getByRole("link", { name: "Vehicles" })).toHaveAttribute(
      "href",
      adminPath("/vehicles")
    )
    await expect(nav.getByRole("link", { name: "Spare Parts" })).toHaveAttribute(
      "href",
      adminPath("/spare-parts")
    )
  })

  test("moves between sections and updates the active item", async ({
    page,
    isMobile,
  }) => {
    await page.goto(ADMIN_BASE_PATH)

    if (isMobile) {
      await page.getByRole("button", { name: "Open dashboard menu" }).click()
    }

    await page
      .getByRole("navigation", { name: "Dashboard" })
      .getByRole("link", { name: "Settings" })
      .click()

    await expect(page).toHaveURL(adminUrlPattern("/settings", { exact: true }))
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Business settings"
    )

    if (isMobile) {
      // The drawer must close on navigation, or the page the operator asked
      // for is hidden behind the menu they used to get there.
      await expect(page.getByRole("navigation", { name: "Dashboard" })).toBeHidden()
    }
  })

  test("offers a working way out", async ({ page }) => {
    await page.goto(ADMIN_BASE_PATH)

    await page.getByRole("button", { name: "Sign out" }).click()

    await expect(page).toHaveURL(adminUrlPattern("/login"))

    // And the session is genuinely gone, not just navigated away from.
    await page.goto(ADMIN_BASE_PATH)
    await expect(page).toHaveURL(adminUrlPattern("/login"))
  })
})
