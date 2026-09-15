import type { Metadata } from "next"
import type React from "react"
import Link from "next/link"
import { ArrowRight, Car, FileText, Package, Ship } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { requireAdmin } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

export const metadata: Metadata = {
  title: "Dashboard",
}

/**
 * Dashboard landing page.
 *
 * Deliberately not a wall of empty metric tiles. There is no inventory, no
 * orders and no shipments yet, so figures here would all read zero — and a
 * dashboard of zeroes teaches an operator to ignore it, which is a habit
 * that survives long after the numbers become real.
 *
 * Instead it says plainly what is ready and what is coming. The tiles below
 * become live counts as each phase lands, in the same positions, so the
 * layout an operator learns now is the one they keep.
 */

interface SectionStatus {
  label: string
  icon: typeof Car
  status: "ready" | "soon"
  href?: string
  note: string
}

const SECTIONS: SectionStatus[] = [
  {
    label: "Vehicles",
    icon: Car,
    status: "ready",
    href: `${ADMIN_BASE_PATH}/vehicles`,
    note: "Add vehicles and publish them to the website.",
  },
  {
    label: "Quotes",
    icon: FileText,
    status: "soon",
    note: "Customer enquiries arrive here, and become orders once accepted.",
  },
  {
    label: "Orders & payments",
    icon: Package,
    status: "soon",
    note: "Deposits, Mombasa and final payments against each agreed price.",
  },
  {
    label: "Tracking",
    icon: Ship,
    status: "soon",
    note: "Update a vehicle's journey; customers see it on Track My Order.",
  },
]

export default async function AdminDashboardPage() {
  // Runs even though the layout also calls it. That is not redundant — see
  // the note in (dashboard)/layout.tsx on why a layout cannot gate a route.
  const admin = await requireAdmin()

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon

          // A ready section is a link; a pending one is not. Rendering both
          // as cards that look alike but only sometimes respond is how a
          // dashboard teaches people not to trust it.
          const Wrapper = section.href
            ? ({ children }: { children: React.ReactNode }) => (
                <Link
                  href={section.href!}
                  className="group/tile flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-subtle)] transition-all duration-fast hover:-translate-y-0.5 hover:border-gold-ink/40 hover:shadow-[var(--shadow-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {children}
                </Link>
              )
            : ({ children }: { children: React.ReactNode }) => (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                  {children}
                </div>
              )

          return (
            <Wrapper key={section.label}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors duration-fast group-hover/tile:bg-accent group-hover/tile:text-gold-ink">
                  <Icon aria-hidden="true" className="size-4.5" />
                </span>
                <span
                  className={
                    section.status === "ready"
                      ? "rounded-4xl border border-success/35 bg-success/10 px-2 py-0.5 text-[0.625rem] font-semibold tracking-[0.08em] text-success uppercase"
                      : "rounded-4xl border border-border px-2 py-0.5 text-[0.625rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
                  }
                >
                  {section.status === "ready" ? "Ready" : "Soon"}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-body font-semibold">{section.label}</h2>
                <p className="text-small text-muted-foreground">{section.note}</p>
              </div>
            </Wrapper>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-6">
        <h2 className="font-heading text-h3 font-semibold">What works today</h2>
        <p className="max-w-2xl text-body text-muted-foreground">
          Secure sign-in, password recovery, and an audit trail recording every
          administrative action. Vehicle inventory is live — add a vehicle, and it
          stays a draft until you publish it. Business settings hold the WhatsApp
          number customers reach you on and the payment stages every vehicle order
          is built from.
        </p>
      </div>
    </div>
  )
}
