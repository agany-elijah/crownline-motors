import { expect, test } from "@playwright/test"

/**
 * The Get a Quote page renders the shared request form in its open, detailed
 * mode. Submitting is not exercised here: it writes a real quote and customer,
 * which this suite must not leave behind. The form's server behaviour is
 * covered by the quote-request unit tests.
 */

test.describe("Get a Quote", () => {
  test("offers the open request form for a vehicle or parts", async ({ page }) => {
    await page.goto("/get-a-quote")

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByLabel("Full name")).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Phone number" })).toBeVisible()

    await page.getByText("Spare parts", { exact: true }).first().click()
    await expect(page.getByRole("textbox", { name: "Part name" })).toBeVisible()

    await expect(page.getByRole("button", { name: "Request my quote" })).toBeVisible()
  })

  test("refuses an empty request on the server and keeps the customer on the page", async ({ page }) => {
    await page.goto("/get-a-quote")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "Request my quote" }).click()
    await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 30_000 })
    await expect(page).toHaveURL(/\/get-a-quote/)
  })
})
