import { adminPath } from "@/lib/constants/admin-routes"
import type { AdminPermission } from "@/lib/auth/permissions"

/**
 * The Settings sections, in the order the dashboard lists them: core identity,
 * then the website, business rules, operations, presentation, communication,
 * discoverability and finally security.
 *
 * Data only, so the server layout can filter by permission and the client nav
 * can mark the active entry from the same list. Like the main sidebar, the
 * permission here decides what is *shown*; every page and action re-checks.
 */

export type SettingsNavIcon =
  | "business"
  | "branding"
  | "commerce"
  | "tracking"
  | "catalog"
  | "notifications"
  | "seo"
  | "security"

export interface SettingsNavLink {
  label: string
  href: string
  icon: SettingsNavIcon
  permission: AdminPermission
  /** Nested pages, rendered under this entry when it is active. */
  children?: { label: string; href: string }[]
}

export const SETTINGS_BASE_PATH = adminPath("/settings")
export const SECURITY_SETTINGS_PATH = adminPath("/settings/security")
export const TWO_FACTOR_SETTINGS_PATH = adminPath("/settings/security/two-factor")
export const SESSION_SETTINGS_PATH = adminPath("/settings/security/sessions")
export const PASSWORD_SETTINGS_PATH = adminPath("/settings/security/password")
export const SECURITY_ACTIVITY_PATH = adminPath("/settings/security/activity")

export const settingsNavLinks: SettingsNavLink[] = [
  { label: "Business information", href: SETTINGS_BASE_PATH, icon: "business", permission: "settings:read" },
  { label: "Website & branding", href: adminPath("/settings/branding"), icon: "branding", permission: "settings:read" },
  { label: "Commerce & payments", href: adminPath("/settings/commerce"), icon: "commerce", permission: "settings:read" },
  { label: "Orders & tracking", href: adminPath("/settings/orders-tracking"), icon: "tracking", permission: "settings:read" },
  { label: "Catalogue display", href: adminPath("/settings/catalog-display"), icon: "catalog", permission: "settings:read" },
  { label: "Notifications", href: adminPath("/settings/notifications"), icon: "notifications", permission: "settings:read" },
  { label: "SEO & social", href: adminPath("/settings/seo"), icon: "seo", permission: "settings:read" },
  {
    label: "Admin users & security",
    href: SECURITY_SETTINGS_PATH,
    icon: "security",
    // Every administrator manages their own account, so the section is
    // visible to all of them; the security-wide controls inside it check
    // `admin:manage` separately.
    permission: "admin:read",
    children: [
      { label: "Administrator account", href: SECURITY_SETTINGS_PATH },
      { label: "Two-factor authentication", href: TWO_FACTOR_SETTINGS_PATH },
      { label: "Login & session security", href: SESSION_SETTINGS_PATH },
      { label: "Password & recovery", href: PASSWORD_SETTINGS_PATH },
      { label: "Security activity", href: SECURITY_ACTIVITY_PATH },
    ],
  },
]

/**
 * Is `pathname` this entry's page (or, for an entry with children, inside it)?
 *
 * The first entry is the settings root, so it matches exactly — otherwise
 * every settings page would light it up.
 */
export function isSettingsLinkActive(link: Pick<SettingsNavLink, "href" | "children">, pathname: string): boolean {
  if (link.href === SETTINGS_BASE_PATH) return pathname === SETTINGS_BASE_PATH
  if (link.children) return pathname === link.href || pathname.startsWith(`${link.href}/`)
  return pathname === link.href
}
