import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

/**
 * Where an administrator lands after authenticating, and how that
 * destination is decided.
 *
 * A separate module from admin-guard.ts on purpose. These are pure string
 * functions with no session, no database and no Next.js import, so they
 * carry no `server-only` marker and can be exercised directly by the unit
 * suite. Given the whole point of `isSafeReturnPath` is to close an open
 * redirect, being able to test it exhaustively matters more than keeping it
 * beside its caller.
 *
 * Every path here is derived from ADMIN_BASE_PATH rather than spelled out,
 * so relocating the dashboard cannot leave the login redirect pointing at an
 * address that no longer exists — or, worse, leave `isSafeReturnPath`
 * accepting the old prefix after the routes have moved.
 */

export const ADMIN_LOGIN_PATH = `${ADMIN_BASE_PATH}/login`
/** Where a password-authenticated session gives its authenticator code. Under /login, so the proxy treats it as a sign-in screen. */
export const ADMIN_TWO_FACTOR_CHALLENGE_PATH = `${ADMIN_BASE_PATH}/login/two-factor`
export const ADMIN_FORBIDDEN_PATH = `${ADMIN_BASE_PATH}/forbidden`
export const ADMIN_HOME_PATH = ADMIN_BASE_PATH

/**
 * Is this a destination we are willing to send an authenticated session to?
 *
 * The value arrives from a query string — on the login URL, and on the link
 * inside an authentication email — so it is attacker-controlled in exactly
 * the situation where the redirect happens to be carrying a freshly minted
 * session. An unchecked value here is an open redirect, which is the
 * standard way a phishing page gets to sit behind a legitimate domain.
 *
 * Three conditions, each closing something specific:
 *
 *   - Must start with "/". Rejects `https://evil.example` outright.
 *   - Must not start with "//" or "/\". Browsers read both as
 *     protocol-relative URLs, so `//evil.example` navigates off-site
 *     despite passing a naive "starts with a slash" check. This is the
 *     bypass that catches most hand-rolled versions of this function.
 *   - Must be inside the dashboard. A successful staff sign-in has no
 *     business landing anywhere else, and narrowing the allowed set is
 *     stronger than trying to enumerate what to forbid. Compared on a
 *     segment boundary, so "/Ricky@2000-portal" is rejected the way
 *     "/administrator-portal" was under the old prefix.
 */
export function isSafeReturnPath(value: string): boolean {
  if (!value.startsWith("/")) return false
  if (value.startsWith("//") || value.startsWith("/\\")) return false

  return value === ADMIN_HOME_PATH || value.startsWith(`${ADMIN_HOME_PATH}/`)
}

/** Builds the login URL, carrying a safe return path when there is one. */
export function loginPathWithReturn(returnTo?: string): string {
  if (!returnTo || !isSafeReturnPath(returnTo)) {
    return ADMIN_LOGIN_PATH
  }

  return `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(returnTo)}`
}

/** Resolves a requested destination to one that is safe to redirect to. */
export function resolveReturnPath(returnTo: string | undefined): string {
  return returnTo && isSafeReturnPath(returnTo) ? returnTo : ADMIN_HOME_PATH
}
