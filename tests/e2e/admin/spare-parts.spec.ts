import { expect, test, type Page } from "@playwright/test"

import { adminPath } from "../../../src/lib/constants/admin-routes"
import { adminUrlPattern } from "../setup/paths"

/**
 * The spare-parts catalogue, end to end.
 *
 * These write real rows. Nothing is deleted afterwards — a part is never
 * deleted in this system, by design — so each test archives what it created
 * instead. Archived rows are the correct resting state for a listing that
 * should not appear anywhere, and leaving them is honest: it is exactly what
 * happens when a real listing is withdrawn.
 *
 * Every created part is named so it is unmistakable in the admin list if a
 * cleanup ever fails.
 */

const TEST_PREFIX = "ZZ-Test"

/** A part name unique to this run, so parallel projects cannot collide. */
function uniqueName() {
  return `${TEST_PREFIX} pads ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

async function fillPartForm(page: Page, name: string, price = "120") {
  await page.getByLabel("Part name").fill(name)
  // Availability is a published promise and is chosen by the operator — it
  // is not derived from the stock figure below. Set explicitly here so the
  // flow exercises the field rather than riding on its default.
  await page.getByLabel("Availability").selectOption("IN_STOCK")
  await page.getByLabel("Stock quantity").fill("4")
  await page.getByLabel("Price (USD)").fill(price)
  await page
    .getByLabel("Description")
    .fill("Automated test listing. Safe to archive — created by the e2e suite.")
}

/**
 * Archives the part currently open, so the suite leaves nothing live.
 *
 * `exact` matters: the spare-parts *list* carries a status filter chip
 * labelled "Archived 5", and a substring match finds that instead — clicking
 * a filter, waiting for a confirmation that will never come, and reporting it
 * as a failure to archive.
 */
async function archiveCurrent(page: Page) {
  const archive = page.getByRole("button", { name: "Archive", exact: true })
  if (await archive.isVisible().catch(() => false)) {
    await archive.click()
    // Waits on the action's own confirmation rather than on the status
    // description re-rendering. The message is returned by the action, so it
    // appears exactly when the write has committed.
    await expect(page.getByText("Status changed to archived.")).toBeVisible()
  }
}

test.describe("spare parts catalogue", () => {
  test("creates a part as a draft with a generated reference", async ({ page }) => {
    const name = uniqueName()

    await page.goto(adminPath("/spare-parts/new"))
    await fillPartForm(page, name)
    await page.getByRole("button", { name: "Create part" }).click()

    await expect(page).toHaveURL(
      new RegExp(`${adminUrlPattern("/spare-parts").source}/[^/]+\\?created=1$`)
    )

    try {
      await expect(page.getByText("Part created as a draft")).toBeVisible()

      // The reference is generated server-side and follows the documented
      // format — two letters, so it can never be misread as a vehicle's.
      await expect(
        page.getByRole("main").getByText(/CLM-SP-\d{4}-\d{6}/).first()
      ).toBeVisible()

      // And the public web address is derived from it, not from anything the
      // client supplied.
      await expect(page.getByText(/\/spare-parts\/zz-test-pads-.*-clm-sp-/)).toBeVisible()

      // A new listing is never live.
      await expect(page.getByText("Not visible on the website")).toBeVisible()
    } finally {
      await archiveCurrent(page)
    }
  })

  test("creates a part with every optional field left empty", async ({ page }) => {
    /**
     * A name, a category and a description are all an operator needs. Price,
     * stock, brand, manufacturer number, country and sourcing are things they
     * may not have to hand when the part is entered, and none of them may
     * block the listing being saved.
     */
    const name = uniqueName()

    await page.goto(adminPath("/spare-parts/new"))
    await page.getByLabel("Part name").fill(name)
    await page
      .getByLabel("Description")
      .fill("Automated test listing. Safe to archive — created by the e2e suite.")
    await page.getByRole("button", { name: "Create part" }).click()

    await expect(page).toHaveURL(/\?created=1$/)

    try {
      await expect(page.getByText("Part created as a draft")).toBeVisible()

      // With no price, the listing is quoted on enquiry — which is what an
      // empty price box means, rather than an error about a mode the operator
      // was never asked to choose.
      await expect(page.getByLabel("Price (USD)")).toHaveValue("")
      await expect(page.getByLabel("Stock quantity")).toHaveValue("0")
    } finally {
      await archiveCurrent(page)
    }
  })

  test("keeps what was typed when a submission is rejected", async ({ page }) => {
    const name = uniqueName()

    await page.goto(adminPath("/spare-parts/new"))
    await fillPartForm(page, name)

    // Too short to be a description of anything, which is the one content
    // rule this form enforces.
    await page.getByLabel("Description").fill("no")
    await page.getByRole("button", { name: "Create part" }).click()

    await expect(page.getByText(/Check the highlighted fields/)).toBeVisible()

    // Still on the form, and nothing was created.
    await expect(page).toHaveURL(adminUrlPattern("/spare-parts/new", { exact: true }))

    /**
     * And every other field still holds what was typed. React resets a form
     * with a function action once the action settles, on failure as well as
     * on success; the action echoes the submitted values back as the form's
     * defaults so the reset restores them.
     */
    await expect(page.getByLabel("Part name")).toHaveValue(name)
    await expect(page.getByLabel("Stock quantity")).toHaveValue("4")
    await expect(page.getByLabel("Price (USD)")).toHaveValue("120")
  })

  test("separates what customers see from what only the admin sees", async ({
    page,
  }) => {
    // The grouping is the answer to the question an operator has while
    // typing — "will a customer read this?" — so it is asserted rather than
    // left to survive the next redesign by luck.
    await page.goto(adminPath("/spare-parts/new"))

    // `exact`, because "Shown on the website" is also a substring of the
    // internal chip's label and getByText matches substrings.
    await expect(
      page.getByText("Shown on the website", { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText("Admin only — never shown on the website", { exact: true })
    ).toBeVisible()
  })

  test("publishes a part, then unpublishes it back to draft", async ({ page }) => {
    const name = uniqueName()

    await page.goto(adminPath("/spare-parts/new"))
    await fillPartForm(page, name)
    await page.getByRole("button", { name: "Create part" }).click()
    await expect(page).toHaveURL(/\?created=1$/)

    try {
      // The warning that matters at publish time: a part nobody can find by
      // their own car is a part nobody finds.
      await expect(
        page.getByText("No compatible vehicles are listed for this part")
      ).toBeVisible()

      await page.getByRole("button", { name: "Publish" }).click()
      await expect(page.getByText("Live in the catalogue")).toBeVisible()

      /**
       * Unpublishing is the transition the vehicle table deliberately
       * refuses and this one deliberately allows: stock cycles, and a part
       * line comes down and goes back up rather than being retired.
       */
      await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible()
      await page.getByRole("button", { name: "Unpublish" }).click()

      await expect(page.getByText("Not visible on the website")).toBeVisible()
      await expect(page.getByRole("button", { name: "Publish" })).toBeVisible()
    } finally {
      await archiveCurrent(page)
    }
  })

  test("never returns an archived part straight to the catalogue", async ({ page }) => {
    const name = uniqueName()

    await page.goto(adminPath("/spare-parts/new"))
    await fillPartForm(page, name)
    await page.getByRole("button", { name: "Create part" }).click()
    await expect(page).toHaveURL(/\?created=1$/)

    await page.getByRole("button", { name: "Archive" }).click()
    await expect(page.getByText("Status changed to archived.")).toBeVisible()

    // An archived line has usually been away long enough that its price,
    // stock and fitment want checking — so the only way back is through
    // draft, where they can be.
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Restore to draft" })).toBeVisible()
  })

  test("saves an edit without changing the public web address", async ({ page }) => {
    const name = uniqueName()

    await page.goto(adminPath("/spare-parts/new"))
    await fillPartForm(page, name)
    await page.getByRole("button", { name: "Create part" }).click()
    await expect(page).toHaveURL(/\?created=1$/)

    try {
      const slugBefore = await page.locator("code").first().innerText()

      await page.getByLabel("Price (USD)").fill("99.5")
      await page.getByLabel("Stock quantity").fill("0")
      await page.getByRole("button", { name: "Save changes" }).click()

      // The confirmation is the signal that the write committed. Reloading
      // straight after the click races the action and reads the old value.
      await expect(page.getByText("Changes saved.")).toBeVisible()

      await page.reload()
      await expect(page.getByLabel("Price (USD)")).toHaveValue("99.5")
      await expect(page.getByLabel("Stock quantity")).toHaveValue("0")

      // The slug is a public URL that gets shared and indexed. Correcting a
      // price must never change it.
      expect(await page.locator("code").first().innerText()).toBe(slugBefore)
    } finally {
      await archiveCurrent(page)
    }
  })

  test("finds a part by name from the list search", async ({ page }) => {
    const name = uniqueName()

    await page.goto(adminPath("/spare-parts/new"))
    await fillPartForm(page, name)
    await page.getByRole("button", { name: "Create part" }).click()
    await expect(page).toHaveURL(/\?created=1$/)

    // Captured while the part's own page is open, so the cleanup below has a
    // destination that does not depend on the list rendering a row.
    const partUrl = page.url().replace("?created=1", "")

    try {
      await page.goto(adminPath("/spare-parts"))
      await page.getByRole("searchbox", { name: "Search spare parts" }).fill(name)

      // The search is debounced, so this waits for the row rather than
      // asserting immediately.
      await expect(page.getByRole("link", { name })).toBeVisible()
    } finally {
      /**
       * Navigated to directly rather than by clicking the row.
       *
       * The list re-renders as the search debounces, so a click can land on a
       * row that is being replaced and resolve against a navigation the next
       * render cancels — leaving the cleanup running on the list page. The
       * row being clickable is not what this test is about; that it appears
       * in the results is, and that has already been asserted.
       */
      await page.goto(partUrl)
      await archiveCurrent(page)
    }
  })
})
