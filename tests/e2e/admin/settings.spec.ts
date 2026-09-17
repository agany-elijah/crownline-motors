import { expect, test, type Page } from "@playwright/test"
import { adminPath } from "../../../src/lib/constants/admin-routes"
import { adminUrlPattern } from "../setup/paths"

/**
 * Settings, as an administrator uses it: each section loads what is stored,
 * refuses what the business rules forbid, and persists what it accepts.
 *
 * These tests write to the real settings row, so each one that saves restores
 * what it found. A test suite that leaves the business misconfigured is worse
 * than no test suite.
 *
 * Saves are confirmed by reloading, not by trusting the form: the point is
 * that the value reached the database.
 */

async function save(page: Page) {
  await page.getByRole("button", { name: "Save changes" }).click()
}

async function expectSaved(page: Page) {
  await expect(page.getByText(/^(Settings saved\.|No changes to save\.)$/)).toBeVisible()
}

test.describe("settings navigation", () => {
  test("lists every section and marks the current one", async ({ page, isMobile }) => {
    await page.goto(adminPath("/settings"))

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings")

    const nav = page.getByRole("navigation", { name: "Settings" })
    for (const section of [
      "Business information",
      "Website & branding",
      "Commerce & payments",
      "Orders & tracking",
      "Catalogue display",
      "Notifications",
      "SEO & social",
      "Admin users & security",
    ]) {
      // Both the phone row and the desktop rail are in the DOM; one is hidden.
      await expect(nav.getByRole("link", { name: section }).filter({ visible: true })).toHaveCount(1)
    }

    await expect(
      nav.getByRole("link", { name: "Business information" }).filter({ visible: true })
    ).toHaveAttribute("aria-current", "page")

    if (!isMobile) {
      await nav.getByRole("link", { name: "Commerce & payments" }).filter({ visible: true }).click()
      await expect(page.getByRole("heading", { name: "Vehicle payment schedule" })).toBeVisible()
    }
  })
})

test.describe("business information", () => {
  test("saves a WhatsApp number and persists it", async ({ page }) => {
    await page.goto(adminPath("/settings"))
    const field = page.locator('input[name="whatsappNumber"]')
    const before = await field.inputValue()

    // Obviously a test value, so a failed restore is recognisable.
    const testNumber = "+211700000001"

    try {
      await field.fill(testNumber)
      await save(page)
      await expectSaved(page)

      await page.reload()
      await expect(page.locator('input[name="whatsappNumber"]')).toHaveValue(testNumber)

      // Live on the public site at once — the cached settings read was
      // invalidated by the save, not left to expire.
      await page.goto("/")
      await expect(page.locator('a[href*="wa.me/211700000001"]').first()).toBeAttached()
    } finally {
      await page.goto(adminPath("/settings"))
      await page.locator('input[name="whatsappNumber"]').fill(before)
      await save(page)
      await expectSaved(page)
    }
  })

  test("refuses a malformed WhatsApp number and a foreign social link", async ({ page }) => {
    await page.goto(adminPath("/settings"))

    await page.locator('input[name="whatsappNumber"]').fill("12")
    await page.locator('input[name="socialFacebook"]').fill("https://example.com/not-facebook")
    await save(page)

    await expect(page.getByText("Enter a full international number")).toBeVisible()
    await expect(page.getByText("Enter the full https:// link to your Facebook page.")).toBeVisible()
  })
})

test.describe("commerce and payments", () => {
  test("shows a running total and refuses a split that is not 100%", async ({ page }) => {
    await page.goto(adminPath("/settings/commerce"))
    const mombasa = page.locator('input[name="defaultMombasaPercentage"]')
    const before = await mombasa.inputValue()

    await mombasa.fill(String(Number(before) + 5))
    await expect(page.getByText("Must be 100%")).toBeVisible()

    await save(page)
    await expect(page.getByText("must add up to exactly 100%")).toBeVisible()

    // The refusal wrote nothing.
    await page.reload()
    await expect(page.locator('input[name="defaultMombasaPercentage"]')).toHaveValue(before)
  })
})

test.describe("orders and tracking", () => {
  test("refuses a prefix that belongs to another kind of reference", async ({ page }) => {
    await page.goto(adminPath("/settings/orders-tracking"))

    await page.locator('input[name="trackingNumberPrefix"]').fill("CLMO")
    await save(page)

    await expect(page.getByText(/used by order, quote or listing references/)).toBeVisible()
  })

  test("locks the stages that carry payment and delivery rules", async ({ page }) => {
    await page.goto(adminPath("/settings/orders-tracking"))

    // "Arrived at Mombasa" makes the Mombasa payment due; it cannot be turned
    // off or moved, and the stage beside it cannot be moved past it.
    await expect(page.getByText(/Fixed stage — makes the mombasa payment due/i)).toBeVisible()
    await expect(page.getByRole("switch", { name: /Arrived at Mombasa/ })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Move Arrived at Mombasa up" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Move Clearing up" })).toBeDisabled()
  })
})

test.describe("catalogue display", () => {
  test("saves every group's switches together", async ({ page }) => {
    await page.goto(adminPath("/settings/catalog-display"))

    const vehiclePrice = page.locator("#vehicle-visibility").getByRole("switch").first()
    const before = await vehiclePrice.isChecked()

    await save(page)
    await expectSaved(page)

    // Nothing was changed, so nothing in any group may have been reset.
    await page.reload()
    await expect(page.locator("#vehicle-visibility").getByRole("switch").first()).toBeChecked({ checked: before })
  })
})

test.describe("settings search", () => {
  test("finds a setting from a loose query and lands on it", async ({ page }) => {
    await page.goto(adminPath("/settings/commerce"))

    await page.getByRole("button", { name: "Search settings" }).click()
    await page.getByRole("combobox").fill("whatsap")
    await page.keyboard.press("Enter")

    await expect(page).toHaveURL(adminUrlPattern("/settings", { exact: false }))
    await expect(page.locator('input[name="whatsappNumber"]')).toBeFocused()
  })
})
