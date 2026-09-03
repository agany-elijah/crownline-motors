import { expect, test } from "@playwright/test"
import { adminPath } from "../../../src/lib/constants/admin-routes"

/**
 * The settings form is the application's first write path, so these tests
 * cover the whole of it: validation the browser cannot be trusted to do,
 * the save actually persisting, and — most importantly — a payment split
 * that does not total 100% being refused.
 *
 * That last rule has no database constraint behind it. Prisma cannot express
 * a cross-column check, so the Zod schema is the only thing preventing an
 * order whose milestones never add up to the price the customer agreed.
 *
 * These tests write to the real settings row, so each one restores what it
 * found. A test suite that leaves the business misconfigured is worse than
 * no test suite.
 */

const FIELDS = {
  whatsapp: 'input[name="whatsappNumber"]',
  initial: 'input[name="defaultInitialPercentage"]',
  mombasa: 'input[name="defaultMombasaPercentage"]',
  final: 'input[name="defaultFinalPercentage"]',
}

async function readForm(page: import("@playwright/test").Page) {
  return {
    whatsapp: await page.locator(FIELDS.whatsapp).inputValue(),
    initial: await page.locator(FIELDS.initial).inputValue(),
    mombasa: await page.locator(FIELDS.mombasa).inputValue(),
    final: await page.locator(FIELDS.final).inputValue(),
  }
}

test.describe("business settings", () => {
  test("loads the values currently stored", async ({ page }) => {
    await page.goto(adminPath("/settings"))

    const values = await readForm(page)

    // Whatever they are, the three stages on screen must already be a valid
    // split — otherwise the page is showing a state the form would refuse to
    // save, which is a contradiction an operator cannot resolve.
    const total =
      Math.round(Number(values.initial) * 100) +
      Math.round(Number(values.mombasa) * 100) +
      Math.round(Number(values.final) * 100)

    expect(total).toBe(10_000)
  })

  test("shows a running total while typing", async ({ page }) => {
    await page.goto(adminPath("/settings"))

    await page.locator(FIELDS.mombasa).fill("30")

    const total = page.locator('[aria-live="polite"]')
    await expect(total).toContainText("105.00%")
    await expect(total).toContainText("must be 100%")
  })

  test("refuses a split that does not total 100%", async ({ page }) => {
    await page.goto(adminPath("/settings"))
    const before = await readForm(page)

    await page.locator(FIELDS.mombasa).fill("30")
    await page.getByRole("button", { name: "Save settings" }).click()

    await expect(page.locator('[data-slot="alert"]')).toContainText(
      "Check the highlighted fields"
    )
    await expect(page.getByText("must add up to exactly 100%")).toBeVisible()

    // The rejection must not have written anything.
    await page.reload()
    expect(await readForm(page)).toEqual(before)
  })

  test("saves a valid change and persists it", async ({ page }) => {
    await page.goto(adminPath("/settings"))
    const before = await readForm(page)

    // A number that is obviously a test value, so if a restore ever fails
    // the wrong state is recognisable rather than plausible.
    const testNumber = "+211700000001"

    try {
      await page.locator(FIELDS.whatsapp).fill(testNumber)
      await page.getByRole("button", { name: "Save settings" }).click()

      await expect(page.locator('[data-slot="alert"]')).toContainText(
        "Settings saved."
      )

      // Reload rather than trusting the optimistic-looking form state: the
      // point is that it reached the database, not that the button worked.
      await page.reload()
      expect(await page.locator(FIELDS.whatsapp).inputValue()).toBe(testNumber)
    } finally {
      await page.goto(adminPath("/settings"))
      await page.locator(FIELDS.whatsapp).fill(before.whatsapp)
      await page.locator(FIELDS.initial).fill(before.initial)
      await page.locator(FIELDS.mombasa).fill(before.mombasa)
      await page.locator(FIELDS.final).fill(before.final)
      await page.getByRole("button", { name: "Save settings" }).click()
      await expect(page.locator('[data-slot="alert"]')).toContainText(
        "Settings saved."
      )
    }
  })

  test("rejects a malformed WhatsApp number", async ({ page }) => {
    await page.goto(adminPath("/settings"))

    await page.locator(FIELDS.whatsapp).fill("12")
    await page.getByRole("button", { name: "Save settings" }).click()

    await expect(page.getByText("Enter a full international number")).toBeVisible()
  })

  test("accepts an empty WhatsApp number as 'not configured'", async ({ page }) => {
    // Empty is a legitimate state: every WhatsApp call-to-action renders
    // nothing rather than linking to a number that does not answer.
    await page.goto(adminPath("/settings"))
    const before = await readForm(page)

    try {
      await page.locator(FIELDS.whatsapp).fill("")
      await page.getByRole("button", { name: "Save settings" }).click()

      await expect(page.locator('[data-slot="alert"]')).toContainText(
        "Settings saved."
      )
    } finally {
      await page.goto(adminPath("/settings"))
      await page.locator(FIELDS.whatsapp).fill(before.whatsapp)
      await page.getByRole("button", { name: "Save settings" }).click()
      await expect(page.locator('[data-slot="alert"]')).toContainText(
        "Settings saved."
      )
    }
  })
})
