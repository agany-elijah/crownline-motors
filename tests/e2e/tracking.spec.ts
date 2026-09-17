import { expect, test } from "@playwright/test"

/**
 * Track My Order, signed out, as a customer uses it.
 *
 * The explanation and every refusal are checked against any database. The
 * found case needs a real shipment, so it runs only when
 * `E2E_TRACKING_NUMBER` names one — a tracking lookup is read-only, so it is
 * safe against any environment that has one.
 */

test.describe("Track My Order", () => {
  test("explains the journey in a few major stages for vehicles and parts", async ({ page }) => {
    await page.goto("/track-my-order")

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("heading", { name: "What your order goes through" })).toBeVisible()

    const vehicleStages = page.getByRole("tabpanel").filter({ visible: true }).getByRole("listitem")
    await expect(vehicleStages).toHaveCount(5)

    await page.getByRole("tab", { name: "Spare parts" }).click()
    await expect(page.getByRole("tabpanel").filter({ visible: true }).getByRole("listitem")).toHaveCount(4)

    // Where the number comes from, and a way in for someone who has not ordered.
    await expect(page.getByText(/shared with you by our team via WhatsApp or email/)).toBeVisible()
    await expect(page.getByRole("link", { name: "View our inventory" })).toHaveAttribute("href", "/cars")
  })

  test("refuses something that is not a tracking number, without looking it up", async ({ page }) => {
    await page.goto("/track-my-order")

    await page.getByRole("textbox", { name: "Tracking number" }).fill("not a number")
    await page.getByRole("button", { name: "Track order" }).click()

    await expect(page).toHaveURL(/number=not/)
    await expect(page.getByRole("heading", { name: "That doesn't look like a tracking number" })).toBeVisible()
  })

  test("says plainly when a well-formed number matches nothing", async ({ page }) => {
    await page.goto("/track-my-order?number=CLM-1999-999999")

    await expect(page.getByRole("heading", { name: "We couldn't find that order" })).toBeVisible()
    // A result page is one customer's shipment and is kept out of search engines.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
  })

  test("shows the current stage and the journey for a real shipment", async ({ page }) => {
    const trackingNumber = process.env.E2E_TRACKING_NUMBER
    test.skip(!trackingNumber, "Set E2E_TRACKING_NUMBER to a real shipment to run this")

    await page.goto(`/track-my-order?number=${encodeURIComponent(trackingNumber!)}`)

    const result = page.getByRole("article", { name: /./ })
    await expect(result.getByText(trackingNumber!)).toBeVisible()
    await expect(result.getByText(/Current stage|Journey complete/)).toBeVisible()
    await expect(result.getByRole("list", { name: "Order journey" }).getByRole("listitem")).not.toHaveCount(0)
  })
})

test.describe("Services in the header", () => {
  test("holds Track My Order and Get a Quote, beside one inventory button", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1280, "The inline header nav starts at the xl breakpoint")

    await page.goto("/")
    const header = page.getByRole("banner")

    await expect(header.getByRole("link", { name: /Browse Inventory/ })).toHaveAttribute("href", "/cars")
    await expect(header.getByRole("link", { name: "Track Order" })).toHaveCount(0)

    await header.getByRole("button", { name: "Services" }).click()
    // The menu is portalled to the end of <body>, after the footer's own
    // Track My Order link — so the last match is the one the menu opened.
    const menuLink = page.getByRole("link", { name: "Track My Order" }).last()
    await expect(menuLink).toBeVisible()
    await expect(header.getByRole("link", { name: "Track My Order" })).toHaveCount(0)
    await menuLink.click()
    await expect(page).toHaveURL(/\/track-my-order$/, { timeout: 45_000 })
  })
})
