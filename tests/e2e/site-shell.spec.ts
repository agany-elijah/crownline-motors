import { expect, test } from "@playwright/test"

/**
 * Stage 4 validation gate: the public shell must hold up at desktop,
 * tablet and mobile. This is deliberately about the *shell* (header,
 * nav, footer, drawer) rather than page content — the pages themselves
 * are still placeholders at this stage.
 */

test("header and footer render on the homepage", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("banner")).toBeVisible()
  await expect(page.getByRole("contentinfo")).toBeVisible()
  await expect(page).toHaveTitle(/Crownline Motors/)
})

test("every main nav destination resolves", async ({ page }) => {
  // /spare-parts is absent because it is no longer linked anywhere — the
  // entry ships marked unavailable until the Wave B catalogue lands (see
  // the test below). Add it here once the route exists.
  const routes = [
    "/",
    "/cars",
    "/how-it-works",
    "/track-my-order",
    "/get-a-quote",
    "/about-us",
    "/contact",
  ]

  for (const route of routes) {
    const response = await page.goto(route)
    expect(response?.status(), `${route} should not 404`).toBeLessThan(400)
  }
})

test("desktop shows inline nav and hides the menu trigger", async ({ page }) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) < 1280,
    "Inline nav only applies at the xl breakpoint and above"
  )

  await page.goto("/")

  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden()
})

test("mobile drawer opens, traps the nav, and closes on selection", async ({ page }) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) >= 1280,
    "The drawer is only reachable below the xl breakpoint"
  )

  await page.goto("/")

  const trigger = page.getByRole("button", { name: "Open menu" })
  await expect(trigger).toBeVisible()
  await trigger.click()

  const drawer = page.getByRole("dialog")
  await expect(drawer).toBeVisible()

  // Navigating from the drawer must both route and dismiss the overlay —
  // a drawer left open over the destination is a classic mobile nav bug.
  await drawer.getByRole("link", { name: "Cars" }).click()
  await expect(page).toHaveURL(/\/cars$/)
  await expect(drawer).toBeHidden()
})

test("skip link is the first stop in the tab order and targets the content", async ({ page }) => {
  await page.goto("/")
  await page.keyboard.press("Tab")

  const skip = page.getByRole("link", { name: "Skip to content" })
  await expect(skip).toBeFocused()
  await expect(skip).toHaveAttribute("href", "#main-content")
  await expect(page.locator("#main-content")).toBeAttached()
})

test.describe("scroll reveal", () => {
  test("content below the fold becomes visible once scrolled to", async ({ page }) => {
    await page.goto("/design-system")

    const revealed = page.locator("[data-reveal]").last()
    await revealed.scrollIntoViewIfNeeded()

    // Guards the specific failure this pattern invites: the hidden state is
    // set in CSS and only ever cleared by JS, so a broken observer would
    // leave content permanently at opacity 0 while still occupying layout.
    await expect(revealed).toHaveCSS("opacity", "1")
  })

  test("reduced motion shows everything immediately, with no reveal needed", async ({ page }) => {
    // Emulated explicitly rather than through `test.use({ reducedMotion })`,
    // which does not reach the context reliably here — the media query was
    // still reporting no-preference, so the test passed or failed for
    // reasons unrelated to the thing it is meant to check.
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/design-system")

    const opacities = await page
      .locator("[data-reveal]")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity))

    expect(opacities.length).toBeGreaterThan(0)
    expect(opacities.every((o) => o === "1")).toBe(true)
  })

  test("content is visible with JavaScript disabled", async ({ browser }) => {
    // The hidden state is gated on `(scripting: enabled)`. Without that
    // guard a visitor with no JavaScript gets a page whose sections occupy
    // full height but render nothing at all — the worst possible failure
    // mode for a decorative animation.
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    try {
      await page.goto("/design-system")

      const opacities = await page
        .locator("[data-reveal]")
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity))

      expect(opacities.length).toBeGreaterThan(0)
      expect(opacities.every((o) => o === "1")).toBe(true)
    } finally {
      await context.close()
    }
  })
})

/**
 * Two regressions that shipped together and made the header unusable on a
 * phone. They are unrelated in cause but produced one symptom, so they are
 * grouped here to keep that history readable.
 */
test.describe("header legibility", () => {
  test("stays opaque on pages with no hero to sit over", async ({ page }) => {
    // The header used to go transparent-with-white-text whenever the route
    // was "/", on the assumption the homepage always had a dark hero
    // beneath it. While the homepage was a placeholder that assumption was
    // false and the entire navigation rendered white on white — invisible,
    // with nothing in the DOM to indicate anything was wrong.
    //
    // The header now asks whether a [data-hero-anchor] element is actually
    // present rather than inferring it from the URL, so this holds on the
    // homepage specifically, not merely on inner pages.
    await page.goto("/")
    await expect(page.locator("[data-hero-anchor]")).toHaveCount(0)

    const header = page.getByRole("banner")
    await expect(header).not.toHaveAttribute("data-tone", "dark")

    // Opaque enough to separate nav text from whatever is behind it.
    const alpha = await header.evaluate((el) => {
      const bg = getComputedStyle(el).backgroundColor
      const match = bg.match(/rgba?\(([^)]+)\)/)
      if (!match) return 1
      const parts = match[1].split(",").map((v) => parseFloat(v))
      return parts.length === 4 ? parts[3] : 1
    })
    expect(alpha).toBeGreaterThan(0.5)
  })

  test("menu trigger stays within the viewport on a phone", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 1280,
      "The menu trigger only renders below the xl breakpoint"
    )

    // A decorative glow used a negative horizontal inset, which added its
    // overhang to the document's scrollable width. That made the page wider
    // than the screen; mobile browsers answer that by shrinking the layout
    // to fit, which carried the header's menu button off the right edge of
    // the display. Asserting on the button alone would not have caught it —
    // the button was correctly positioned relative to a viewport that was
    // itself wrong — so the page width is checked as well.
    for (const route of ["/", "/design-system", "/cars", "/contact"]) {
      await page.goto(route)

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth, `${route} must not scroll horizontally`).toBeLessThanOrEqual(
        clientWidth + 1
      )

      const box = await page.getByRole("button", { name: "Open menu" }).boundingBox()
      expect(box, `${route} should render a menu trigger`).not.toBeNull()
      expect(box!.x + box!.width, `${route} menu trigger must be on screen`).toBeLessThanOrEqual(
        clientWidth
      )
    }
  })
})

test("unavailable sections are marked, not linked into a 404", async ({ page }) => {
  // Stage 4 allows navigation entries to ship disabled until their
  // implementation stage. The requirement this guards is that "disabled"
  // means *not a link*: an anchor pointing at a route that does not exist
  // is still tappable and still announced as a link, so it fails the same
  // way whether or not it looks greyed out.
  await page.goto("/")

  const spareParts = page.getByRole("link", { name: /spare parts/i })
  await expect(spareParts).toHaveCount(0)

  // Still present as wayfinding — the section is coming, and the brief
  // wants customers to know that — just not as a destination yet.
  await expect(page.getByText("Spare Parts").first()).toBeAttached()
})
