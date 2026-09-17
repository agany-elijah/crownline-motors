import { expect, test, type Page } from "@playwright/test"
import { ADMIN_BASE_PATH, adminPath } from "../../../src/lib/constants/admin-routes"
import { adminUrlPattern } from "../setup/paths"

/**
 * The vehicle inventory, end to end.
 *
 * These write real rows. Nothing is deleted afterwards — vehicles are never
 * deleted in this system, by design — so each test archives what it created
 * instead. Archived rows are the correct resting state for a listing that
 * should not appear anywhere, and leaving them is honest: it is exactly what
 * happens when a real listing is withdrawn.
 *
 * Every created vehicle is named so it is unmistakable in the admin list if
 * a cleanup ever fails.
 */

const TEST_MAKE = "ZZ-Test"

/** A model name unique to this run, so parallel projects cannot collide. */
function uniqueModel() {
  return `Spec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

async function fillVehicleForm(page: Page, model: string, price = "22500") {
  await page.getByLabel("Make").fill(TEST_MAKE)
  await page.getByLabel("Model").fill(model)
  await page.getByLabel("Year").fill("2021")
  await page.getByLabel("Price (USD)").fill(price)
  await page.getByLabel("Mileage (km)").fill("42000")
  await page.getByLabel("Engine size").fill("2.0L")
  await page.getByLabel("Current location").fill("Yokohama, Japan")
  await page.getByLabel("Exterior colour").fill("Black")
  await page.getByLabel("Interior colour").fill("Black")
  await page
    .getByLabel("Description")
    .fill("Automated test listing. Safe to archive — created by the e2e suite.")
}

/** Archives the vehicle currently open, so the suite leaves nothing live. */
async function archiveCurrent(page: Page) {
  const archive = page.getByRole("button", { name: "Archive" })
  if (await archive.isVisible().catch(() => false)) {
    await archive.click()
    // Waits on the action's own confirmation rather than on the status
    // description re-rendering. The message is returned by the action, so it
    // appears exactly when the write has committed — which is the thing
    // being waited for.
    await expect(page.getByText("Status changed to archived.")).toBeVisible()
  }
}

test.describe("vehicle inventory", () => {
  test("creates a vehicle as a draft with a generated reference", async ({ page }) => {
    const model = uniqueModel()

    await page.goto(adminPath("/vehicles/new"))
    await fillVehicleForm(page, model)
    await page.getByRole("button", { name: "Create vehicle" }).click()

    // Lands on the edit page for the new vehicle.
    await expect(page).toHaveURL(new RegExp(`${adminUrlPattern("/vehicles").source}/[^/]+\\?created=1$`))

    try {
      await expect(page.getByText("Vehicle created as a draft")).toBeVisible()

      // The reference is generated server-side and follows the documented
      // format — this is what goes on customer correspondence. Scoped to the
      // page heading, because it deliberately appears twice: once in the
      // header and once in the confirmation.
      await expect(
        page.getByRole("main").getByText(/CLM-V-\d{4}-\d{6}/).first()
      ).toBeVisible()

      // And the public web address is derived from it, not from a counter
      // the client could influence.
      await expect(
        page.getByText(new RegExp(`/cars/zz-test-${model.toLowerCase()}-2021-clm-v-`))
      ).toBeVisible()

      // A new listing is never live.
      await expect(page.getByText("Not visible on the website")).toBeVisible()
    } finally {
      await archiveCurrent(page)
    }
  })

  test("rejects an invalid listing and keeps what was typed", async ({ page }) => {
    const model = uniqueModel()

    await page.goto(adminPath("/vehicles/new"))
    await fillVehicleForm(page, model)

    // Three digits too many — the classic data-entry slip this bound exists
    // to catch.
    await page.getByLabel("Mileage (km)").fill("42000000")
    await page.getByRole("button", { name: "Create vehicle" }).click()

    await expect(page.getByText("That mileage looks wrong")).toBeVisible()

    // Still on the form, and nothing was created.
    await expect(page).toHaveURL(adminUrlPattern("/vehicles/new", { exact: true }))

    /**
     * And — the part this test is named for, which it did not previously
     * check — every other field still holds what was typed.
     *
     * React resets a form with a function action once the action settles,
     * on failure as well as on success. Before the action echoed the
     * submitted values back as the form's defaults, a rejected save emptied
     * seventeen fields and left the operator reading "check the highlighted
     * fields" over a blank form. Assert several, spanning a text input, a
     * number, a select and the textarea, because they fail independently.
     */
    await expect(page.getByLabel("Make")).toHaveValue(TEST_MAKE)
    await expect(page.getByLabel("Model")).toHaveValue(model)
    await expect(page.getByLabel("Price (USD)")).toHaveValue("22500")
    await expect(page.getByLabel("Mileage (km)")).toHaveValue("42000000")
    await expect(page.getByLabel("Engine size")).toHaveValue("2.0L")
    await expect(page.getByLabel("Current location")).toHaveValue("Yokohama, Japan")
    await expect(page.getByLabel("Description")).not.toBeEmpty()
  })

  test("keeps a rejected edit on screen instead of reverting it", async ({ page }) => {
    const model = uniqueModel()

    await page.goto(adminPath("/vehicles/new"))
    await fillVehicleForm(page, model)
    await page.getByRole("button", { name: "Create vehicle" }).click()
    await expect(page).toHaveURL(/\?created=1$/)

    try {
      // A price the operator meant, alongside a mileage they mistyped. The
      // save is refused — and the corrected price must survive the refusal,
      // or fixing the mileage silently reverts the price too.
      await page.getByLabel("Price (USD)").fill("19950")
      await page.getByLabel("Mileage (km)").fill("42000000")
      await page.getByRole("button", { name: "Save changes" }).click()

      await expect(page.getByText("That mileage looks wrong")).toBeVisible()
      await expect(page.getByLabel("Price (USD)")).toHaveValue("19950")
      await expect(page.getByLabel("Mileage (km)")).toHaveValue("42000000")
    } finally {
      await archiveCurrent(page)
    }
  })

  test("publishes a vehicle and warns that it has no photographs", async ({ page }) => {
    const model = uniqueModel()

    await page.goto(adminPath("/vehicles/new"))
    await fillVehicleForm(page, model)
    await page.getByRole("button", { name: "Create vehicle" }).click()
    await expect(page).toHaveURL(/\?created=1$/)

    try {
      // The warning is the point: a published listing with no images is the
      // most damaging thing this business can put on its website.
      await expect(page.getByText("This vehicle has no photographs")).toBeVisible()

      await page.getByRole("button", { name: "Publish" }).click()

      await expect(page.getByText("Live on the website")).toBeVisible()

      // Publishing opens the transitions a live listing needs, and closes
      // the ones that would be mistakes.
      await expect(page.getByRole("button", { name: "Mark reserved" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Mark sold" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0)
    } finally {
      await archiveCurrent(page)
    }
  })

  test("saves an edit without changing the public web address", async ({ page }) => {
    const model = uniqueModel()

    await page.goto(adminPath("/vehicles/new"))
    await fillVehicleForm(page, model)
    await page.getByRole("button", { name: "Create vehicle" }).click()
    await expect(page).toHaveURL(/\?created=1$/)

    try {
      const slugBefore = await page.locator("code").first().innerText()

      await page.getByLabel("Price (USD)").fill("19950")
      await page.getByRole("button", { name: "Save changes" }).click()

      // The confirmation is the signal that the write committed. Reloading
      // straight after the click raced the action and read the old value —
      // which is exactly what an operator would have done, since before this
      // change the form gave no sign it had saved.
      await expect(page.getByText("Changes saved.")).toBeVisible()

      await page.reload()
      await expect(page.getByLabel("Price (USD)")).toHaveValue("19950")

      // The slug is a public URL that gets shared and indexed. Correcting a
      // price must never change it.
      expect(await page.locator("code").first().innerText()).toBe(slugBefore)
    } finally {
      await archiveCurrent(page)
    }
  })

  test("finds a vehicle by search and filters by status", async ({ page }) => {
    const model = uniqueModel()

    await page.goto(adminPath("/vehicles/new"))
    await fillVehicleForm(page, model)
    await page.getByRole("button", { name: "Create vehicle" }).click()
    await expect(page).toHaveURL(/\?created=1$/)

    try {
      await page.goto(adminPath("/vehicles"))
      await page.getByRole("searchbox", { name: "Search vehicles" }).fill(model)

      // Filters live in the URL, so the list is shareable and survives Back.
      await expect(page).toHaveURL(new RegExp(`search=${model}`), { timeout: 15_000 })
      await expect(page.getByRole("link", { name: new RegExp(model) })).toBeVisible()

      // The vehicle is a draft, so the Published filter must exclude it.
      await page.goto(`${ADMIN_BASE_PATH}/vehicles?search=${model}&status=PUBLISHED`)
      await expect(page.getByText("No vehicles match")).toBeVisible()
    } finally {
      await page.goto(adminPath("/vehicles"))
      await page.getByRole("searchbox", { name: "Search vehicles" }).fill(model)
      await page.getByRole("link", { name: new RegExp(model) }).click()
      await archiveCurrent(page)
    }
  })

  test("shows an empty state rather than a bare table", async ({ page }) => {
    await page.goto(adminPath("/vehicles?search=definitely-no-such-vehicle-xyz"))

    await expect(page.getByText("No vehicles match")).toBeVisible()
    await expect(page.getByRole("link", { name: "Show all vehicles" })).toBeVisible()
  })
})

test.describe("vehicle status transitions", () => {
  /**
   * The transition rules used to live only in the client component that
   * renders the buttons, so the Server Action accepted any status from any
   * status. These tests come at that from both sides: the buttons a page
   * offers, and — more importantly — what the action does when a request
   * arrives that the buttons would never have produced.
   */

  test("offers only the moves that are legal from the current status", async ({
    page,
  }) => {
    const model = uniqueModel()

    await page.goto(adminPath("/vehicles/new"))
    await fillVehicleForm(page, model)
    await page.getByRole("button", { name: "Create vehicle" }).click()
    await expect(page).toHaveURL(/\?created=1$/)

    try {
      // A draft publishes or is archived. It cannot be sold or reserved.
      await expect(page.getByRole("button", { name: "Publish" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Archive" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Mark sold" })).toHaveCount(0)
      await expect(page.getByRole("button", { name: "Mark reserved" })).toHaveCount(0)

      await page.getByRole("button", { name: "Publish" }).click()
      await expect(page.getByText("Live on the website")).toBeVisible()

      await page.getByRole("button", { name: "Mark sold" }).click()
      await expect(page.getByText("Status changed to sold.")).toBeVisible()

      // Archiving is the only way out of sold. Nothing may put a vehicle a
      // customer has paid a deposit on back on the marketplace.
      await expect(page.getByRole("button", { name: "Archive" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0)
      await expect(page.getByRole("button", { name: "Mark reserved" })).toHaveCount(0)
      await expect(page.getByRole("button", { name: "Return to draft" })).toHaveCount(0)
    } finally {
      await archiveCurrent(page)
    }
  })

  test("refuses an illegal transition submitted directly to the action", async ({
    page,
  }) => {
    /**
     * The test the UI cannot give us. It rewrites the hidden `status` field
     * of the real form to a value the page never offers, then submits it —
     * which is exactly the shape of a crafted POST, minus the effort of
     * forging a Server Action id.
     *
     * If this ever passes a SOLD vehicle back to PUBLISHED, the enforcement
     * has regressed to being client-side only.
     */
    const model = uniqueModel()

    await page.goto(adminPath("/vehicles/new"))
    await fillVehicleForm(page, model)
    await page.getByRole("button", { name: "Create vehicle" }).click()
    await expect(page).toHaveURL(/\?created=1$/)

    try {
      await page.getByRole("button", { name: "Publish" }).click()
      await expect(page.getByText("Live on the website")).toBeVisible()

      await page.getByRole("button", { name: "Mark sold" }).click()
      await expect(page.getByText("Status changed to sold.")).toBeVisible()

      // Only "Archive" is on the page now. Point its form at PUBLISHED.
      await page
        .locator('form:has(input[value="ARCHIVED"]) input[name="status"]')
        .evaluate((input) => {
          ;(input as HTMLInputElement).value = "PUBLISHED"
        })

      await page.getByRole("button", { name: "Archive" }).click()

      // Refused, and the refusal names both states.
      await expect(page.getByText(/cannot be moved straight to published/i)).toBeVisible()

      // And the vehicle is still sold — nothing was written.
      await page.reload()
      await expect(page.getByText("Sold and no longer available")).toBeVisible()
    } finally {
      await archiveCurrent(page)
    }
  })
})
