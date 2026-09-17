import type { Metadata } from "next"

import { getPublicSiteSettings } from "@/lib/queries/settings.queries"

/**
 * Layout for the whole administrator area.
 *
 * Note what is deliberately NOT here: an authorisation check.
 *
 * In the App Router a layout cannot act as a gate. Next.js states it
 * plainly — "a layout also does not control whether the rest of the route
 * renders". Partial Rendering makes it worse still: layouts do not re-render
 * on client-side navigation, so a check placed here would not run again when
 * an admin moves between pages.
 *
 * So each page calls `requireAdmin()` (or `requirePermission()`) itself, and
 * each server action calls the matching `authorize*`. The DAL's `cache()`
 * keeps the repetition free at runtime.
 *
 * What this layout does contribute is metadata inherited by every admin page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { businessName } = await getPublicSiteSettings()

  return {
    title: {
      default: "Admin",
      template: `%s | ${businessName} Admin`,
    },
    // The only thing keeping these pages out of a search index: robots.txt
    // deliberately does not name the admin path, because publishing an
    // unguessable URL in a file served at /robots.txt hands it to exactly the
    // scanners the rename was meant to shake off (see src/app/robots.ts).
    //
    // Neither this nor robots.txt was ever an access control — SECURITY.MD
    // §46. The DAL does the work.
    robots: { index: false, follow: false },
  }
}

/**
 * Admin responses depend on who is asking and must never be reused between
 * callers (SECURITY.MD §47). Set on the layout so it applies to the whole
 * segment rather than being re-declared, and forgotten, on each new page.
 */
export const dynamic = "force-dynamic"

export default function AdminLayout({ children }: LayoutProps<"/Ricky@2000">) {
  return <>{children}</>
}
