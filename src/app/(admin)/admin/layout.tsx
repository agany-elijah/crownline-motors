import type { Metadata } from "next"

/**
 * Layout for the whole administrator area.
 *
 * Note what is deliberately NOT here: an authorisation check.
 *
 * In the App Router a layout cannot act as a gate. Next.js states it
 * plainly — "a layout also does not control whether the rest of the route
 * renders. Route segments and parallel route slots are rendered by the
 * router, so a layout that hides or swaps them does not stop them from
 * running or from appearing in the RSC Payload". Partial Rendering makes it
 * worse still: layouts do not re-render on client-side navigation, so a
 * check placed here would not run again when an admin moves between pages.
 *
 * So each page calls `requireAdmin()` (or `requirePermission()`) itself, and
 * each server action calls the matching `authorize*`. That is more call
 * sites than a single layout check, and it is the only arrangement that
 * actually holds. The DAL's `cache()` keeps the repetition free at runtime.
 *
 * The chrome that this layout will eventually carry — sidebar, top bar,
 * account menu — belongs to Stage 7 (admin dashboard shell) and is not
 * built here. When it arrives, the authenticated pages should move under a
 * nested `(dashboard)` route group so the sign-in screens do not inherit it.
 *
 * What this layout does contribute is one thing worth having early: metadata
 * inherited by every admin page.
 */
export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s | Crownline Motors Admin",
  },
  // Applies to every page beneath /admin. robots.txt (src/app/robots.ts)
  // disallows the same paths. Neither is an access control — SECURITY.MD §46
  // is explicit that robots.txt is not an authorisation mechanism — they
  // simply keep staff pages out of search results. The DAL does the work.
  robots: { index: false, follow: false },
}

/**
 * Admin responses depend on who is asking and must never be reused between
 * callers (SECURITY.MD §47). Set on the layout so it applies to the whole
 * segment rather than being re-declared, and forgotten, on each new page.
 */
export const dynamic = "force-dynamic"

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <>{children}</>
}
