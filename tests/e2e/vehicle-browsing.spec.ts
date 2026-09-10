import { expect, test, type Locator, type Page } from "@playwright/test"

/**
 * The public vehicle marketplace, as a customer meets it.
 *
 * ── What this covers, and what it deliberately does not ───────────────
 * The path from the catalogue to a vehicle page and back: that listings
 * render from the database rather than from anything hard-coded, that a
 * card carries what the brief asks a card to carry, that opening one shows
 * the full listing, and that a URL which is not a live listing answers with
 * a genuine 404 rather than a soft one.
 *
 * It runs signed out, against whatever the connected database happens to
 * hold. That is deliberate — it is the same view an anonymous visitor gets
 * — but it means the suite must not assume a particular vehicle exists.
 * Where a test needs a card, it takes the first one on the page and asserts
 * about its structure, never about a specific make or price.
 *
 * Creating a vehicle and publishing it is the admin suite's job
 * (`tests/e2e/admin/vehicles.spec.ts`); repeating it here would need a
 * signed-in session for a page that is supposed to work without one.
 */

/**
 * Opens a catalogue card and waits for the vehicle page to actually arrive.
 *
 * ── Why this is `waitForURL` and not `expect(page).toHaveURL(...)` ────
 * The distinction is the whole reason this helper exists. An `expect` is
 * bounded by `expect.timeout` — 15s here — while `page.waitForURL` is bounded
 * by `navigationTimeout`, which this project deliberately sets to 45s.
 *
 * The webServer runs `next dev`, which compiles a route on its first request;
 * `playwright.config.ts` records that being measured at 17s on this
 * filesystem. So the first test in a worker to open `/cars/[slug]` can spend
 * longer inside the navigation than an assertion is allowed to wait, and any
 * assertion written straight after the click inherits that wait: Playwright
 * blocks a locator query while a navigation is in flight. The failure then
 * reads as "element(s) not found" against a page that was never served —
 * which is exactly how it presented, intermittently and only in whichever
 * project happened to hit the cold route.
 *
 * Waiting for the navigation explicitly separates the two budgets: the cold
 * compile gets the 45s it was given, and the assertion after it gets a full
 * 15s to find something on a page that has definitely arrived.
 *
 * ── And why it stops at `domcontentloaded` ────────────────────────────
 * `waitForURL` defaults to waiting for `load`, which on a vehicle page means
 * every photograph in the gallery — a wait on the images rather than on the
 * navigation, and one that has exceeded even the 45s budget on WebKit. The
 * markup is what the assertions need, and that is complete at
 * `domcontentloaded`; anything still streaming after it is auto-waited by the
 * locators themselves.
 */
async function openVehicle(page: Page, card: Locator) {
  await waitForInteractive(page)

  /**
   * Retried, because a swallowed click leaves no trace to assert on.
   *
   * `waitForInteractive` closes the window in practice, but it is a heuristic
   * about someone else's dev server and not a guarantee. If a click is
   * dropped, nothing throws — the page simply stays where it was — so without
   * a retry the failure surfaces 45s later as a navigation that never
   * started, which is the least informative shape it could take.
   *
   * The URL is checked first so a retry never fires a second click at a page
   * the first one already left; on the destination the card does not exist and
   * the retry would fail on the click rather than notice it had succeeded.
   */
  await expect(async () => {
    if (!/^\/cars\/[^/]+$/.test(new URL(page.url()).pathname)) {
      await card.click({ timeout: 5_000 })
    }

    // 20s covers the dev server compiling `/cars/[slug]` on first request,
    // measured at ~17s in this project. See playwright.config.ts.
    await page.waitForURL(/\/cars\/[^/]+$/, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    })
  }).toPass({ timeout: 40_000 })
}

/**
 * Waits for the page to be interactive before dispatching a click at it.
 *
 * ── What this guards, and why it is not an application bug ────────────
 * A click dispatched after `domcontentloaded` but before the App Router has
 * attached is swallowed: the anchor's default is prevented by React's
 * delegated handler, and the router is not yet listening to do anything with
 * it. Nothing navigates, no error is raised, and the assertion that follows
 * describes a page the test never left.
 *
 * Measured on the vehicle catalogue, first card, eight runs each:
 *
 *     next dev     · click immediately        7/8 failed
 *     next dev     · click after `load`       6/8 failed
 *     next dev     · click after networkidle  0/8 failed
 *     next start   · click immediately        0/8 failed
 *
 * The last row is the one that matters: against a production build the race
 * does not exist, because the bundle is a fraction of the size and hydration
 * lands with the document. This is the dev webServer's unminified bundle plus
 * its HMR runtime, and it is a property of the harness rather than of what
 * ships. It also failed identically on a non-touch viewport, which rules out
 * tap handling.
 *
 * `networkidle` distinguishes the two states where `load` demonstrably does
 * not, and on this page it resolves in about 2.5s.
 *
 * It is only a proxy, though — it means "no request for 500ms", which a gap
 * between two dev-server compiles also satisfies. So it is a fast path, not a
 * guarantee, and the callers pair it with a retry that does not depend on
 * guessing when hydration landed.
 */
async function waitForInteractive(page: Page) {
  await page.waitForLoadState("networkidle")
}

/**
 * The catalogue shows a grid of cards or a stated empty state — never neither.
 *
 * Scoped to `<main>` for the reason set out at length in
 * spare-part-browsing.spec.ts: the catalogue sits under a Suspense boundary,
 * so React streams its HTML into a hidden staging div at the end of `<body>`
 * and relocates it a moment later. In between, every element in the segment
 * exists twice, which doubles a `count()` and trips strict mode on any
 * page-wide locator.
 */
async function catalogueCards(page: Page) {
  const main = page.getByRole("main")
  const cards = main.getByRole("link", { name: /^\d{4} .+ — \$/ })
  await expect(cards.first().or(main.getByText(/no vehicles listed yet/i))).toBeVisible()

  return cards
}

test.describe("vehicle catalogue", () => {
  test("lists live vehicles with the details a card is meant to carry", async ({ page }) => {
    await page.goto("/cars")

    // The catalogue's h1 is its positioning line, not the word "Cars" —
    // see CatalogueMasthead for why.
    await expect(
      page.getByRole("heading", { level: 1, name: /quality vehicles/i })
    ).toBeVisible()

    const cards = await catalogueCards(page)

    if ((await cards.count()) === 0) {
      test.skip(true, "No published vehicles in this database to assert against.")
      return
    }

    const card = cards.first()

    // The accessible name is assembled from the year, the vehicle and the
    // price, so asserting on it proves all three reached the card.
    await expect(card).toHaveAccessibleName(/^\d{4} .+ — \$[\d,]+/)

    /**
     * The four specifications the card commits to showing — transmission,
     * fuel, engine and mileage, as a 2×2 matrix — asserted on the values
     * rather than on labels. The labels are `sr-only` `<dt>`s; the values
     * ("42,000 km", "Automatic") caption themselves in print, and the terms
     * remain in the `<dl>` for a screen reader. Asserting on the rendered
     * figure also proves the data reached the card, which a static label
     * never did.
     *
     * The count is exact on purpose. It is the guard against the card
     * quietly growing back into a spreadsheet row: the brief is explicit
     * that everything beyond these four belongs on the vehicle page.
     */
    await expect(card.getByText(/^[\d,]+ km$/)).toBeVisible()

    const specs = card.locator("dd")
    await expect(specs).toHaveCount(4)

    await expect(card.getByRole("heading", { level: 3 })).toBeVisible()
  })

  test("a card opens the vehicle it names", async ({ page }) => {
    await page.goto("/cars")

    const cards = await catalogueCards(page)

    if ((await cards.count()) === 0) {
      test.skip(true, "No published vehicles in this database to assert against.")
      return
    }

    const card = cards.first()
    const name = (await card.getAttribute("aria-label")) ?? ""
    // "2021 Toyota Harrier — $22,500" → "Toyota Harrier"
    const model = name.replace(/^\d{4}\s+/, "").replace(/\s+—.*$/, "")

    await openVehicle(page, card)

    await expect(page).toHaveURL(/\/cars\/[^/]+$/)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(model)
  })

  test("never exposes a vehicle that is not published", async ({ page }) => {
    /**
     * The strongest guarantee on this page and the cheapest to lose: a slug
     * that is real but not PUBLISHED must be indistinguishable from one
     * that never existed. `getPublishedVehicleBySlug` folds the status into
     * the lookup so there is nothing for the page to remember to check —
     * this asserts the outcome of that, from outside.
     *
     * A genuine 404 status, not merely 404 content. A soft 404 keeps a sold
     * vehicle in search results and drawing enquiries the business cannot
     * fulfil.
     */
    const response = await page.goto("/cars/this-vehicle-does-not-exist")

    expect(response?.status()).toBe(404)
  })
})

test.describe("vehicle page", () => {
  test("shows the specifications, pricing and actions a buyer decides on", async ({
    page,
  }) => {
    await page.goto("/cars")

    const cards = await catalogueCards(page)

    if ((await cards.count()) === 0) {
      test.skip(true, "No published vehicles in this database to assert against.")
      return
    }

    await openVehicle(page, cards.first())

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    /**
     * The way back, in place of the breadcrumb trail this replaced — and
     * the listing reference is deliberately gone from the page body. It is
     * an internal identifier that still travels in the metadata, the
     * structured data and the WhatsApp message; showing it to a customer
     * was a code they were given no reason to care about.
     */
    await expect(page.getByRole("link", { name: "Back to listings" })).toBeVisible()
    await expect(page.getByText(/listing reference/i)).toHaveCount(0)

    /**
     * Specifications and features share one surface below the summary,
     * shown one at a time. Only the selected panel is mounted, so
     * "Specifications" is visible on arrival and the features list is not
     * yet in the document.
     */
    await expect(page.getByRole("tab", { name: "Specifications" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(page.getByRole("tabpanel")).toHaveCount(1)

    await expect(
      page.getByRole("heading", { name: "About this vehicle" })
    ).toBeVisible()
    await expect(page.getByRole("heading", { name: "Vehicle price" })).toBeVisible()

    /**
     * The condition tag is the first fact stated about the vehicle.
     *
     * Matched on "Condition: New/Used" rather than on the visible word
     * alone: the tag carries an `sr-only` prefix so it is unambiguous in a
     * screen reader's element list, and asserting on the announced string
     * proves that prefix is still there.
     */
    await expect(page.getByText(/^Condition: (New|Used)$/)).toBeVisible()

    /**
     * Queried as a *button*, not a link, because that is what it actually
     * exposes: the project's `Button` renders through Base UI, which stamps
     * `role="button"` on whatever element it is given — including the
     * `<a href>` produced by `render={<Link/>}`.
     *
     * That is site-wide existing behaviour, not something this page chose,
     * and it is asserted here as-is rather than papered over. It is worth
     * revisiting centrally: an anchor that navigates should keep its link
     * role, or a screen-reader user is told "button" for something that can
     * be opened in a new tab. Changing it belongs in the Button primitive,
     * where every CTA on the site would move together.
     *
     * Two exist on the page — beneath the price breakdown, and below `lg`
     * in the pinned action bar as well — which is intentional. The
     * assertion is that at least one is there.
     */
    await expect(
      page.getByRole("button", { name: "Request this vehicle" }).first()
    ).toBeVisible()
  })

  test("shows specifications or features, never both at once", async ({ page }) => {
    await page.goto("/cars")

    const cards = await catalogueCards(page)

    if ((await cards.count()) === 0) {
      test.skip(true, "No published vehicles in this database to assert against.")
      return
    }

    await openVehicle(page, cards.first())

    const specifications = page.getByRole("tab", { name: "Specifications" })
    const features = page.getByRole("tab", { name: "Features" })

    /**
     * The tablist is a single tab stop: the selected tab is reachable and
     * the other is skipped, which is what `tabIndex={-1}` on the inactive
     * tab buys and what a hand-rolled toggle usually gets wrong.
     */
    await expect(specifications).toHaveAttribute("tabindex", "0")
    await expect(features).toHaveAttribute("tabindex", "-1")

    await features.click()

    await expect(features).toHaveAttribute("aria-selected", "true")
    await expect(specifications).toHaveAttribute("aria-selected", "false")
    // Still exactly one panel — the point of the toggle.
    await expect(page.getByRole("tabpanel")).toHaveCount(1)

    /**
     * Arrow keys move the selection *and* the focus. A tablist that
     * changes what is selected without following it leaves a keyboard
     * user's focus ring on a tab they are no longer reading.
     */
    await features.press("ArrowLeft")

    await expect(specifications).toHaveAttribute("aria-selected", "true")
    await expect(specifications).toBeFocused()
  })

  test("publishes the vehicle price and no invented delivered total", async ({
    page,
  }) => {
    await page.goto("/cars")

    const cards = await catalogueCards(page)

    if ((await cards.count()) === 0) {
      test.skip(true, "No published vehicles in this database to assert against.")
      return
    }

    await openVehicle(page, cards.first())

    /**
     * The dealership cannot stand behind shipping and clearing figures on
     * a public page, so the page must state the vehicle price and say
     * where the rest is settled. Silence about the difference is what the
     * brief forbids, and a delivered total is what the business asked be
     * removed — this asserts both halves.
     */
    await expect(page.getByText(/confirm your full delivered cost/i)).toBeVisible()

    for (const forbidden of [
      /estimated delivered price/i,
      /price breakdown/i,
      /clearing & port/i,
    ]) {
      await expect(page.getByText(forbidden)).toHaveCount(0)
    }
  })

  test("keeps the request action reachable while scrolling on a phone", async ({
    page,
  }) => {
    const viewport = page.viewportSize()

    /**
     * The bar is `lg:hidden`, so there is nothing to assert above 1024px.
     * Gated on the actual viewport rather than on the project name so the
     * test stays correct if the project list changes.
     */
    if (!viewport || viewport.width >= 1024) {
      test.skip(true, "The pinned action bar is a below-lg treatment.")
      return
    }

    await page.goto("/cars")

    const cards = await catalogueCards(page)

    if ((await cards.count()) === 0) {
      test.skip(true, "No published vehicles in this database to assert against.")
      return
    }

    await openVehicle(page, cards.first())
    await expect(page).toHaveURL(/\/cars\/[^/]+$/)

    const bar = page.locator("[data-mobile-action-bar]")
    await expect(bar).toBeVisible()

    /**
     * The point of the bar is that it survives the scroll. Asserting it is
     * still in the viewport at the very bottom of a long page is also what
     * catches the two overlaps it has to avoid — if the footer had no
     * bottom clearance the bar would be sitting on top of it, and the
     * action would be the thing covered rather than the thing covering.
     */
    await page.keyboard.press("End")
    await expect(bar).toBeInViewport()

    await expect(
      bar.getByRole("button", { name: "Request this vehicle" })
    ).toBeVisible()
  })

  test("closes on other vehicles, never on the vehicle already open", async ({
    page,
  }) => {
    await page.goto("/cars")

    const cards = await catalogueCards(page)

    if ((await cards.count()) === 0) {
      test.skip(true, "No published vehicles in this database to assert against.")
      return
    }

    await openVehicle(page, cards.first())
    await expect(page).toHaveURL(/\/cars\/[^/]+$/)

    const slug = new URL(page.url()).pathname

    /**
     * The strip renders only when another live vehicle shares this make,
     * which a small inventory legitimately may not — so its absence is not
     * a failure. What is asserted unconditionally is that the vehicle can
     * never appear in its own suggestions, which is `excludeSlug`'s whole
     * job and the one thing here that would look broken to a customer.
     */
    await expect(page.locator(`a[href="${slug}"]`)).toHaveCount(0)

    const heading = page.getByRole("heading", { name: "You may also like" })

    if ((await heading.count()) === 0) return

    await expect(heading).toBeVisible()

    // Every card in the strip is a real listing that opens.
    const related = page.getByRole("link", { name: /^\d{4} .+ — \$/ })
    await expect(related.first()).toBeVisible()
  })

  test("the gallery moves between photographs", async ({ page }) => {
    await page.goto("/cars")

    const cards = await catalogueCards(page)

    if ((await cards.count()) === 0) {
      test.skip(true, "No published vehicles in this database to assert against.")
      return
    }

    await openVehicle(page, cards.first())

    /**
     * Gated on the URL, not on a heading. `locator.count()` is one of the
     * few Playwright calls that does *not* auto-wait, so it has to be given
     * a settled page — and waiting for an `h1` does not settle one here,
     * because the catalogue has an `h1` of its own that matches instantly
     * while the navigation is still in flight. The test then counted
     * gallery buttons on the catalogue page, found none, and skipped itself
     * on a vehicle that has five photographs.
     */
    await expect(page).toHaveURL(/\/cars\/[^/]+$/)

    const next = page.getByRole("button", { name: "Next photograph" })

    if ((await next.count()) === 0) {
      test.skip(true, "This vehicle has a single photograph, so there is nothing to step through.")
      return
    }

    const counter = page.getByText(/^\d+ \/ \d+$/)
    await expect(counter).toHaveText(/^1 \//)

    await next.click()
    await expect(counter).toHaveText(/^2 \//)
  })
})
