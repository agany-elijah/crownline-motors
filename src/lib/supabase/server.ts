import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options"

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Uses the PUBLISHABLE key, not the secret one: this client acts strictly as
 * the signed-in user, so every request it makes carries that user's identity
 * rather than project-wide privileges. Privilege comes from the session in
 * the cookie jar, never from the key.
 *
 * Must be called per request — never hoisted into a module-level constant.
 * `cookies()` is request-scoped, so a shared instance would leak one
 * visitor's session into another's request.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set."
    )
  }

  const cookieStore = await cookies()

  return createServerClient(url, publishableKey, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server Components cannot set cookies. This is expected and safe
          // to swallow *only* because the proxy (proxy.ts) refreshes the
          // session on every request and writes the rotated cookies there.
          // Remove that refresh and this catch starts silently dropping
          // token rotation instead.
        }
      },
    },
  })
}
