import { existsSync } from "node:fs"
import { config } from "dotenv"
import { expect, type Page } from "@playwright/test"

import { adminUrlPattern } from "./paths"
import { ADMIN_BASE_PATH } from "../../../src/lib/constants/admin-routes"

// Matches prisma.config.ts and the provisioning scripts: read .env.local when
// it exists, otherwise rely on real environment variables (Codespaces, CI).
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

/**
 * Signs `page` in as E2E_ADMIN_EMAIL with a brand-new Supabase session.
 *
 * Generates a one-time recovery token server-side (no email is sent) and
 * exchanges it through /auth/confirm, exactly as a real recovery link would.
 *
 * Used by the setup project for the shared session, and by any test that
 * ends a session. Ending the shared one would sign every other test out: the
 * dashboard refuses a signed-out session on its very next request, rather
 * than honouring its token until it expires.
 */
export async function signInAsAdmin(page: Page): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const email = process.env.E2E_ADMIN_EMAIL

  expect(
    Boolean(supabaseUrl && secretKey && email),
    "E2E_ADMIN_EMAIL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required"
  ).toBe(true)

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: secretKey!,
      Authorization: `Bearer ${secretKey!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "recovery", email }),
  })

  expect(
    response.ok,
    `Supabase refused to generate a session link (${response.status}). ` +
      `Check SUPABASE_SECRET_KEY, and that ${email} exists as an auth user.`
  ).toBe(true)

  const body = (await response.json()) as { hashed_token?: string }
  expect(body.hashed_token, "Supabase returned no token").toBeTruthy()

  await page.goto(
    `/auth/confirm?token_hash=${body.hashed_token}&type=recovery&next=${encodeURIComponent(ADMIN_BASE_PATH)}`,
    { timeout: 120_000 }
  )

  await expect(page).toHaveURL(adminUrlPattern("", { exact: true }))
}
