/**
 * Where the administrator dashboard lives.
 *
 * ── Why this is not "/admin" ──────────────────────────────────────────
 * `/admin` is the first path every credential-stuffing bot and vulnerability
 * scanner on the internet tries. Moving the dashboard to an unguessable
 * segment removes the staff entrance from that automated traffic entirely,
 * which is worth having: fewer sign-in attempts to rate-limit, fewer log
 * lines to read, and no free confirmation that a Crownline admin panel
 * exists at a predictable address.
 *
 * ⚠️ This is obscurity, and obscurity is not a control. It stops noise, not
 * a person who knows the URL. What actually protects the dashboard is
 * unchanged and must stay that way: `requireAdmin()` / `requirePermission()`
 * in src/lib/auth/, applied inside every admin page and Server Action, which
 * verify the Supabase JWT *and* re-read `AdminProfile.isActive` from our own
 * database. Never weaken any of that on the grounds that the path is hard to
 * guess.
 *
 * ── Keeping the constant and the folder in step ───────────────────────
 * Next.js routes are files, so the value below has a twin that TypeScript
 * cannot check: the directory `src/app/(admin)/Ricky@2000`. Changing one
 * without the other produces a dashboard whose every internal link 404s.
 * `tests/unit/admin-routes.test.ts` asserts the two agree by reading the
 * directory listing, so the mismatch fails the unit suite rather than
 * production.
 *
 * To move the dashboard again:
 *   1. Rename `src/app/(admin)/<segment>` on disk.
 *   2. Change ADMIN_BASE_PATH below to match.
 *   3. Update the `PageProps<"...">` / `LayoutProps<"...">` route literals in
 *      the pages under that folder — they are generated from the filesystem
 *      and cannot reference a constant.
 *   4. Run `npm run typecheck`.
 *
 * ── A note on the "@" ─────────────────────────────────────────────────
 * A folder whose name *begins* with "@" is a Next.js parallel-route slot.
 * This one does not, so it is an ordinary segment. "@" is also a legal path
 * character (RFC 3986 pchar) and browsers send it unencoded, so the URL
 * works as typed. It is only the percent-encoded spelling — /Ricky%402000 —
 * that will not match; nothing in this codebase produces that form.
 */

/** The dashboard's root path. Must equal the folder name under src/app/(admin). */
export const ADMIN_BASE_PATH = "/Ricky@2000"

/**
 * Builds a path inside the dashboard.
 *
 * `adminPath()` is the root; `adminPath("/vehicles")` is a section. The
 * leading slash on the argument is required rather than inferred, so a call
 * site reads as the path it produces.
 */
export function adminPath(subpath = ""): string {
  return `${ADMIN_BASE_PATH}${subpath}`
}

/**
 * Is this request inside the dashboard?
 *
 * Compared on a segment boundary, so a hypothetical public "/Ricky@2000-news"
 * is not mistaken for the admin area — the same trap `isSafeReturnPath`
 * closes for "/administrator-portal".
 */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_BASE_PATH || pathname.startsWith(`${ADMIN_BASE_PATH}/`)
}
