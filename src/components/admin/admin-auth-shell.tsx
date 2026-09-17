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
 * password, set a new password.
 *
 * Deliberately dark. The public site is 65% warm white; the staff entrance
 * is the deep black end of the palette, so an administrator can tell at a
 * glance which side of the business they are on, and so a phishing page
 * built by copying the public site's chrome does not automatically look
 * like this one.
 *
 * `data-tone="dark"` is the project's existing mechanism (globals.css) for
 * re-pointing --gold-ink at the fill gold on dark surfaces, so the wordmark
 * and any outline buttons resolve correctly without per-placement classes.
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
      className="relative flex min-h-dvh flex-col items-center justify-center bg-foreground px-4 py-12 text-background"
    >
      {/* Soft gold bloom behind the card — the brief's "subtle radial
          lighting" for high-priority surfaces. Decorative only, and kept
          out of the accessibility tree. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute top-1/2 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/8 blur-3xl" />
      </div>

      <div className={cn("relative w-full max-w-md", className)}>
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Link
            href="/"
            className="rounded-sm transition-opacity duration-fast hover:opacity-80"
          >
            <BrandMark size="lg" tone="dark" />
            <span className="sr-only">Return to the {businessName} website</span>
          </Link>
          <p className="font-heading text-[0.6875rem] font-semibold tracking-[0.34em] text-gold-ink uppercase">
            Staff Access
          </p>
        </div>

        <div className="rounded-xl border border-background/12 bg-background/[0.04] p-6 shadow-[var(--shadow-raised)] backdrop-blur-sm sm:p-8">
          <h1 className="mb-6 font-heading text-h3 font-semibold">{title}</h1>

          {children}
        </div>

        {footer ? (
          <div className="mt-6 text-center text-small text-background/60">{footer}</div>
        ) : null}
      </div>
    </main>
  )
}
