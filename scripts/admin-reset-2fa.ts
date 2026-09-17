/**
 * Removes an administrator's two-factor authentication, for a lost or
 * replaced phone.
 *
 *   npm run admin:reset-2fa -- --email=admin@example.com
 *
 * ── Why a script and not a dashboard button ───────────────────────────
 * The person who has lost their authenticator cannot sign in to press one,
 * and a button that lets one administrator strip another's second factor is
 * exactly the capability an attacker with one stolen account would want. This
 * needs the service key and a terminal, which is the right bar.
 *
 * It deletes every authenticator factor for the account in Supabase Auth,
 * clears `AdminProfile.twoFactorEnabledAt`, ends the administrator's open
 * sessions, and records the change in the audit log against that
 * administrator. If Settings requires two-factor for everyone, they are sent
 * to set a new one up on their next sign-in.
 */

import { config } from "dotenv"
import { existsSync } from "node:fs"
import { z } from "zod"

if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

import { PrismaPg } from "@prisma/adapter-pg"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import { PrismaClient } from "../src/generated/prisma/client"

const argsSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("--email must be a valid email address")),
})

function parseArgs(argv: string[]) {
  const raw: Record<string, string> = {}
  for (const arg of argv) {
    const match = /^--([a-zA-Z]+)=(.*)$/.exec(arg)
    if (match) raw[match[1]] = match[2]
  }

  const parsed = argsSchema.safeParse(raw)
  if (!parsed.success) {
    console.error("❌ Invalid arguments. Usage: npm run admin:reset-2fa -- --email=you@example.com")
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

async function main() {
  const { email } = parseArgs(process.argv.slice(2))

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }) })
  const supabase = createSupabaseClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const profile = await prisma.adminProfile.findUnique({ where: { email }, select: { id: true } })
    if (!profile) {
      console.error(`❌ No administrator has the email ${email}.`)
      process.exit(1)
    }

    const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId: profile.id })
    if (error) {
      console.error(`❌ Could not list authenticator factors: ${error.message}`)
      process.exit(1)
    }

    for (const factor of data.factors) {
      const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({ userId: profile.id, id: factor.id })
      if (deleteError) {
        console.error(`❌ Could not remove factor ${factor.id}: ${deleteError.message}`)
        process.exit(1)
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.adminProfile.update({ where: { id: profile.id }, data: { twoFactorEnabledAt: null } })
      await tx.adminSession.updateMany({
        where: { adminId: profile.id, endedAt: null },
        data: { endedAt: new Date(), endReason: "REVOKED" },
      })
      await tx.auditLog.create({
        data: {
          actorId: profile.id,
          action: "ADMIN_TWO_FACTOR_DISABLED",
          entityType: "AdminProfile",
          entityId: profile.id,
          metadata: { via: "admin:reset-2fa script", factorsRemoved: data.factors.length },
        },
      })
    })

    console.log(`✅ Two-factor authentication removed for ${email} (${data.factors.length} factor(s)). Their sessions were ended.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
