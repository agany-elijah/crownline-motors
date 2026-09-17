import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { AdminSurface } from "@/components/admin/admin-surface"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { cn } from "@/lib/utils"

/**
 * The dashboard's own families: Geist for the interface, Geist Mono for the
 * references an operator matches character by character — order, quote and
 * tracking numbers.
 *
 * Loaded here rather than in the root layout, so the public site — where most
 * visitors arrive on a phone over mobile data — never downloads them. The
 * tokens that put them to use are under "Admin console" in globals.css.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

const FONT_CLASSES = cn(geistSans.variable, geistMono.variable)

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

/**
 * `data-admin` switches every staff screen — signed in or not — onto the
 * dashboard's tokens. `contents` keeps the wrapper out of layout, so pages lay
 * out exactly as if it were not there; custom properties still inherit
 * through it.
 */
export default function AdminLayout({ children }: LayoutProps<"/Ricky@2000">) {
  return (
    <div data-admin="" className={cn(FONT_CLASSES, "contents font-sans")}>
      <AdminSurface fontClassName={FONT_CLASSES} />
      {children}
    </div>
  )
}
