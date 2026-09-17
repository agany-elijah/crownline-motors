import type React from "react"
import Link from "next/link"

import { BrandMark } from "@/components/layout/brand-mark"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { cn } from "@/lib/utils"

interface AdminAuthShellProps {
  title: string
  children: React.ReactNode
  /** Optional secondary action rendered beneath the card. */
  footer?: React.ReactNode
  className?: string
}

/**
 * The frame shared by every unauthenticated admin screen — sign in, forgot
 * password, set a new password, the two-factor code.
 *
 * Deliberately dark, and dark through the dashboard's own dark tokens rather
 * than hand-painted surfaces: the `dark` class on the frame switches every
 * input, alert and button inside it to the dark palette, so a field is a dark
 * field and not a white box on black. The public site is 65% warm white; the
 * staff entrance is the deep end of the palette, so an administrator can tell
 * at a glance which side of the business they are on, and a phishing page
 * built by copying the public site's chrome does not automatically look like
 * this one.
 *
 * From `lg` the screen splits: the brand and what this place is on the left,
 * the form on the right. Below that it is the form alone, under the mark —
 * a phone has no room for anything that is not the task.
 *
 * `data-tone="dark"` is the project's existing mechanism (globals.css) for
 * re-pointing --gold-ink at the fill gold on dark surfaces.
 */
export async function AdminAuthShell({
  title,
  children,
  footer,
  className,
}: AdminAuthShellProps) {
  const { businessName } = await getPublicSiteSettings()

  return (
    <main
      data-tone="dark"
      className="dark grid min-h-dvh bg-background text-foreground lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
    >
      {/* ── The brand side, from lg ───────────────────────────────── */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-rail p-12 lg:flex xl:p-16"
      >
        {/* A fine grid, faded out towards the bottom: structure, not
            decoration — the same hairline language as the dashboard. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.035)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.035)_1px,transparent_1px)] bg-size-[3.5rem_3.5rem] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

        <div className="relative">
          <BrandMark size="lg" tone="dark" />
        </div>

        <div className="relative flex max-w-md flex-col gap-5">
          <span aria-hidden="true" className="h-px w-12 bg-gold" />
          <p className="text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-rail-foreground">
            The {businessName} staff dashboard.
          </p>
          <p className="text-body text-rail-muted">
            Inventory, quotes, orders, payments and tracking — in one place, for the team.
          </p>
        </div>

        <p className="relative text-small text-rail-subtle">Authorised staff only. Sign-in activity is recorded.</p>
      </aside>

      {/* ── The form ──────────────────────────────────────────────── */}
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className={cn("flex w-full max-w-sm flex-col", className)}>
          <div className="mb-8 flex flex-col gap-6">
            <Link
              href="/"
              className="w-fit rounded-sm transition-opacity duration-fast hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold lg:hidden"
            >
              <BrandMark size="default" tone="dark" />
              <span className="sr-only">Return to the {businessName} website</span>
            </Link>

            <div className="flex flex-col gap-2">
              <span className="text-small font-medium text-gold">Staff access</span>
              <h1 className="text-h2 text-foreground">{title}</h1>
            </div>
          </div>

          {children}

          {footer ? (
            <div className="mt-8 border-t border-border pt-6 text-small text-muted-foreground">{footer}</div>
          ) : null}
        </div>
      </div>
    </main>
  )
}
