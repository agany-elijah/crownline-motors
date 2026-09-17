import Link from "next/link"
import { cookies } from "next/headers"

import { AdminNav } from "@/components/admin/admin-nav"
import { AdminThemeProvider } from "@/components/admin/admin-theme-provider"
import { AdminTopBar } from "@/components/admin/admin-top-bar"
import { QuoteLeadWatcher } from "@/components/admin/quote-lead-watcher"
import { BrandMark } from "@/components/layout/brand-mark"
import { requireAdmin } from "@/lib/auth/admin-guard"
import { can } from "@/lib/auth/permissions"
import { adminNavGroups } from "@/lib/constants/admin-nav"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { ADMIN_THEME_COOKIE, parseAdminTheme } from "@/lib/constants/admin-theme"
import { getOperationalSettings, getPublicSiteSettings } from "@/lib/queries/settings.queries"

/**
 * Chrome for the authenticated dashboard.
 *
 * Applies to everything under this route group and — importantly — to
 * nothing in `(auth)`. That is why the sign-in, forgot-password and
 * set-password screens live in a sibling group: they must not inherit a
 * sidebar that offers navigation to someone who has not signed in.
 *
 * ── On the requireAdmin() call below ──────────────────────────────────
 * It is here to *fetch* the profile the bar renders, not to protect the
 * routes beneath it. A layout cannot do that: Next.js states plainly that
 * "a layout also does not control whether the rest of the route renders",
 * and Partial Rendering means it does not even re-run on client-side
 * navigation between admin pages.
 *
 * Every page under this layout therefore calls `requireAdmin()` or
 * `requirePermission()` itself. That looks redundant and is not. The DAL's
 * `cache()` makes the repetition free within a request.
 */
export default async function AdminDashboardLayout({
  children,
}: LayoutProps<"/Ricky@2000">) {
  // `allowTwoFactorSetup`: an administrator made to set up 2FA still needs
  // the chrome around the setup page. Every page stays strict on its own.
  const admin = await requireAdmin({ allowTwoFactorSetup: true })
  const [cookieStore, operational, site] = await Promise.all([
    cookies(),
    getOperationalSettings(),
    getPublicSiteSettings(),
  ])

  // This device's choice, else the default from Settings → Website & branding.
  const theme =
    parseAdminTheme(cookieStore.get(ADMIN_THEME_COOKIE)?.value) ??
    (operational.defaultDashboardTheme === "DARK" ? "dark" : "light")

  /**
   * Hide navigation the current role cannot use.
   *
   * Presentation only — SECURITY.MD §6.2 is explicit that hiding a link is
   * not an access control, and each destination re-checks on arrival.
   * Groups left with no visible links are dropped.
   */
  const navGroups = adminNavGroups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => can(admin.role, link.permission)),
    }))
    .filter((group) => group.links.length > 0)

  // Settings → Notifications: the new-quote alert, through the dashboard channel.
  const showLeadAlerts =
    can(admin.role, "quote:read") &&
    operational.notifications.notifyAdminsOfNewQuotes &&
    operational.notifications.dashboardNotificationsEnabled

  return (
    <AdminThemeProvider initialTheme={theme}>
      <div className="flex min-h-dvh bg-secondary/40">
        {/*
          Fixed rail from lg up. Below that it is absent from the layout
          entirely and the same navigation is reachable through the drawer in
          the top bar — rather than being rendered and hidden, which would put
          every link in the tab order of a phone user who cannot see them.
        */}
        <aside
          data-tone="dark"
          className="hidden w-64 shrink-0 flex-col bg-foreground text-background lg:sticky lg:top-0 lg:flex lg:h-dvh"
        >
          <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-5">
            <Link
              href={ADMIN_BASE_PATH}
              className="rounded-sm transition-opacity duration-fast hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              <BrandMark size="sm" tone="dark" />
              <span className="sr-only">{site.businessName} dashboard home</span>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-5">
            <AdminNav groups={navGroups} />
          </div>

          <div className="shrink-0 border-t border-white/10 px-5 py-4">
            <p className="font-heading text-[0.5625rem] font-semibold tracking-[0.28em] text-background/60 uppercase">
              Staff Dashboard
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopBar admin={admin} navGroups={navGroups} />
          <main className="flex-1 px-4 pt-5 pb-8 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
        </div>

        {showLeadAlerts ? <QuoteLeadWatcher /> : null}
      </div>
    </AdminThemeProvider>
  )
}
