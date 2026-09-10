import { expect, test, type Locator, type Page } from "@playwright/test"

/**
 * The public spare-parts catalogue, as a customer meets it.
 *
 * ── What this covers, and what it deliberately does not ───────────────
 * The path a parts customer actually takes: browse by category, search by
 * number, preview a part without losing your place in the grid, add it to the
 * list, and open the full page. Plus the two things that must never happen —
 * an internal figure appearing on a public page, and an unpublished slug
 * answering with a soft 404.
 *
 * It runs signed out, against whatever the connected database happens to
 * hold. That is deliberate — it is the view an anonymous visitor gets — but
 * it means the suite must not assume a particular part exists. Where a test
 * needs a card it takes the first one on the page and asserts about its
 * structure, never about a specific part or price.
 *
 * Creating a part and publishing it is the admin suite's job
 * (`tests/e2e/admin/spare-parts.spec.ts`); repeating it here would need a
 * signed-in session for a page that is supposed to work without one.
 */

/**
 * The catalogue shows a grid of cards or a stated empty state — never neither.
 *
 * ── Everything here is scoped to `<main>`, and it has to be ───────────
 * The catalogue sits under a Suspense boundary (its `loading.tsx`), so React
 * streams it: the boundary's HTML is delivered inside a `<div id="S:0" hidden>`
 * parked at the end of `<body>` and then relocated into the document by an
 * inline script. For the few hundred milliseconds between those two events
 * **every element in this segment exists twice** — once live, once in the
 * staging div.
 *
 * A page-wide locator matches both, so `count()` doubles and any `expect` on a
 * non-`.first()` locator fails strict mode. It is a race, so it presented as
 * an assertion that passed everywhere and then failed once, in one project,
 * with "resolved to 2 elements".
 *
 * Scoping to the `main` landmark removes it at the source rather than papering
 * over it with `.first()`: the staging div contains no `<main>`, and "what the
 * customer can see on the page" is what these assertions mean anyway.
 */
function catalogue(page: Page) {
  return page.getByRole("main")
}

/**
 * Waits for the page to be interactive before dispatching a click at it.
 *
 * A click landing between `domcontentloaded` and the App Router attaching is
 * swallowed — the anchor's default is prevented and nothing is yet listening
 * to route. It is a dev-server property, not an application one: measured on
 * the catalogue, clicking immediately failed 7 of 8 runs under `next dev` and
 * 0 of 8 against a production build, where hydration lands with the document.
 * See the longer note on `waitForInteractive` in vehicle-browsing.spec.ts.
 */
async function waitForInteractive(page: Page) {
  await page.waitForLoadState("networkidle")
}

/** Opens a part from the catalogue and waits for its page to arrive. */
async function openPart(page: Page, card: Locator) {
  await waitForInteractive(page)

  // Retried for the reason given on `openVehicle` in vehicle-browsing.spec.ts:
  // a swallowed click throws nothing, so without this the failure arrives much
  // later as a navigation that never started. The URL guard stops a retry
  // firing a second click at a page the first one already left.
  await expect(async () => {
    if (!/^\/spare-parts\/[a-z0-9-]+$/.test(new URL(page.url()).pathname)) {
      await card.click({ timeout: 5_000 })
    }

    await page.waitForURL(/\/spare-parts\/[a-z0-9-]+$/, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    })
  }).toPass({ timeout: 40_000 })
}

async function catalogueCards(page: Page) {
  const cards = catalogue(page).locator("article a[href^='/spare-parts/']")

  await expect(
    cards.first().or(catalogue(page).getByText(/no parts listed yet/i))
  ).toBeVisible()

  return cards
}

/** Skips a test when the connected database has no published parts. */
async function requireParts(page: Page) {
  const cards = await catalogueCards(page)

  if ((await cards.count()) === 0) {
    test.skip(true, "No published spare parts in this database to assert against.")
  }

  return cards
}

test.describe("spare-parts catalogue", () => {
  test("lists live parts with the details a card is meant to carry", async ({
    page,
  }) => {
    await page.goto("/spare-parts")

    await expect(
      page.getByRole("heading", { level: 1, name: /^spare parts$/i })
    ).toBeVisible()

    const cards = await requireParts(page)
    const card = cards.first()

    // A card carries the part's name as its link text and nothing that would
    // need a second line to explain.
    await expect(card).not.toBeEmpty()

    // Every card offers the control that makes the grid shoppable without
    // leaving it. It is revealed on hover on a pointer device, so this
    // asserts it is *attached* rather than visible — a headless run has no
    // hover, and a control that only exists on hover would be exactly the
    // phone-hostile bug worth catching.
    await expect(
      page.getByRole("button", { name: /^Preview and add / }).first()
    ).toBeAttached()

    /**
     * And the availability tag, which every published listing carries.
     *
     * Scoped to the `<article>` rather than to `card` — `card` is the
     * stretched *link*, whose only text is the part's name, and the tag is a
     * sibling of it inside the card.
     */
    await expect(
      catalogue(page)
        .locator("article")
        .first()
        .getByText(
          /in stock|available to order|ready to ship|low stock|out of stock|discontinued/i
        )
    ).toBeVisible()
  })

  test("never shows an internal figure on a public page", async ({ page }) => {
    /**
     * The dealership's instruction, enforced where a customer would see it
     * break. The query layer is what actually guarantees this — the public
     * DTOs do not carry these columns at all — but a component could still
     * invent a label, and this is the assertion that would catch it.
     */
    await page.goto("/spare-parts")
    await requireParts(page)

    const body = page.getByRole("main")

    /**
     * The stock *count*, not the word "stock".
     *
     * This assertion used to ban `/in stock/i` outright, on the reading that
     * anything about stock was internal. The dealership has since asked for
     * an availability tag on every listing, and "In stock" is one of its six
     * values — a promise the business has deliberately chosen to publish.
     *
     * What must still never reach a customer is the number behind it:
     * `stockQuantity` is a count the dashboard keeps, the public DTO does not
     * carry it, and a listing saying "4 in stock" is a commitment nobody made.
     * The two are separate columns for exactly this reason, so the assertion
     * is now aimed at the figure rather than at the vocabulary.
     */
    await expect(body).not.toContainText(/\d+\s+(?:units?|in stock|left|available)/i)
    await expect(body).not.toContainText(/stock quantity/i)
    await expect(body).not.toContainText(/fixed price/i)
    /**
     * The internal *fields*, not the word.
     *
     * `/supplier/i` was too wide: the closing prompt says "we source from the
     * same suppliers our vehicles come from", which is body copy the
     * dealership wants and not a leak of `SparePart.supplierName`. What must
     * never appear is a labelled supplier field.
     */
    await expect(body).not.toContainText(/supplier (name|notes)/i)
    await expect(body).not.toContainText(/supplied by/i)
    await expect(body).not.toContainText(/refurbished|country of origin/i)

    // Our own listing reference is internal too — a customer identifies a part
    // by the manufacturer's number, and the dealership asked for the second
    // code to come off every public surface. It still travels in the basket
    // and in the WhatsApp message, neither of which is rendered here.
    await expect(body).not.toContainText(/CLM-SP-/)
  })

  test("marks every price as an estimate", async ({ page }) => {
    // A price a customer budgets against and the business cannot honour is
    // the most expensive thing this site could publish.
    await page.goto("/spare-parts")
    await requireParts(page)

    await expect(catalogue(page).getByText(/prices are estimates/i)).toBeVisible()
  })

  test("filters by category through the URL, and back to all", async ({ page }) => {
    await page.goto("/spare-parts")
    await requireParts(page)

    const rail = page.getByRole("navigation", { name: "Part categories" })
    const chips = rail.getByRole("link")

    if ((await chips.count()) < 2) {
      test.skip(true, "Only the All chip is present — nothing to switch between.")
      return
    }

    // "All" is selected until a customer chooses otherwise.
    await expect(chips.first()).toHaveAttribute("aria-current", "page")

    const category = chips.nth(1)
    const label = (await category.innerText()).split("\n")[0].trim()

    await waitForInteractive(page)
    await category.click()

    // The selection lives in the URL, so it can be bookmarked and shared and
    // the back button works. Waited for on `navigationTimeout` first, for the
    // reason spelled out below.
    await page.waitForURL(/\/spare-parts\?category=/, {
      waitUntil: "domcontentloaded",
    })
    await expect(page).toHaveURL(/\/spare-parts\?category=/)
    await expect(
      rail.getByRole("link", { name: new RegExp(label) }).first()
    ).toHaveAttribute("aria-current", "page")

    await page.goBack()
    await expect(page).toHaveURL(/\/spare-parts$/)
  })

  test("keeps a search term when the category changes", async ({ page }) => {
    // Someone who searches and then taps a category is narrowing, not
    // starting again — dropping the term would silently widen the result set
    // at the moment they thought they had tightened it.
    await page.goto("/spare-parts?q=brake")

    const rail = page.getByRole("navigation", { name: "Part categories" })
    const chips = rail.getByRole("link")

    if ((await chips.count()) < 2) {
      test.skip(true, "No categories to switch between in this database.")
      return
    }

    await waitForInteractive(page)
    await chips.nth(1).click()

    await page.waitForURL(/category=/, { waitUntil: "domcontentloaded" })
    await expect(page).toHaveURL(/q=brake/)

    /**
     * And the field still shows it.
     *
     * On a phone the search collapses to a glyph so the categories can have
     * the row, so it has to be opened before the value can be read. The
     * toggle is marked "Edit search: …" precisely when a term is applied,
     * which is what this looks for — asserting on it here also proves that
     * marking is present, which is the only thing telling a mobile customer a
     * search is in effect at all.
     */
    const editSearch = page.getByRole("button", { name: /^Edit search: / })

    if (await editSearch.isVisible().catch(() => false)) {
      await editSearch.click()
    }

    await expect(page.getByRole("searchbox")).toHaveValue("brake")
  })

  test("adds a part to the cart through the card's preview", async ({ page }) => {
    await page.goto("/spare-parts")
    await requireParts(page)

    /**
     * Two presses, and deliberately so: the card's `+` opens a preview, and
     * the preview is where the part is actually added.
     *
     * A card is a thumbnail, a name and a price — enough to be interested in
     * a part, not enough to be sure of one. The preview is what puts the
     * photograph, the fitment and the description in front of a customer
     * before they commit, without losing their place in the grid.
     *
     * `force` on the first click because the control is revealed on hover on
     * a pointer device and a headless click does not raise one. The
     * interaction it stands in for is a tap, where the button is visible.
     */
    await page
      .getByRole("button", { name: /^Preview and add / })
      .first()
      .click({ force: true })

    const preview = page.getByRole("dialog")
    await expect(preview).toBeVisible()

    await preview.getByRole("button", { name: /^Add .+ to cart$/ }).click()

    // The confirmation is announced in the provider's single live region.
    await expect(page.getByRole("status")).toContainText(/added to cart/i)

    // The panel closes itself, returning the customer to the grid they were
    // working through rather than leaving a finished dialog to dismiss.
    await expect(preview).toBeHidden()

    // And the basket now exists in the header, on the same page, without a
    // reload.
    await expect(page.getByRole("button", { name: /^Cart · 1$/ })).toBeVisible()
  })

  test("keeps the cart across a navigation and a reload", async ({ page }) => {
    await page.goto("/spare-parts")
    await requireParts(page)

    await page
      .getByRole("button", { name: /^Preview and add / })
      .first()
      .click({ force: true })
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Add .+ to cart$/ })
      .click()
    await expect(page.getByRole("button", { name: /^Cart · 1$/ })).toBeVisible()

    // The provider is mounted on the public layout rather than inside a
    // segment, so a move between the catalogue and a part page does not tear
    // it down and rebuild it from storage.
    await openPart(
      page,
      catalogue(page).locator("article a[href^='/spare-parts/']").first()
    )
    await expect(page.getByRole("button", { name: /^Cart · 1$/ })).toBeVisible()

    await page.reload()
    await expect(page.getByRole("button", { name: /^Cart · 1$/ })).toBeVisible()
  })

  test("opens the full part page from a card", async ({ page }) => {
    await page.goto("/spare-parts")
    const cards = await requireParts(page)

    /**
     * `openPart` waits for the navigation on `navigationTimeout` (45s) rather
     * than leaving it to an assertion's `expect.timeout` (15s). The dev
     * webServer compiles `/spare-parts/[slug]` on first request — measured at
     * ~17s in this project — and every assertion written after a click
     * inherits that wait, because Playwright blocks a locator query while a
     * navigation is in flight. See the notes in playwright.config.ts.
     */
    await openPart(page, cards.first())

    await expect(page).toHaveURL(/\/spare-parts\/[a-z0-9-]+$/)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    // The listing carries no internal reference on screen — see the catalogue
    // assertion above. The description is on the page beside the gallery
    // rather than in a band of its own below it.
    await expect(page.getByRole("main")).not.toContainText(/CLM-SP-/)
    await expect(
      page.getByRole("heading", { name: /about this part/i })
    ).toBeVisible()

    /**
     * One control in the page body, adding one unit. The stepper that used to
     * sit beside it is gone: a quantity is now chosen in exactly one place,
     * the basket, so this assertion is also what would catch it being
     * reintroduced here.
     *
     * Below `lg` a second copy of the same button lives in the pinned action
     * bar, so the count is stated relative to that rather than as a flat one —
     * a flat count would pass on a desktop and fail on a phone for a page that
     * is correct on both. The bar itself is asserted in its own test below.
     */
    const addControls = page.getByRole("button", { name: /^Add .+ to cart$/ })
    const pinnedAdd = page
      .locator("[data-mobile-action-bar]")
      .getByRole("button", { name: /^Add .+ to cart$/ })

    await expect(addControls.first()).toBeVisible()
    await expect(addControls).toHaveCount((await pinnedAdd.count()) + 1)
    await expect(
      page.getByRole("button", { name: /^increase quantity of /i })
    ).toHaveCount(0)

    /**
     * Who made it and where it is filed, as labelled pairs rather than the
     * gold eyebrow that used to sit above the name. The brand is deliberately
     * absent from the catalogue card and present here.
     */
    await expect(page.getByRole("main")).toContainText(/Category:/)

    /**
     * The price is marked as provisional in full words, not the "est."
     * abbreviation the cards use — this is the last screen before a customer
     * commits money, and a figure they budget against and the business cannot
     * honour is the most expensive thing this site could publish.
     *
     * Only asserted where there is a figure: a part priced on enquiry has no
     * number for the caution to be about.
     */
    if (await page.getByText(/price on enquiry/i).count() === 0) {
      await expect(page.getByText(/^Estimate$/i).first()).toBeVisible()
    }

    // The trust section, whose steps an operator configures in Settings.
    await expect(
      page.getByRole("heading", { name: /how your part reaches you/i })
    ).toBeVisible()

    await expect(page.getByRole("link", { name: /back to spare parts/i })).toBeVisible()
  })

  test("keeps the add action reachable while scrolling on a phone", async ({
    page,
  }) => {
    const viewport = page.viewportSize()

    /**
     * The bar is `lg:hidden`, so there is nothing to assert above 1024px.
     * Gated on the actual viewport rather than on the project name so the
     * test stays correct if the project list changes. Mirrors the vehicle
     * page's equivalent test — the two bars are the same treatment and should
     * fail the same way if either regresses.
     */
    if (!viewport || viewport.width >= 1024) {
      test.skip(true, "The pinned action bar is a below-lg treatment.")
      return
    }

    await page.goto("/spare-parts")
    const cards = await requireParts(page)

    await openPart(page, cards.first())
    await expect(page).toHaveURL(/\/spare-parts\/[a-z0-9-]+$/)

    const bar = page.locator("[data-mobile-action-bar]")
    await expect(bar).toBeVisible()

    /**
     * The point of the bar is that it survives the scroll. Asserting it is
     * still in the viewport at the very bottom of a long page is also what
     * catches the two overlaps it has to avoid — without the footer's bottom
     * clearance the bar would be sitting on top of the footer, and the action
     * would be the thing covered rather than the thing covering.
     */
    await page.keyboard.press("End")
    await expect(bar).toBeInViewport()

    const pinnedAdd = bar.getByRole("button", { name: /^Add .+ to cart$/ })
    await expect(pinnedAdd).toBeVisible()

    /**
     * It is the real control, not a decorative copy of one: pressing it puts
     * the part in the basket the header badge counts.
     */
    await pinnedAdd.click()
    await expect(page.getByRole("button", { name: /^Cart · 1$/ })).toBeVisible()
  })

  test("answers a slug that is not a live listing with a real 404", async ({
    page,
  }) => {
    /**
     * The status matters as much as the page. A soft 404 — not-found content
     * served with a 200 — is how a withdrawn listing stays in search results,
     * which is why the catalogue's `loading.tsx` lives in a route group that
     * does not cover this segment.
     */
    const response = await page.goto("/spare-parts/no-such-part-clm-sp-2026-999999")

    expect(response?.status()).toBe(404)
  })
})
