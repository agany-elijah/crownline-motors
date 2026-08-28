/**
 * Generates a password-reset link for an existing administrator, and prints
 * it instead of emailing it.
 *
 *   npm run admin:reset-link -- --email=someone@example.com
 *
 * ── When to use this ──────────────────────────────────────────────────
 * The normal route is /admin/forgot-password, which emails a link. This
 * script exists for the cases where that round trip is the problem rather
 * than the solution:
 *
 *   - Bootstrapping in a Codespace or on localhost, where the origin baked
 *     into an email may not be reachable from wherever the mail is opened.
 *   - An invitation that was consumed by a dead redirect. Supabase verifies
 *     the token *before* forwarding, so following an invite to an
 *     unreachable address spends it — the account is confirmed but has no
 *     password anyone knows.
 *   - Account recovery during handover, when email may not be configured.
 *
 * ── Why the printed link avoids Supabase's own verify endpoint ────────
 * `generateLink` returns `hashed_token`, which is exactly what our
 * /auth/confirm route consumes. Building the URL against our own origin
 * means the link never passes through Supabase's redirect allow-list, so it
 * works without a dashboard change — and it works against whichever origin
 * is actually reachable, which is the whole difficulty this script solves.
 *
 * ⚠️ The printed URL is a live, single-use credential. Anyone holding it can
 * set that administrator's password until it is used or expires. Do not
 * paste it into a chat, an issue, or a shared terminal recording. Running
 * this script already requires SUPABASE_SECRET_KEY, so it grants nothing the
 * operator did not already have — but the URL is far easier to leak by
 * accident than the key is (SECURITY.MD §43).
 */

import { config } from "dotenv"
import { existsSync } from "node:fs"
import { z } from "zod"

if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const argsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("--email must be a valid email address")),
})

function parseArgs(argv: string[]) {
  const raw: Record<string, string> = {}

  for (const arg of argv) {
    const match = /^--([a-zA-Z]+)=(.*)$/.exec(arg)
    if (match) raw[match[1]] = match[2]
  }

  const parsed = argsSchema.safeParse(raw)

  if (!parsed.success) {
    console.error("❌ Invalid arguments:\n")
    for (const issue of parsed.error.issues) {
      console.error(`   ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    }
    console.error("\nUsage: npm run admin:reset-link -- --email=you@example.com\n")
    process.exit(1)
  }

  return parsed.data
}

function requireEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    console.error(`❌ ${name} is not set.`)
    process.exit(1)
  }

  return value
}

/**
 * Every origin this app might be reachable on, most likely first.
 *
 * All of them are printed rather than one being guessed, because which one
 * works depends on things this process cannot see: whether the editor is
 * desktop VS Code (localhost is forwarded) or the browser (it is not), and
 * whether the Codespace port is private (needs a GitHub session) or public.
 * Printing the set and letting the operator pick the one that opens is more
 * useful than confidently printing the wrong one.
 */
function candidateOrigins(): { label: string; origin: string }[] {
  const origins: { label: string; origin: string }[] = []

  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    origins.push({ label: "NEXT_PUBLIC_SITE_URL", origin: explicit.replace(/\/$/, "") })
  }

  const codespace = process.env.CODESPACE_NAME
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  if (codespace && domain) {
    origins.push({
      label: "Codespaces forwarded port (needs a GitHub session in that browser)",
      origin: `https://${codespace}-3000.${domain}`,
    })
  }

  origins.push({
    label: "Local (works with desktop VS Code port forwarding)",
    origin: "http://localhost:3000",
  })

  return origins
}

async function main() {
  const { email } = parseArgs(process.argv.slice(2))

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const secretKey = requireEnv("SUPABASE_SECRET_KEY")
  const databaseUrl = requireEnv("DATABASE_URL")

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  })

  const supabase = createSupabaseClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // Same rule the application enforces: being able to authenticate is not
    // being an administrator. No point minting a recovery link for an
    // account the dashboard would reject anyway.
    const profile = await prisma.adminProfile.findUnique({
      where: { email },
      select: { displayName: true, role: true, isActive: true },
    })

    if (!profile) {
      console.error(`❌ No administrator exists for ${email}.`)
      console.error("   Create one first with: npm run admin:create -- --email=… --name=…\n")
      process.exitCode = 1
      return
    }

    if (!profile.isActive) {
      console.error(`❌ The administrator for ${email} is deactivated.`)
      console.error("   Reactivate the AdminProfile before issuing a reset link.\n")
      process.exitCode = 1
      return
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    })

    if (error || !data?.properties?.hashed_token) {
      console.error(`❌ Could not generate a reset link: ${error?.message ?? "no token returned"}`)
      process.exitCode = 1
      return
    }

    const query = new URLSearchParams({
      token_hash: data.properties.hashed_token,
      type: "recovery",
      next: "/admin/reset-password",
    })

    console.log(`\n✅ Reset link for ${profile.displayName} (${profile.role}).\n`)
    console.log("   Start the dev server, then open whichever of these your browser can reach:\n")

    for (const { label, origin } of candidateOrigins()) {
      console.log(`   ${label}:`)
      console.log(`   ${origin}/auth/confirm?${query.toString()}\n`)
    }

    console.log("   ⚠️  Single-use and time-limited. Opening it consumes it, whether or")
    console.log("      not the page loads — so make sure the server is running first.")
    console.log("      Treat it as a password: do not paste it anywhere shared.\n")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error("❌ Failed to generate a reset link:", error)
  process.exit(1)
})
