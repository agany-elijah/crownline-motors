import { SettingsNav } from "@/components/admin/settings/settings-nav"
import { SettingsSearch } from "@/components/admin/settings/settings-search"
import { requireAdmin } from "@/lib/auth/admin-guard"
import { can } from "@/lib/auth/permissions"
import { settingsNavLinks } from "@/lib/constants/settings-nav"
import { SETTINGS_SEARCH_ENTRIES } from "@/lib/settings/settings-search"

/**
 * The frame around every Settings page: the title with search beside it, the
 * section list, and the content.
 *
 * Like the dashboard layout above it, this fetches the profile to decide
 * which sections to *list* and search — it is not what protects them. Every
 * page under it calls `requirePermission` itself, and every action
 * authorises again.
 *
 * ── Why the grid tracks are `minmax(0, …)` ────────────────────────────
 * A grid track sized `auto` grows to its widest child's content. The phone
 * section row scrolls horizontally, so its content is as wide as every tab
 * laid end to end — and an `auto` track took that width, stretching the whole
 * page to ~1,400px on a phone. `minmax(0, 1fr)` pins the track to the
 * viewport and leaves the row to scroll inside it.
 */
export default async function SettingsLayout({ children }: LayoutProps<"/Ricky@2000/settings">) {
  // Allowed while 2FA setup is pending, so the setup page can render; each
  // page under this layout enforces its own access.
  const admin = await requireAdmin({ allowTwoFactorSetup: true })
  const links = settingsNavLinks.filter((link) => can(admin.role, link.permission))
  const entries = SETTINGS_SEARCH_ENTRIES.filter((entry) => can(admin.role, entry.permission)).map(
    // The permission is a server concern; the browser needs only where to go.
    ({ permission: _permission, ...entry }) => entry
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 lg:gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-h3 font-semibold tracking-tight sm:text-h2">Settings</h1>
        <SettingsSearch entries={entries} />
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        <SettingsNav links={links} />
        <div className="flex max-w-3xl min-w-0 flex-col gap-6">{children}</div>
      </div>
    </div>
  )
}
