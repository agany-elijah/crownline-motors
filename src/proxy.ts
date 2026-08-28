import { type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

/**
 * Next.js Proxy (called Middleware before Next.js 16).
 *
 * Its whole job is delegated to `updateSession` — see that file for what it
 * does and, more importantly, for why the redirect it performs is a
 * convenience rather than the thing protecting the admin area.
 *
 * ⚠️ This file must live at `src/proxy.ts`, not the repository root.
 * Next.js looks for it "in the project root, or inside `src` if applicable,
 * so that it is located at the same level as `pages` or `app`". This project
 * keeps `app` under `src/`, so a root-level proxy.ts is silently ignored —
 * it still type-checks, still gets bundled, and never runs. Do not move it.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  /**
   * Runs on everything except static assets.
   *
   * Next's own authentication guidance recommends that auth-related proxy
   * logic run on all routes rather than only the protected ones: the session
   * refresh has to happen wherever a signed-in user might be, and a matcher
   * narrowed to /admin would mean tokens silently expiring while an
   * administrator reads the public site in another tab.
   *
   * The excluded extensions are files served straight from disk, which carry
   * no session and gain nothing from a refresh attempt.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
}
