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

/**
 * Expands the filter panel if this viewport collapsed it.
 *
 * On a phone the dropdowns sit inside a `<details>` that closes itself once
 * the page is live — see FilterPanel. Without this, every test below would
 * find the selects present but not visible on the mobile projects and skip
 * itself, and a skipped test reports as a kind of success. The summary is
 * hidden from `sm` up, so on desktop this is a no-op.
 */
async function openFilters(page: Page) {
  const summary = page.locator("details > summary")
  const make = ui(page).getByLabel("Make")

  // No bar at all — an empty inventory. The caller's own skip covers it.
  if ((await make.count()) === 0) return

  /**
   * Retried rather than decided from one snapshot.
   *
   * Two things settle after the navigation resolves, and reading either one
   * immediately after `goto` gives an answer that is true for only a few
   * milliseconds:
   *
   *   - the stylesheet that hides the summary above `sm`, which made this
   *     helper return early and skip every mobile test it was written to
   *     enable;
   *   - the hydration that closes the panel below it, which re-closed the
   *     panel a moment *after* an early click had opened it, so the select
   *     was gone again by the time the test reached for it.
   *
   * Waiting for the network to settle covers the common case; the retry
   * plus the re-check below is what makes it deterministic rather than
   * merely likely, because a click that hydration undoes fails the second
   * assertion and is simply made again.
   */
  await page.waitForLoadState("networkidle")

  await expect(async () => {
    if (!(await make.isVisible())) {
      if (await summary.isVisible()) await summary.click()
    }

    // Short timeouts, deliberately: these sit *inside* the retry, and at
    // Playwright's 15s default a single failed check would swallow the whole
    // budget and the loop would never get a second attempt.
    await expect(make).toBeVisible({ timeout: 1_000 })

    // Still open a moment later — i.e. the click was not undone by the
    // hydration that closes this panel once on a phone.
    await page.waitForTimeout(250)
    await expect(make).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
}

/**
 * Skips the test when the connected inventory is too small to filter.
 *
 * Deliberately does *not* expand the filter panel. Presence and option text
 * are readable whether or not the panel is open, so making every caller pay
 * for the expansion — including the ones that never touch a dropdown — only
 * adds a way for an unrelated test to fail. Callers that select an option
 * call `openFilters` themselves.
 */
/**
 * The page's main region — and every catalogue locator in this file is scoped
 * to it.
 *
 * ── Why, and it is not tidiness ───────────────────────────────────────
 * The catalogue streams: `loading.tsx` opens a Suspense boundary, so React
 * delivers the results into a hidden `<div id="S:n">` parked at the end of
 * `<body>` and then moves the nodes into the boundary inside `<main>`. For the
 * few milliseconds between those two steps the document genuinely contains two
 * copies of the grid — one visible, one `display:none` and outside `main`.
 *
 * Playwright's auto-retry does not save an unscoped locator here, because a
 * strict-mode violation *throws* rather than retrying: land one poll inside
 * that window and the assertion fails outright with "resolved to 2 elements",
 * on a page that is completely correct a frame later. It reproduced on roughly
 * one run in three, which is worse than a consistent failure.
 *
 * Scoping to `main` is not a workaround for that race so much as the more
 * honest assertion: what is being tested is what the customer can see, and the
 * streaming buffer is neither visible nor in the main region.
 */
function ui(page: Page) {
  return page.getByRole("main")
}

/**
 * Navigates to a catalogue URL and waits for the results to have streamed in.
 *
 * ── Why a helper rather than a bare `page.goto` ───────────────────────
 * `page.goto` resolves on `load`, which on this page is *before* the Suspense
 * boundary that `loading.tsx` opens has resolved. Anything read immediately
 * afterwards with a non-retrying call — `count()`, `allTextContents()`,
 * `isVisible()` — is answering for a half-built page.
 *
 * That is not a hypothetical: it was silently skipping between two and nine of
 * the fifteen tests in this file on any given run, each with a message
 * claiming the inventory lacked the data. A test that skips itself for the
 * wrong reason is worse than one that fails, because the suite still reports
 * green.
 *
 * Waiting for the filter panel or the empty state — the two things the
 * catalogue can end up showing — is what makes every later read meaningful.
 */
async function gotoCatalogue(page: Page, url = "/cars") {
  await page.goto(url)

  await expect(
    ui(page)
      .getByLabel("Make")
      .or(ui(page).locator('[data-slot="empty-state"]'))
      .first()
  ).toBeVisible()
}

async function requireFacets(page: Page, minimumMakes = 1) {
  await gotoCatalogue(page)

  const makeSelect = ui(page).getByLabel("Make")
  const hasFilters = (await makeSelect.count()) > 0

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
    await openFilters(page)

    await ui(page).getByLabel("Make").selectOption(make)

    // The state lives in the address, which is what makes a filtered
    // catalogue shareable over WhatsApp and survivable across a refresh.
    await expect(page).toHaveURL(new RegExp(`make=${encodeURIComponent(make)}`))

    // And the control still reflects it after the server render.
    await expect(ui(page).getByLabel("Make")).toHaveValue(make)
    await expect(page.getByText(/matching vehicles?$/)).toBeVisible()
  })

  test("narrows the model list to the chosen make", async ({ page }) => {
    const [make] = await requireFacets(page)

    const allModels = await ui(page).getByLabel("Model").locator("option").count()

    await page.goto(`/cars?make=${encodeURIComponent(make)}`)

    const narrowedModels = await ui(page).getByLabel("Model").locator("option").count()

    // Never wider. Choosing a make cannot add models to the list, or the
    // customer can assemble a make/model pair that matches nothing.
    expect(narrowedModels).toBeLessThanOrEqual(allModels)
  })

  test("clearing the make clears the model beneath it", async ({ page }) => {
    const [make] = await requireFacets(page)

    await gotoCatalogue(page, `/cars?make=${encodeURIComponent(make)}`)
    await openFilters(page)

    const models = await ui(page).getByLabel("Model").locator("option").allTextContents()
    test.skip(models.length < 2, "Needs a model to select.")

    await ui(page).getByLabel("Model").selectOption(models[1])
    await expect(page).toHaveURL(/model=/)

    // Switching the make must drop the model with it. Otherwise the next
    // search is for a model that make has never built.
    await ui(page).getByLabel("Make").selectOption("")
    await expect(page).not.toHaveURL(/model=/)
  })

  test("a shared filtered link reproduces the same view", async ({ page }) => {
    const [make] = await requireFacets(page)
    await openFilters(page)

    await ui(page).getByLabel("Make").selectOption(make)
    await expect(page).toHaveURL(/make=/)

    const shared = page.url()
    const summary = await page.getByText(/matching vehicles?$/).textContent()

    // A cold load of the same address — the WhatsApp-forwarded-link case.
    await page.goto(shared)

    await expect(ui(page).getByLabel("Make")).toHaveValue(make)
    await expect(page.getByText(/matching vehicles?$/)).toHaveText(summary!)
  })

  test("clearing the filters returns the whole catalogue", async ({ page }) => {
    const [make] = await requireFacets(page)
    await openFilters(page)

    await ui(page).getByLabel("Make").selectOption(make)
    await expect(page.getByRole("button", { name: /clear filters/i })).toBeVisible()

    await page.getByRole("button", { name: /clear filters/i }).click()

    await expect(page).toHaveURL(/\/cars$/)
    await expect(ui(page).getByLabel("Make")).toHaveValue("")
  })

  test("an impossible combination says so and offers a way out", async ({ page }) => {
    const makes = await requireFacets(page, 2)

    // A model belonging to the first make, asked for under the second.
    await gotoCatalogue(page, `/cars?make=${encodeURIComponent(makes[0])}`)
    const models = await ui(page).getByLabel("Model").locator("option").allTextContents()
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
    const emptyState = ui(page).locator('[data-slot="empty-state"]')
    await expect(
      emptyState.getByRole("button", { name: /clear filters/i })
    ).toHaveAttribute("href", "/cars")

    // Stated once, not twice: the count line above the grid reports the
    // number, the empty state explains it.
    await expect(page.getByText(/^0 matching vehicles$/)).toBeVisible()
  })

  test("finds a vehicle by typing part of its name", async ({ page }) => {
    const [make] = await requireFacets(page)

    // A fragment, in the wrong case — which is how someone types on a phone
    // from memory. Both must reach the same cars the dropdown does.
    const fragment = make.slice(0, 4).toLowerCase()

    await ui(page).getByLabel("Search", { exact: true }).fill(fragment)
    await page.getByRole("button", { name: "Search vehicles" }).click()

    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(fragment)}`))
    await expect(page.getByText(/matching vehicles?$/)).toBeVisible()
    await expect(page.getByText(/^0 matching vehicles$/)).toHaveCount(0)

    // The field comes back holding what was searched for, so the customer
    // can edit it rather than retype it.
    await expect(ui(page).getByLabel("Search", { exact: true })).toHaveValue(fragment)
  })

  test("combines the search box with the dropdowns rather than replacing them", async ({
    page,
  }) => {
    const [make] = await requireFacets(page)

    await page.goto(`/cars?make=${encodeURIComponent(make)}`)
    await ui(page).getByLabel("Search", { exact: true }).fill(make.toLowerCase())
    // Clicked rather than submitted with Enter: mobile WebKit does not
    // perform implicit form submission reliably under emulation, and the
    // button is the same code path — both go through the form's onSubmit.
    await page.getByRole("button", { name: "Search vehicles" }).click()

    // Both must survive. A search box that silently drops the dropdown
    // selection widens the result set at the moment the customer thought
    // they were narrowing it.
    await expect(page).toHaveURL(/q=/)
    await expect(page).toHaveURL(new RegExp(`make=${encodeURIComponent(make)}`))
    await expect(ui(page).getByLabel("Make")).toHaveValue(make)
  })

  test("a fruitless search says so rather than claiming the floor is empty", async ({
    page,
  }) => {
    await requireFacets(page)

    await page.goto("/cars?q=zzzznotavehicle")

    await expect(
      page
        .locator('[data-slot="empty-state"]')
        .getByText(/no vehicles match those filters/i)
    ).toBeVisible()
  })

  test("clearing the search box returns the whole catalogue", async ({ page }) => {
    await requireFacets(page)

    const [make] = await requireFacets(page)
    await page.goto(`/cars?q=${encodeURIComponent(make)}`)

    await page.getByRole("button", { name: /clear search/i }).click()

    await expect(page).toHaveURL(/\/cars$/)
    await expect(ui(page).getByLabel("Search", { exact: true })).toHaveValue("")
  })

  test("keeps a search symbol within reach once the bar has scrolled away", async ({
    page,
  }) => {
    const [make] = await requireFacets(page)

    const opener = page.getByRole("button", { name: /open search/i })

    // Nothing at the top of the page: the bar itself is right there.
    await expect(opener).toHaveCount(0)

    // `mouse.wheel` is unsupported in mobile WebKit, and this has to run on
    // a phone above all — that is the viewport the control exists for.
    await page.evaluate(() => window.scrollTo(0, 2000))

    // Only appears if the page is actually long enough to have scrolled the
    // bar out of view, which depends on how much inventory is published.
    if (!(await opener.isVisible().catch(() => false))) {
      test.skip(true, "Catalogue is too short to scroll the search bar away.")
      return
    }

    await opener.click()

    // `input type="search"` maps to the searchbox role, not textbox.
    const docked = page.getByRole("searchbox", { name: /search the catalogue/i })
    await expect(docked).toBeFocused()

    await docked.fill(make.toLowerCase())
    await page
      .locator("form")
      .filter({ has: docked })
      // Exact: the same form also holds a "Close search" button.
      .getByRole("button", { name: "Search", exact: true })
      .click()

    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(make.toLowerCase())}`))
    await expect(ui(page).getByLabel("Search", { exact: true })).toHaveValue(make.toLowerCase())
  })

  test("sends a page past the end of the results to the last real one", async ({
    page,
  }) => {
    await requireFacets(page)

    // Reachable from a stale bookmark or a crawler. Rendering it produced an
    // empty grid under a "nothing matched your filters" state, which blames
    // the customer for a search that in fact had pages of results.
    await page.goto("/cars?page=999")

    await expect(page).toHaveURL(/\/cars$|page=\d+$/)
    await expect(
      ui(page).locator('[data-slot="empty-state"]').getByText(/no vehicles match/i)
    ).toHaveCount(0)
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
      `/cars?q=${"x".repeat(500)}`,
      "/cars?q=%25",
      "/cars?q=%27%20OR%201%3D1--",
    ]

    for (const url of junk) {
      const response = await page.goto(url)
      expect(response?.status(), url).toBe(200)
      await expect(
        page.getByRole("heading", { level: 1, name: /quality vehicles/i })
      ).toBeVisible()
    }
  })

  test("keeps the filters when stepping through pages", async ({ page }) => {
    await gotoCatalogue(page)

    const next = page.getByRole("link", { name: "Next" })
    test.skip(!(await next.isVisible().catch(() => false)), "Needs a second page.")

    const [make] = await requireFacets(page)
    await openFilters(page)
    await ui(page).getByLabel("Make").selectOption(make)

    const nextOnFiltered = page.getByRole("link", { name: "Next" })

    if (await nextOnFiltered.isVisible().catch(() => false)) {
      await nextOnFiltered.click()
      // The classic paginated-search bug: page two quietly showing the
      // whole floor again.
      await expect(page).toHaveURL(new RegExp(`make=${encodeURIComponent(make)}`))
      await expect(ui(page).getByLabel("Make")).toHaveValue(make)
    }
  })
})
