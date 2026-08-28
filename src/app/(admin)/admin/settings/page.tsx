import type { Metadata } from "next"

import { requirePermission } from "@/lib/auth/admin-guard"

export const metadata: Metadata = {
  title: "Settings",
}

/**
 * Placeholder for the Settings screen — the UI arrives with its own phase.
 *
 * The guard is here from the start rather than being added alongside the
 * content later. Retrofitting authorisation onto pages that already work is
 * how a route gets missed, and the missed one is never noticed until it
 * matters.
 */
export default async function AdminSettingsPage() {
  await requirePermission("settings:read")

  return <main />
}
