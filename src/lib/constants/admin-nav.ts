import { ADMIN_BASE_PATH, adminPath } from "@/lib/constants/admin-routes"
import type { AdminPermission } from "@/lib/auth/permissions"

/**
 * The administrator dashboard's navigation.
 *
 * Each entry names the permission required to *see* it. That is a UX
 * convenience and nothing more: hiding a link has never protected a route,
 * and SECURITY.MD §6.2 is explicit that a hidden button is not a control.
 * The actual gate is `requirePermission()` inside each page, which runs
 * whether the visitor arrived by clicking the link or by typing the URL.
 *
 * Declaring the permission here anyway is what keeps the two consistent.
 * When a restricted role is introduced, the sidebar stops offering pages
 * that would immediately bounce the user to the forbidden page — which is a
 * frustrating way to discover you lack access.
 *
 * `available: false` marks a section whose route exists but whose feature
 * has not been built yet, mirroring the pattern already used for the public
 * navigation (see lib/constants/nav-links.ts). Those entries render as
 * non-interactive text with a "Soon" marker rather than linking to a page
 * that would confuse an operator with an empty screen.
 */

export interface AdminNavLink {
  label: string
  href: string
  /** Permission required to see this entry. Not what protects the route. */
  permission: AdminPermission
  /** Lucide icon name, resolved by the sidebar. */
  icon: AdminNavIcon
  /** False while the section is routed but not yet built. */
  available?: boolean
}

export type AdminNavIcon =
  | "dashboard"
  | "vehicles"
  | "spareParts"
  | "quotes"
  | "orders"
  | "payments"
  | "customers"
  | "tracking"
  | "settings"

export interface AdminNavGroup {
  /** Null for the first group, which needs no heading above it. */
  title: string | null
  links: AdminNavLink[]
}

/**
 * Grouped to match how the business actually works rather than how the
 * database is shaped: what we sell, who we sell it to and what they owe,
 * where their vehicle is, and finally configuration. An operator working a
 * customer enquiry moves top to bottom through that order.
 */
export const adminNavGroups: AdminNavGroup[] = [
  {
    title: null,
    links: [
      {
        label: "Dashboard",
        href: ADMIN_BASE_PATH,
        permission: "vehicle:read",
        icon: "dashboard",
      },
    ],
  },
  {
    title: "Inventory",
    links: [
      {
        label: "Vehicles",
        href: adminPath("/vehicles"),
        permission: "vehicle:read",
        icon: "vehicles",
      },
      {
        /**
         * Wave B. Listed now for the same reason the public navigation
         * lists it: the section is planned, and showing it tells an
         * operator the platform is going there rather than leaving them to
         * wonder. It has no route yet, which is safe precisely because
         * `available: false` renders it as inert text — there is no link to
         * follow into a 404.
         */
        label: "Spare Parts",
        href: adminPath("/spare-parts"),
        permission: "sparePart:read",
        icon: "spareParts",
        available: false,
      },
    ],
  },
  {
    title: "Commerce",
    links: [
      {
        label: "Quotes",
        href: adminPath("/quotes"),
        permission: "quote:read",
        icon: "quotes",
        available: false,
      },
      {
        label: "Orders",
        href: adminPath("/orders"),
        permission: "order:read",
        icon: "orders",
        available: false,
      },
      {
        label: "Payments",
        href: adminPath("/payments"),
        permission: "payment:read",
        icon: "payments",
        available: false,
      },
      {
        label: "Customers",
        href: adminPath("/customers"),
        permission: "customer:read",
        icon: "customers",
        available: false,
      },
    ],
  },
  {
    title: "Logistics",
    links: [
      {
        label: "Tracking",
        href: adminPath("/tracking"),
        permission: "tracking:read",
        icon: "tracking",
        available: false,
      },
    ],
  },
  {
    title: "Configuration",
    links: [
      {
        label: "Settings",
        href: adminPath("/settings"),
        permission: "settings:read",
        icon: "settings",
      },
    ],
  },
]

/** True unless an entry has been explicitly marked unavailable. */
export function isAdminNavLinkAvailable(link: AdminNavLink): boolean {
  return link.available !== false
}

/**
 * Is `pathname` inside this nav entry's section?
 *
 * Compared on segment boundaries, so `<base>/vehicles/new` marks "Vehicles"
 * active while `<base>/vehicles-archive` would not. The dashboard is matched
 * exactly, since every admin path would otherwise be "inside" it.
 */
export function isAdminNavLinkActive(href: string, pathname: string): boolean {
  if (href === ADMIN_BASE_PATH) {
    return pathname === ADMIN_BASE_PATH
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}
