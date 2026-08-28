/**
 * Development seed.
 *
 * Deliberately does NOT create administrators. Provisioning staff means
 * creating real Supabase auth users, which is an operator action performed
 * through scripts/create-admin.ts — a seed that silently minted accounts
 * would be a way for a development convenience to end up in a production
 * database.
 *
 * What it does create is the one row the application genuinely cannot run
 * without: the BusinessSettings singleton.
 */

import { config } from "dotenv"
import { existsSync } from "node:fs"

if (existsSync(".env.local")) {
  config({ path: ".env.local" })
}

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set.")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
})

async function main() {
  /**
   * BusinessSettings is a singleton keyed at id = 1 by application
   * convention rather than a database constraint. `upsert` on that id is
   * what enforces the convention: running the seed twice updates nothing
   * and creates nothing extra.
   *
   * The percentages are the payment policy from the brief — 50% initial,
   * 25% on arrival at Mombasa, 25% before release. They are *defaults*: each
   * order locks its own copy into PaymentMilestone rows at creation time, so
   * editing these later never changes what an existing customer already
   * agreed to pay.
   */
  const settings = await prisma.businessSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      // Overridden from the admin settings screen once it exists. The env
      // var is the public contact number, not a secret.
      whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
      defaultInitialPercentage: 50,
      defaultMombasaPercentage: 25,
      defaultFinalPercentage: 25,
    },
  })

  console.log("✅ BusinessSettings ready:", {
    initial: `${settings.defaultInitialPercentage}%`,
    mombasa: `${settings.defaultMombasaPercentage}%`,
    final: `${settings.defaultFinalPercentage}%`,
    whatsappNumber: settings.whatsappNumber || "(not set)",
  })
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
