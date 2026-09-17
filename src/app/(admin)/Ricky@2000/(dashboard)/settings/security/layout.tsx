import { SecuritySubNav } from "@/components/admin/settings/settings-nav"
import { requireAdmin } from "@/lib/auth/admin-guard"
import { settingsNavLinks, SECURITY_SETTINGS_PATH } from "@/lib/constants/settings-nav"

/**
 * Admin users & security. On a phone the settings rail — and the nested list
 * of security pages inside it — is not shown, so the pages get their own row
 * of tabs here. Each page enforces its own access.
 */
export default async function SecuritySettingsLayout({ children }: LayoutProps<"/Ricky@2000/settings/security">) {
  await requireAdmin({ allowTwoFactorSetup: true })
  const children_ = settingsNavLinks.find((link) => link.href === SECURITY_SETTINGS_PATH)?.children ?? []

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <SecuritySubNav links={children_} />
      {children}
    </div>
  )
}
