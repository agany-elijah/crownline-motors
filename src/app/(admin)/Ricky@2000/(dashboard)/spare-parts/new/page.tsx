import type { Metadata } from "next"
import { TriangleAlert } from "lucide-react"

import { AdminStepTrail } from "@/components/admin/admin-form"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { SparePartForm } from "@/components/admin/spare-part-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { requirePermission } from "@/lib/auth/admin-guard"
import { listCategoryOptions } from "@/lib/queries/spare-part.queries"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"

export const metadata: Metadata = {
  title: "Add Spare Part",
}

export default async function AdminSparePartNewPage() {
  await requirePermission("sparePart:write")

  const [categories, { catalogDisplay }] = await Promise.all([listCategoryOptions(), getPublicSiteSettings()])

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
      <div className="flex flex-col gap-6">
        <AdminPageHeader back={BACK} title="Add spare part" />
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
      <div className="flex flex-col gap-5">
        <AdminPageHeader
          back={BACK}
          title="Add spare part"
          description="Enter the part, its fitment details and photographs. It is saved as a draft for you to review and publish."
        />
        <AdminStepTrail steps={STEPS} current={0} />
      </div>

      <SparePartForm categories={categories} siteWideVisibility={catalogDisplay.sparePart} />
    </div>
  )
}

const BACK = { href: `${ADMIN_BASE_PATH}/spare-parts`, label: "All spare parts" }

/**
 * The three stages, as a trail rather than a set of cards.
 *
 * It replaced three explanatory panels that took a third of the screen to
 * say what an operator learns once and then never needs again. What is
 * genuinely useful on the second listing is knowing where you are and what
 * happens next.
 */
const STEPS = [
  "Part details and photographs",
  "Create part — saved as a draft",
  "Publish to put it on the website",
] as const
