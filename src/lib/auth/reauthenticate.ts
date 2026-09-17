import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Confirms an administrator's current password before a sensitive change —
 * a new email address, a new password (SECURITY.MD §42).
 *
 * ── Why a throwaway client ────────────────────────────────────────────
 * The obvious call, `signInWithPassword` on the request's own client, would
 * replace the browser's session cookies with a brand-new session: the
 * administrator's session list would grow a row every time they changed a
 * setting, and a two-factor session would silently drop back to AAL1. This
 * client keeps nothing — no cookies, no storage — and the session it opens
 * to prove the password is signed out again at once.
 */
export async function verifyAdminPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.")
  }

  const client = createSupabaseClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error || !data.session) return false

  const { error: signOutError } = await client.auth.signOut({ scope: "local" })
  if (signOutError) {
    // The proof succeeded; the throwaway session simply expires on its own.
    console.error("[auth] could not end the password-confirmation session", signOutError.code)
  }

  return true
}
