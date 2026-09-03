/**
 * Provisions a Crownline Motors administrator.
 *
 *   npm run admin:create -- --email=someone@example.com --name="Jane Doe"
 *
 * ── Why this is a terminal script and not a page ──────────────────────
 * Self-signup is disabled in the Supabase dashboard, which is what keeps
 * strangers out of the auth project entirely. An HTTP endpoint that creates
 * administrators would reopen exactly that hole through a different door,
 * and it would have to be protected by the very system it bootstraps —
 * there is no administrator to authorise the creation of the first
 * administrator. So provisioning is an operator action, performed with
 * credentials that only an operator holds (SUPABASE_SECRET_KEY), from a
 * machine an operator controls.
 *
 * The invited person receives an email, follows it to /auth/confirm, and
 * chooses their own password. No password is ever set, transmitted or
 * printed by this script.
 *
 * ── Node version ──────────────────────────────────────────────────────
 * @supabase/supabase-js requires Node 22+. On Node 20 it throws because
 * `WebSocket` is not a global; the npm script passes
 * --experimental-websocket to cover that. Inside Next.js the runtime
 * supplies WebSocket already, so only standalone scripts need it.
 */

import { config } from "dotenv"
import { existsSync } from "node:fs"
import { z } from "zod"

// Matches prisma.config.ts: load .env.local when it exists (local dev), and
// fall through to real environment variables otherwise (Codespaces, CI).
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { AdminRole } from "../src/generated/prisma/enums"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { adminPath } from "../src/lib/constants/admin-routes"

/**
 * Builds the service-key client locally rather than importing
 * `createAdminClient()` from src/lib/supabase/admin.ts.
 *
 * That module carries `import "server-only"`, which throws outside a React
 * Server Component environment — exactly the guard that stops it reaching a
 * browser bundle also stops it being imported by a plain Node script. The
 * duplication is four lines and it keeps that guard intact, which is the
 * better trade.
 */
function createServiceClient(url: string, secretKey: string) {
  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type ServiceClient = ReturnType<typeof createServiceClient>

const argsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("--email must be a valid email address")),
  name: z.string().trim().min(1, "--name is required").max(120),
  role: z.enum(AdminRole).default(AdminRole.ADMIN),
})

function parseArgs(argv: string[]) {
  const raw: Record<string, string> = {}

  for (const arg of argv) {
    const match = /^--([a-zA-Z]+)=(.*)$/.exec(arg)
    if (match) {
      raw[match[1]] = match[2]
    }
  }

  const parsed = argsSchema.safeParse(raw)

  if (!parsed.success) {
    console.error("❌ Invalid arguments:\n")
    for (const issue of parsed.error.issues) {
      console.error(`   ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    }
    console.error(
      '\nUsage: npm run admin:create -- --email=you@example.com --name="Your Name"'
    )
    console.error(`Roles: ${Object.values(AdminRole).join(", ")}\n`)
    process.exit(1)
  }

  return parsed.data
}

/**
 * The origin the invitation email should link back to.
 *
 * Order matters, and the middle case is the one worth having:
 *
 *   1. NEXT_PUBLIC_SITE_URL — always wins. The only correct source in
 *      production, and an explicit override anywhere else.
 *
 *   2. A GitHub Codespace's forwarded origin, reconstructed from the two
 *      variables Codespaces injects. Without this the script falls back to
 *      localhost, which is a *different machine* from the one reading the
 *      email — the link then dies, and because Supabase verifies the token
 *      before redirecting, the invitation is spent on a page that never
 *      loaded. That failure is silent, one-shot, and looks like a bug in the
 *      email rather than a misconfiguration.
 *
 *   3. localhost:3000 — plain local development, where it is correct.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    return explicit.replace(/\/$/, "")
  }

  const codespace = process.env.CODESPACE_NAME
  const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN

  if (codespace && forwardingDomain) {
    // Port 3000 matches `next dev`. Change both together if that ever moves.
    return `https://${codespace}-3000.${forwardingDomain}`
  }

  return "http://localhost:3000"
}

function requireEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    console.error(`❌ ${name} is not set. It is required to provision an administrator.`)
    process.exit(1)
  }

  return value
}

async function main() {
  const { email, name, role } = parseArgs(process.argv.slice(2))

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const secretKey = requireEnv("SUPABASE_SECRET_KEY")
  const databaseUrl = requireEnv("DATABASE_URL")

  // The invite email links here; /auth/confirm exchanges the one-time token
  // for a session and forwards to the set-a-password form.
  const siteUrl = resolveSiteUrl()
  const redirectTo = `${siteUrl}/auth/confirm?next=${encodeURIComponent(adminPath("/reset-password"))}`

  console.log(`→ Invite links will point at ${siteUrl}`)
  console.log(
    "  That exact origin must be listed under Supabase → Authentication →\n" +
      "  URL Configuration → Redirect URLs, and something must be serving it\n" +
      "  when the link is opened. The invite token is single-use: following it\n" +
      "  to a dead address consumes it, and a new invite is then required.\n"
  )

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  })

  const supabase = createServiceClient(supabaseUrl, secretKey)

  try {
    const existingProfile = await prisma.adminProfile.findUnique({ where: { email } })

    if (existingProfile) {
      console.error(
        `❌ An administrator already exists for ${email} (role ${existingProfile.role}, ` +
          `${existingProfile.isActive ? "active" : "deactivated"}).`
      )
      console.error(
        "   Administrators are never duplicated. Change the role or reactivate the " +
          "existing record instead."
      )
      process.exitCode = 1
      return
    }

    console.log(`→ Inviting ${email} …`)

    const { data: invited, error: inviteError } = await supabase.auth.admin
      .inviteUserByEmail(email, { redirectTo })

    let authUserId: string | undefined = invited?.user?.id

    if (inviteError) {
      // An auth user can already exist without an AdminProfile — for example
      // if a previous run failed partway, or the address was used before
      // self-signup was disabled. Adopt that user rather than refusing.
      const alreadyRegistered =
        inviteError.code === "email_exists" || inviteError.status === 422

      if (!alreadyRegistered) {
        console.error(`❌ Could not send the invitation: ${inviteError.message}`)
        process.exitCode = 1
        return
      }

      console.log("→ That address already has an auth user; linking to it instead.")
      authUserId = await findAuthUserIdByEmail(supabase, email)

      if (!authUserId) {
        console.error(
          `❌ Supabase reports ${email} already exists, but the user could not be found. ` +
            "Check the Auth users list in the Supabase dashboard."
        )
        process.exitCode = 1
        return
      }
    }

    if (!authUserId) {
      console.error("❌ Supabase returned no user id for the invitation.")
      process.exitCode = 1
      return
    }

    try {
      // AdminProfile.id IS the Supabase auth UID — the schema has no @default
      // precisely so this link is explicit rather than incidental.
      const profile = await prisma.adminProfile.create({
        data: { id: authUserId, email, displayName: name, role },
      })

      console.log("\n✅ Administrator provisioned.\n")
      console.log(`   Name:  ${profile.displayName}`)
      console.log(`   Email: ${profile.email}`)
      console.log(`   Role:  ${profile.role}`)
      console.log(`   UID:   ${profile.id}\n`)
      console.log(
        `   ${email} has been emailed an invitation. Following it sets their password\n` +
          "   and signs them in. No password was set or printed by this script.\n"
      )
    } catch (profileError) {
      // Compensating action: an auth user with no AdminProfile can sign in
      // but is rejected by the DAL — harmless, yet it is a dangling account
      // nobody asked for. Only remove one this run just created.
      if (!inviteError) {
        console.error("→ Could not create the AdminProfile; removing the invited auth user.")
        await supabase.auth.admin.deleteUser(authUserId)
      }

      throw profileError
    }
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Finds an auth user's id by email.
 *
 * The admin API has no lookup-by-email, so this pages through the user list.
 * Fine for a provisioning script run by hand against a project with a
 * handful of staff accounts; it is not a pattern to reuse in request code.
 */
async function findAuthUserIdByEmail(
  supabase: ServiceClient,
  email: string
): Promise<string | undefined> {
  const perPage = 200

  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })

    if (error) {
      console.error(`❌ Could not list auth users: ${error.message}`)
      return undefined
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === email)
    if (match) return match.id

    if (data.users.length < perPage) return undefined
  }

  return undefined
}

main().catch((error) => {
  console.error("❌ Failed to provision administrator:", error)
  process.exit(1)
})
