"use server"

import { authorizePermission } from "@/lib/auth/admin-guard"
import { writeSettingsSection, type SettingsFormState } from "@/lib/settings/write-settings-section"
import { securityControlsSchema } from "@/lib/validations/security.schema"

/**
 * The dealership-wide security controls: require 2FA, allow password
 * recovery, session timeout.
 *
 * `admin:manage`, not `settings:write`: these decide who can reach the
 * dashboard at all, which is the first thing to take away from a day-to-day
 * role when a second person joins (see permissions.ts).
 *
 * Every change takes effect on the next request of every administrator — the
 * DAL reads these through the same tagged cache this save expires.
 */
export async function updateSecurityControlsAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const parsed = securityControlsSchema.safeParse({
    requireTwoFactor: formData.get("requireTwoFactor"),
    allowPasswordRecovery: formData.get("allowPasswordRecovery"),
    sessionTimeoutHours: formData.get("sessionTimeoutHours"),
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const auth = await authorizePermission("admin:manage")
  if (!auth.ok) return { status: "error", message: auth.message }

  /**
   * An administrator who requires 2FA without having it would be sent to the
   * setup page on their very next click — locked out of the dashboard by
   * their own save. Refused here rather than trusting the form's warning.
   */
  if (parsed.data.requireTwoFactor && !auth.admin.twoFactorEnabled) {
    const message = "Turn on two-factor authentication for your own account before requiring it for everyone."
    return { status: "error", message, fieldErrors: { requireTwoFactor: [message] } }
  }

  return writeSettingsSection({
    actorId: auth.admin.id,
    action: "SETTINGS_SECURITY_UPDATED",
    data: parsed.data,
    compare: parsed.data,
  })
}
