import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ChevronRight, TriangleAlert } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { SparePartForm } from "@/components/admin/spare-part-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { requirePermission } from "@/lib/auth/admin-guard"
import { listCategoryOptions } from "@/lib/queries/spare-part.queries"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

export const metadata: Metadata = {
  title: "Add Spare Part",
}

export default async function AdminSparePartNewPage() {
  await requirePermission("sparePart:write")

  const categories = await listCategoryOptions()

  /**
   * A part must have a category, and the select can only offer what exists.
   *
   * This is reachable — every category retired, or a database provisioned
   * without running the seed — and the failure it would otherwise produce is
   * a form that looks fine, submits an empty `categoryId`, and returns a
   * validation error the operator cannot act on. Saying so up front, with the
   * fix, is the difference between a dead end and a next step.
   */
  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink />
        <AdminPageHeader title="Add spare part" />
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            There are no active categories, and every part needs one. Run{" "}
            <code className="text-xs">npm run db:seed</code> to install the
            starting set, or reactivate a category, then come back.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink />

        <AdminPageHeader title="Add spare part" />
      </div>

      <WorkflowTrail />

      <SparePartForm categories={categories} />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href={`${ADMIN_BASE_PATH}/spare-parts`}
      className="inline-flex w-fit items-center gap-1.5 text-small text-muted-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      All spare parts
    </Link>
  )
}

/**
 * The three stages, as a trail rather than a set of cards.
 *
 * It replaced three explanatory panels that took a third of the screen to
 * say what an operator learns once and then never needs again. What is
 * genuinely useful on the second listing is knowing where you are and what
 * happens next, which is a line of text and two arrows.
 *
 * An ordered list, so the sequence is in the markup rather than only in the
 * arrows — a screen reader announces three numbered items and skips the
 * chevrons, which are decorative.
 */
function WorkflowTrail() {
  const steps = [
    "Part details and photographs",
    "Create part — saved as a draft",
    "Publish to put it on the website",
  ]

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-small">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          {index > 0 ? (
            <ChevronRight
              aria-hidden="true"
              className="size-3.5 text-muted-foreground/50"
            />
          ) : null}

          <span
            // The first step is the one this screen is: marked with
            // aria-current so it is announced as the position, not only
            // coloured.
            aria-current={index === 0 ? "step" : undefined}
            className={
              index === 0
                ? "font-semibold text-gold-ink"
                : "text-muted-foreground"
            }
          >
            {step}
          </span>
        </li>
      ))}
    </ol>
  )
}
