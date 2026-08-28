import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"

/**
 * The application's single Prisma client.
 *
 * Connection strategy (see the schema documentation in CLAUDE.md §12):
 * this client uses DATABASE_URL — Supabase's *transaction* pooler on port
 * 6543 — because that is what a serverless runtime with many short-lived
 * invocations needs. The Prisma CLI reads DIRECT_URL instead, through
 * prisma.config.ts, since DDL is unreliable through transaction-mode
 * pooling. The two must stay separate; pointing this file at DIRECT_URL
 * would exhaust Supabase's direct connection limit under load.
 *
 * Prisma 7 no longer accepts a connection URL inside schema.prisma, so the
 * URL is supplied here through the pg driver adapter rather than being
 * inferred from the datasource block.
 *
 * `import "server-only"` is load-bearing, not decorative: it makes any
 * import of this module from a Client Component a *build* error rather
 * than a runtime one. Without it, a stray import in a "use client" file
 * would try to bundle the database credentials into browser JavaScript.
 */

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    // Fail loudly at first use rather than letting every query fail with an
    // opaque adapter error. An unset DATABASE_URL is always a configuration
    // mistake, never a state the application should try to degrade through.
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in, " +
        "or configure it as a Codespaces/Vercel environment variable."
    )
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    // Query logging is dev-only on purpose. Prisma's `query` events include
    // bound parameter values, which for this schema means customer phone
    // numbers, emails and payment references would land in production logs
    // (SECURITY.MD §38: sensitive data must not be logged).
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  })
}

/**
 * In development, Next.js hot-reloads server modules on every edit. Without
 * this global cache each reload would construct another client and open
 * another pool, and Supabase would start refusing connections after a few
 * minutes of editing. Production gets a single fresh instance per runtime.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
