import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Supabase client authenticated with the project's SECRET key.
 *
 * ⚠️ This client bypasses every access control Supabase offers. It can read
 * and write any row, mint sessions, and create or delete users. Treat it the
 * way you would treat a root database shell.
 *
 * Rules for using it:
 *
 *   1. Server-side only. `import "server-only"` above turns any import from
 *      a Client Component into a build error, which is the only reliable
 *      guard — SUPABASE_SECRET_KEY has no NEXT_PUBLIC_ prefix, so it would
 *      otherwise silently resolve to `undefined` in the browser and fail in
 *      a confusing way instead of an obvious one.
 *
 *   2. Never for user provisioning over HTTP. Creating administrators is a
 *      terminal operation — scripts/create-admin.ts — because an endpoint
 *      that mints staff accounts would reopen the self-signup hole that is
 *      deliberately disabled in the Supabase dashboard. That script builds
 *      its own client rather than importing this one, precisely because the
 *      `server-only` guard above (correctly) makes this module unimportable
 *      outside a React Server Component environment.
 *
 *      As a result this function currently has no callers. It is kept
 *      because Stage 9 needs it: issuing time-limited signed URLs for
 *      private Supabase Storage objects — payment receipts above all —
 *      requires the secret key and cannot be done with a user session.
 *
 *   3. Never for ordinary data access. Application reads and writes go
 *      through Prisma (src/lib/prisma.ts) and are authorised by the DAL in
 *      src/lib/auth/dal.ts. Reaching for this client to "make a query work"
 *      is the exact failure SECURITY.MD §70 rule 7 prohibits.
 *
 * Sessions are disabled below because this client never represents a user:
 * persisting or refreshing a session here would attach the secret key's
 * privileges to whatever storage the runtime happens to provide.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !secretKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must both be set to use the " +
        "Supabase admin client. SUPABASE_SECRET_KEY must never be given a NEXT_PUBLIC_ prefix."
    )
  }

  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
