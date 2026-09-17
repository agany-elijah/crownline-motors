import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

/**
 * The dashboard's light/dark preference.
 *
 * ── Why a cookie, and not the database or localStorage ────────────────
 * The server has to know the theme *before* it renders, or every page load
 * paints light and then flips — the flash that makes a dark mode feel cheap.
 * localStorage is invisible to the server. A column on AdminProfile would
 * work but would make an appearance preference follow the person onto every
 * device, when a dark dashboard at night on a laptop and a light one on a
 * phone in the sun is exactly the choice people make per device.
 *
 * It is not a credential and grants nothing, so it is readable by script
 * (the switch writes it) and scoped to the dashboard path, so public pages are
 * never sent it. An absent or unrecognised value falls back to the default in
 * Settings → Website & branding.
 */

export type AdminThemeValue = "light" | "dark"

export const ADMIN_THEME_COOKIE = "crownline-admin-theme"

export const ADMIN_THEME_COOKIE_PATH = ADMIN_BASE_PATH

/** One year. */
export const ADMIN_THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function parseAdminTheme(value: string | undefined | null): AdminThemeValue | null {
  return value === "light" || value === "dark" ? value : null
}
