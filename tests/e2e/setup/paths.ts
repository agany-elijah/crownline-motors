import path from "node:path"

import { adminPath } from "../../../src/lib/constants/admin-routes"

/**
 * Where the authenticated session is saved between the setup project and
 * the admin projects that consume it.
 *
 * In its own module because playwright.config.ts needs the value, and a
 * config file may not import anything that calls `test()` — Playwright
 * rejects the whole config with "did not expect test() to be called here".
 * Keeping the constant separate from the setup that produces it is what
 * lets both sides reference one path instead of repeating a string.
 *
 * Gitignored: the file it names contains a live session cookie.
 */
export const ADMIN_STORAGE_STATE = path.join(
  process.cwd(),
  "tests/e2e/.auth/admin.json"
)

/**
 * A `toHaveURL` pattern for a path inside the dashboard.
 *
 * The base path is escaped before it becomes a regular expression. It is a
 * literal to match, not a pattern to interpret, and the current value
 * contains "@" — harmless today, but a base path containing "." or "+" would
 * silently start matching URLs it should not, which is the kind of bug that
 * makes an authorisation test pass for the wrong reason.
 *
 * `exact` anchors the end, for the cases that must distinguish
 * `<base>/vehicles` from `<base>/vehicles/new`.
 */
export function adminUrlPattern(subpath = "", options?: { exact?: boolean }): RegExp {
  const escaped = adminPath(subpath).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  return new RegExp(options?.exact ? `${escaped}$` : escaped)
}
