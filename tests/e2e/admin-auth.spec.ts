import { expect, test } from "@playwright/test"

/**
 * Negative-first authentication tests (SECURITY.MD §63).
 *
 * The happy path — a real administrator signing in — needs a provisioned
 * Supabase user and a mailbox, so it is verified by hand against a real
 * account rather than automated here. What *can* be automated, and matters
 * more, is that every door is shut for someone who has not signed in. These
 * are the tests that fail loudly if a future page forgets its guard.
 */

/** Every admin route that must be unreachable without a session. */
const PROTECTED_ADMIN_ROUTES = [
  "/admin",
  "/admin/vehicles",
  "/admin/vehicles/new",
  "/admin/vehicles/some-id",
  "/admin/vehicles/some-id/photos",
  "/admin/quotes",
  "/admin/quotes/some-id",
  "/admin/orders",
  "/admin/orders/some-id",
  "/admin/payments",
  "/admin/payments/some-id",
  "/admin/customers",
  "/admin/customers/some-id",
  "/admin/tracking/some-shipment",
  "/admin/settings",
  "/admin/forbidden",
]

test.describe("unauthenticated access to the admin area", () => {
  for (const route of PROTECTED_ADMIN_ROUTES) {
    test(`${route} redirects an anonymous visitor to sign in`, async ({ page }) => {
      await page.goto(route)

      await expect(page).toHaveURL(/\/admin\/login/)
      await expect(
        page.getByRole("heading", { level: 1, name: "Sign in" })
      ).toBeVisible()
    })
  }

  test("preserves the requested page so sign-in returns there", async ({ page }) => {
    await page.goto("/admin/payments")

    const url = new URL(page.url())
    expect(url.searchParams.get("next")).toBe("/admin/payments")
  })

  test("does not render admin content before redirecting", async ({ page }) => {
    // A layout-based guard would still stream the page's own markup into the
    // RSC payload. The body must not contain dashboard content at all.
    const response = await page.goto("/admin")

    expect(response?.status()).toBe(200) // the login page, after the redirect
    await expect(page.getByText("Your permissions")).toHaveCount(0)
  })
})

test.describe("sign-in page", () => {
  test("is reachable without a session", async ({ page }) => {
    await page.goto("/admin/login")

    await expect(page.getByLabel("Email address")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
  })

  test("does not reveal whether an account exists", async ({ page }) => {
    // Makes a real request to Supabase Auth, which is the point: the
    // generic message has to survive the provider's own error text.
    await page.goto("/admin/login")

    await page.getByLabel("Email address").fill("definitely-not-a-user@example.com")
    await page.getByLabel("Password").fill("not-the-right-password")
    await page.getByRole("button", { name: "Sign in" }).click()

    // Scoped to our own Alert component: Next.js renders a
    // `#__next-route-announcer__` element that also carries role="alert",
    // so an unscoped getByRole("alert") is ambiguous on every page.
    const alert = page.locator('[data-slot="alert"]')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText("did not match an active administrator account")

    // None of these words should ever reach the user here: each one tells an
    // attacker which half of the credential pair was wrong.
    const body = (await page.locator("body").innerText()).toLowerCase()
    expect(body).not.toContain("user not found")
    expect(body).not.toContain("invalid password")
    expect(body).not.toContain("email not confirmed")
  })

  test("refuses to carry an off-site return path into the form", async ({ page }) => {
    await page.goto("/admin/login?next=https://evil.example/admin")

    // The hidden field is only rendered for a path that passed validation,
    // so an unsafe value must leave no trace in the DOM at all.
    await expect(page.locator('input[name="next"]')).toHaveCount(0)
  })

  test("refuses a protocol-relative return path", async ({ page }) => {
    await page.goto("/admin/login?next=//evil.example")

    await expect(page.locator('input[name="next"]')).toHaveCount(0)
  })

  test("explains why you are here after a password change", async ({ page }) => {
    // updatePasswordAction ends every session, including the current one
    // (SECURITY.MD §42). Without this notice the administrator lands on a
    // bare login form seconds after setting a password and reasonably
    // concludes it did not work.
    await page.goto("/admin/login?notice=password_updated")

    await expect(page.locator('[data-slot="alert"]')).toContainText(
      "Password updated. Sign in with your new password."
    )
  })

  test("keeps a safe return path", async ({ page }) => {
    await page.goto("/admin/login?next=%2Fadmin%2Fvehicles")

    await expect(page.locator('input[name="next"]')).toHaveValue("/admin/vehicles")
  })
})

test.describe("password recovery", () => {
  test("gives the same answer for an unknown address", async ({ page }) => {
    await page.goto("/admin/forgot-password")

    await page.getByLabel("Email address").fill("nobody-here@example.com")
    await page.getByRole("button", { name: "Send reset link" }).click()

    await expect(page.locator('[data-slot="alert"]')).toContainText(
      "If that address belongs to an administrator account"
    )
  })

  test("set-a-password page rejects a visitor with no recovery session", async ({
    page,
  }) => {
    await page.goto("/admin/reset-password")

    await expect(page).toHaveURL(/\/admin\/login/)
  })
})

test.describe("auth callback", () => {
  test("rejects a request with no token", async ({ page }) => {
    await page.goto("/auth/confirm")

    await expect(page).toHaveURL(/\/admin\/login\?error=invalid_link/)
  })

  test("rejects a forged token", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=not-a-real-token&type=recovery")

    await expect(page).toHaveURL(/\/admin\/login\?error=invalid_link/)
  })

  test("ignores an off-site next parameter", async ({ page }) => {
    // Even on the failure path the handler must not bounce off-site.
    await page.goto(
      "/auth/confirm?token_hash=x&type=recovery&next=https://evil.example"
    )

    expect(new URL(page.url()).hostname).not.toBe("evil.example")
  })
})

test.describe("legibility", () => {
  test("sign-in fields have readable contrast on the dark shell", async ({ page }) => {
    // Regression guard. The admin shell is a dark surface, but Input paints
    // its own opaque light background. When the field inherited the shell's
    // near-white text colour instead of pinning its own, it rendered white
    // on white — the text was there and submitted correctly, it was simply
    // invisible. A screenshot diff would not have caught it either, since
    // an empty-looking field looks like an empty field.
    //
    // Asserting a real contrast ratio rather than "colour !== background"
    // catches the near-miss cases too, and encodes the accessibility
    // requirement from the brief (§17, readable contrast) as a number.
    await page.goto("/admin/login")

    for (const label of ["Email address", "Password"]) {
      const field = page.getByLabel(label, { exact: true })
      await field.fill("something typed")

      const ratio = await field.evaluate((el) => {
        const style = getComputedStyle(el)

        // Resolve any colour notation the browser reports (lab(), oklch(),
        // rgb()) to sRGB by letting the browser paint it for us.
        const toRgb = (value: string): [number, number, number] => {
          const probe = document.createElement("canvas").getContext("2d")!
          probe.fillStyle = value
          probe.fillRect(0, 0, 1, 1)
          const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
          return [r, g, b]
        }

        // WCAG relative luminance.
        const luminance = ([r, g, b]: [number, number, number]) => {
          const channel = (c: number) => {
            const s = c / 255
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
          }
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
        }

        const a = luminance(toRgb(style.color))
        const b = luminance(toRgb(style.backgroundColor))
        const [light, dark] = a > b ? [a, b] : [b, a]

        return (light + 0.05) / (dark + 0.05)
      })

      // WCAG AA for body text. The correct value here is ~20:1; the broken
      // one was ~1.02:1, so this threshold is nowhere near the real margin.
      expect(ratio, `${label} contrast ratio`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

test.describe("hardening", () => {
  test("keeps the admin area out of robots.txt", async ({ request }) => {
    const response = await request.get("/robots.txt")
    const body = await response.text()

    expect(body).toContain("Disallow: /admin")
  })

  test("sends baseline security headers", async ({ request }) => {
    const response = await request.get("/admin/login")
    const headers = response.headers()

    expect(headers["x-content-type-options"]).toBe("nosniff")
    expect(headers["x-frame-options"]).toBe("DENY")
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'")
  })

  test("rejects a Server Action submitted from a foreign origin", async ({
    request,
    baseURL,
  }) => {
    // Next.js defends Server Actions against CSRF by comparing Origin to
    // Host. `serverActions.allowedOrigins` in next.config.ts widens that for
    // the Codespaces forwarded domain, and widening a CSRF control is
    // exactly the kind of change that deserves a test pinning down what it
    // did *not* widen.
    //
    // The action id is deliberately bogus. A rejected origin fails the CSRF
    // check before the id is ever resolved, so the two outcomes are
    // distinguishable: "Invalid Server Actions request" means the gate held,
    // while a missing-action error means the request got past it.
    // `x-forwarded-host` is varied deliberately. Next compares Origin against
    // the FORWARDED host, so a test that omits that header exercises a
    // different code path from the one a proxied browser actually takes —
    // which is how the Codespaces failure survived an earlier version of
    // this test. Both are covered below.
    const post = (origin: string, forwardedHost?: string) =>
      request.post("/admin/login", {
        headers: {
          Origin: origin,
          ...(forwardedHost ? { "X-Forwarded-Host": forwardedHost } : {}),
          "Next-Action": "00000000000000000000000000000000000000",
          "Content-Type": "text/plain;charset=UTF-8",
        },
        data: "[]",
      })

    const REJECTED = "Invalid Server Actions request"
    const proxyHost = "some-codespace-3000.app.github.dev"

    // Rejected regardless of what the forwarded host claims.
    expect(await (await post("https://evil.example")).text()).toContain(REJECTED)
    expect(await (await post("https://evil.example", proxyHost)).text()).toContain(
      REJECTED
    )

    // Control: the app's own origin must still reach an action, or this test
    // would also pass with Server Actions entirely broken.
    const own = baseURL ?? "http://localhost:3000"
    expect(await (await post(own)).text()).not.toContain(REJECTED)
  })

  test("marks admin responses as uncacheable", async ({ request }) => {
    // Private data must never be served from a shared cache — Cloudflare
    // sits in front of this application in production.
    //
    // Asserted against the proxy's redirect rather than a rendered page
    // because `next dev` overwrites Cache-Control on rendered responses,
    // while `next start` does not. The header comes from the same line of
    // proxy code either way, so the redirect is the assertion that is
    // meaningful under both servers. Once the Playwright webServer switches
    // to `build && start` (see playwright.config.ts), a rendered admin page
    // can be asserted here directly.
    const response = await request.get("/admin/payments", { maxRedirects: 0 })

    expect(response.status()).toBe(307)
    expect(response.headers()["cache-control"]).toContain("no-store")
    expect(response.headers()["cache-control"]).toContain("private")
  })
})
