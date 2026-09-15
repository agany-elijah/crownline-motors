import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Car, FileText, Package, Users, Wrench, type LucideIcon } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { requireAdmin } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { getNewQuoteLeadCount } from "@/lib/queries/quote.queries"

export const metadata: Metadata = {
  title: "Dashboard",
}

interface DashboardSection {
  label: string
  icon: LucideIcon
  href: string
}

const SECTIONS: DashboardSection[] = [
  { label: "Quotes", icon: FileText, href: `${ADMIN_BASE_PATH}/quotes` },
  { label: "Orders", icon: Package, href: `${ADMIN_BASE_PATH}/orders` },
  { label: "Customers", icon: Users, href: `${ADMIN_BASE_PATH}/customers` },
  { label: "Vehicles", icon: Car, href: `${ADMIN_BASE_PATH}/vehicles` },
  { label: "Spare Parts", icon: Wrench, href: `${ADMIN_BASE_PATH}/spare-parts` },
]

export default async function AdminDashboardPage() {
  // Runs even though the layout also calls it — a layout cannot gate a route.
  const admin = await requireAdmin()
  const newQuotes = await getNewQuoteLeadCount()

  const firstName = admin.displayName.split(" ")[0]

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={`Welcome back, ${firstName}`}
        actions={
          <Link
            href={`${ADMIN_BASE_PATH}/settings`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-small font-semibold shadow-[var(--shadow-subtle)] transition-all duration-fast hover:-translate-y-0.5 hover:border-gold-ink/45 hover:text-gold-ink hover:shadow-[var(--shadow-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Business settings
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {SECTIONS.map((section) => {
          const Icon = section.icon
          const badge = section.label === "Quotes" && newQuotes > 0 ? `${newQuotes} new` : null

          return (
            <Link
              key={section.label}
              href={section.href}
              className="group/tile flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-subtle)] transition-all duration-fast hover:-translate-y-0.5 hover:border-gold-ink/40 hover:shadow-[var(--shadow-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors duration-fast group-hover/tile:bg-accent group-hover/tile:text-gold-ink">
                  <Icon aria-hidden="true" className="size-4.5" />
                </span>
                <span className="font-heading text-body font-semibold">{section.label}</span>
              </span>
              {badge ? (
                <span className="rounded-4xl border border-warning/35 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                  {badge}
                </span>
              ) : (
                <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform duration-fast group-hover/tile:translate-x-0.5" />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
