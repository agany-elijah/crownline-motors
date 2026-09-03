import { expect, test, type Page } from "@playwright/test"

/**
 * The catalogue's search and filtering (Stage 12), as a customer meets it.
 *
 * ── Written against whatever the database holds ───────────────────────
 * Like the browsing suite, this runs signed out against the connected
 * inventory, so it must not assume a particular make exists. Where a test
 * needs a value it reads one out of the Make dropdown — whose options are
 * themselves drawn from the published inventory — and asserts about
 * behaviour rather than about "Toyota". A suite that hard-codes a make goes
 * red the day that car sells.
 *
 * ── What is worth proving here rather than in a unit test ─────────────
 * The parsing, the where clause and the URL building are covered
 * exhaustively by tests/unit/vehicle-filters.test.ts. What only a browser
 * can show is that the whole loop closes: a selection becomes a URL, the URL
 * becomes a filtered server render, and the controls come back reflecting
 * what was asked for. Plus the two failure modes that are invisible in unit
 * tests — a junk query string taking the page down, and a filter that
 * survives being shared as a link.
 */

/** Skips the test when the connected inventory is too small to filter. */
async function requireFacets(page: Page, minimumMakes = 1) {
  await page.goto("/cars")

  const makeSelect = page.getByLabel("Make")
  const hasFilters = await makeSelect.isVisible().catch(() => false)

  test.skip(!hasFilters, "No published inventory to filter.")

  // The first option is always "Any make".
  const makes = await makeSelect.locator("option").allTextContents()
  test.skip(
    makes.length - 1 < minimumMakes,
    `Needs at least ${minimumMakes} published make(s).`
  )

  return makes.slice(1)
}

test.describe("catalogue search", () => {
  test("offers only makes that are actually in the published inventory", async ({
    page,
  }) => {
    const makes = await requireFacets(page)

    // Every option must lead somewhere. A dropdown offering a make with no
    // live listing produces an honest "no results" that reads as a broken
    // site, which is the reason the options come from the inventory rather
    // than from a fixed list.
    for (const make of makes) {
      await page.goto(`/cars?make=${encodeURIComponent(make)}`)
      await expect(page.getByText(/^0 matching vehicles$/)).toHaveCount(0)
    }
  })

  test("filtering by make puts the choice in the URL and narrows the results", async ({
    page,
  }) => {
    const [make] = await requireFacets(page)

    await page.getByLabel("Make").selectOption(make)

    // The state lives in the address, which is what makes a filtered
    // catalogue shareable over WhatsApp and survivable across a refresh.
    await expect(page).toHaveURL(new RegExp(`make=${encodeURIComponent(make)}`))

    // And the control still reflects it after the server render.
    await expect(page.getByLabel("Make")).toHaveValue(make)
    await expect(page.getByText(/matching vehicles?$/)).toBeVisible()
  })

  test("narrows the model list to the chosen make", async ({ page }) => {
    const [make] = await requireFacets(page)

    const allModels = await page.getByLabel("Model").locator("option").count()

    await page.goto(`/cars?make=${encodeURIComponent(make)}`)

    const narrowedModels = await page.getByLabel("Model").locator("option").count()

    // Never wider. Choosing a make cannot add models to the list, or the
    // customer can assemble a make/model pair that matches nothing.
    expect(narrowedModels).toBeLessThanOrEqual(allModels)
  })

  test("clearing the make clears the model beneath it", async ({ page }) => {
    const [make] = await requireFacets(page)

    await page.goto(`/cars?make=${encodeURIComponent(make)}`)

    const models = await page.getByLabel("Model").locator("option").allTextContents()
    test.skip(models.length < 2, "Needs a model to select.")

    await page.getByLabel("Model").selectOption(models[1])
    await expect(page).toHaveURL(/model=/)

    // Switching the make must drop the model with it. Otherwise the next
    // search is for a model that make has never built.
    await page.getByLabel("Make").selectOption("")
    await expect(page).not.toHaveURL(/model=/)
  })

  test("a shared filtered link reproduces the same view", async ({ page }) => {
    const [make] = await requireFacets(page)

    await page.getByLabel("Make").selectOption(make)
    await expect(page).toHaveURL(/make=/)

    const shared = page.url()
    const summary = await page.getByText(/matching vehicles?$/).textContent()

    // A cold load of the same address — the WhatsApp-forwarded-link case.
    await page.goto(shared)

    await expect(page.getByLabel("Make")).toHaveValue(make)
    await expect(page.getByText(/matching vehicles?$/)).toHaveText(summary!)
  })

  test("clearing the filters returns the whole catalogue", async ({ page }) => {
    const [make] = await requireFacets(page)

    await page.getByLabel("Make").selectOption(make)
    await expect(page.getByRole("button", { name: /clear filters/i })).toBeVisible()

    await page.getByRole("button", { name: /clear filters/i }).click()

    await expect(page).toHaveURL(/\/cars$/)
    await expect(page.getByLabel("Make")).toHaveValue("")
  })

  test("an impossible combination says so and offers a way out", async ({ page }) => {
    const makes = await requireFacets(page, 2)

    // A model belonging to the first make, asked for under the second.
    await page.goto(`/cars?make=${encodeURIComponent(makes[0])}`)
    const models = await page.getByLabel("Model").locator("option").allTextContents()
    test.skip(models.length < 2, "Needs a model to mismatch.")

    await page.goto(
      `/cars?make=${encodeURIComponent(makes[1])}&model=${encodeURIComponent(models[1])}`
    )

    // The empty state must be the *search* one, not the "no inventory yet"
    // one — the floor is full of cars this customer filtered out, and
    // telling them stock is on its way would be both wrong and useless.
    // Scoped to the empty state rather than matched by role: EmptyState
    // styles its title as a heading but renders a <p>, deliberately, so it
    // does not inject an unrelated entry into the document outline.
    await expect(
      page
        .locator('[data-slot="empty-state"]')
        .getByText(/no vehicles match those filters/i)
    ).toBeVisible()
    // Matched by role="button": the shared Button component stamps that role
    // onto whatever it renders, so this is an <a href="/cars"> that assistive
    // technology is told is a button. Scoped to the empty state because the
    // filter bar has a "Clear filters" control of its own.
    const emptyState = page.locator('[data-slot="empty-state"]')
    await expect(
      emptyState.getByRole("button", { name: /clear filters/i })
    ).toHaveAttribute("href", "/cars")

    // Stated once, not twice: the count line above the grid reports the
    // number, the empty state explains it.
    await expect(page.getByText(/^0 matching vehicles$/)).toBeVisible()
  })

  test("survives a hand-edited query string", async ({ page }) => {
    // A URL is user-editable, bookmarked, and rewritten by link previewers.
    // Rubbish in it is an ordinary event and must degrade to "unfiltered",
    // never to an error page.
    const junk = [
      "/cars?year=banana",
      "/cars?year=99999",
      "/cars?page=-4",
      "/cars?page=banana",
      `/cars?make=${"x".repeat(500)}`,
      "/cars?make=%27%20OR%201%3D1--",
    ]

    for (const url of junk) {
      const response = await page.goto(url)
      expect(response?.status(), url).toBe(200)
      await expect(page.getByRole("heading", { level: 1, name: "Cars" })).toBeVisible()
    }
  })

  test("keeps the filters when stepping through pages", async ({ page }) => {
    await page.goto("/cars")

    const next = page.getByRole("link", { name: "Next" })
    test.skip(!(await next.isVisible().catch(() => false)), "Needs a second page.")

    const [make] = await requireFacets(page)
    await page.getByLabel("Make").selectOption(make)

    const nextOnFiltered = page.getByRole("link", { name: "Next" })

    if (await nextOnFiltered.isVisible().catch(() => false)) {
      await nextOnFiltered.click()
      // The classic paginated-search bug: page two quietly showing the
      // whole floor again.
      await expect(page).toHaveURL(new RegExp(`make=${encodeURIComponent(make)}`))
      await expect(page.getByLabel("Make")).toHaveValue(make)
    }
  })
})
