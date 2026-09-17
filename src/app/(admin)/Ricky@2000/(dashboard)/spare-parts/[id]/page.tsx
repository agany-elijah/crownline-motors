import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CheckCircle2, TriangleAlert } from "lucide-react"

import { AdminMetaDivider, AdminPageHeader } from "@/components/admin/admin-page-header"
import { ListingWebAddress } from "@/components/admin/listing-status-bar"
import { SparePartFitmentBoard } from "@/components/admin/spare-part-fitment-board"
import { SparePartForm } from "@/components/admin/spare-part-form"
import { SparePartPhotoBoard } from "@/components/admin/spare-part-photo-board"
import { SparePartStatusControl } from "@/components/admin/spare-part-status-control"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { requirePermission } from "@/lib/auth/admin-guard"
import { listSparePartPhotos } from "@/lib/queries/spare-part-photo.queries"
import {
  getSparePartById,
  listCategoryOptions,
  listSparePartFitment,
} from "@/lib/queries/spare-part.queries"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { SparePartStatus } from "@/generated/prisma/enums"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"

export async function generateMetadata(
  props: PageProps<"/Ricky@2000/spare-parts/[id]">
): Promise<Metadata> {
  const { id } = await props.params
  const part = await getSparePartById(id)

  // Cached by the DAL-style `cache()` on getSparePartById, so this does not
  // cost a second query alongside the page below.
  return { title: part ? part.name : "Spare Part" }
}

export default async function AdminSparePartDetailPage(
  props: PageProps<"/Ricky@2000/spare-parts/[id]">
) {
  await requirePermission("sparePart:read")

  const { id } = await props.params
  const searchParams = await props.searchParams

  const part = await getSparePartById(id)

  if (!part) {
    // A part is never deleted, so this is a mistyped or stale URL rather than
    // something that used to exist. 404 is the honest answer.
    notFound()
  }

  /**
   * The part's own category is always included, even if it has since been
   * retired — otherwise the select would silently recategorise it on save.
   *
   * Both reads go out together: they are independent, and a page that already
   * waited on the part lookup should not then wait on two more in series.
   */
  const [categories, photos, fitment, siteSettings] = await Promise.all([
    listCategoryOptions(part.categoryId),
    listSparePartPhotos(part.id),
    listSparePartFitment(part.id),
    getPublicSiteSettings(),
  ])

  const justCreated = searchParams.created === "1"
  // Set by `createSparePartAction` when the details saved but the photographs
  // did not. The part exists, as a draft, and the operator needs to know why
  // its gallery is empty rather than assuming the upload silently worked.
  const photosFailed = searchParams.photos === "failed"

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        back={{ href: `${ADMIN_BASE_PATH}/spare-parts`, label: "All spare parts" }}
        title={part.name}
        meta={
          <>
            <span className="font-mono text-foreground">{part.referenceNumber}</span>
            {part.oemPartNumber ? (
              <>
                <AdminMetaDivider />
                <span>
                  Part number <span className="font-mono text-foreground">{part.oemPartNumber}</span>
                </span>
              </>
            ) : null}
            <AdminMetaDivider />
            <ListingWebAddress path={`/spare-parts/${part.slug}`} live={part.status === SparePartStatus.PUBLISHED} />
          </>
        }
      />

      {justCreated ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" className="text-gold-ink" />
          <AlertDescription>
            Part created as a draft, with reference{" "}
            <strong className="font-semibold">{part.referenceNumber}</strong>.
            Publish it below when the listing is ready.
          </AlertDescription>
        </Alert>
      ) : null}

      {photosFailed ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            The part was saved as{" "}
            <strong className="font-semibold">{part.referenceNumber}</strong>,
            but its photographs could not be uploaded. Nothing else was lost —
            add them again in the Photographs section below. The listing is a
            draft, so no customer has seen it without images.
          </AlertDescription>
        </Alert>
      ) : null}

      <SparePartStatusControl
        sparePartId={part.id}
        status={part.status}
        pricingMode={part.pricingMode}
        price={part.price}
        stockQuantity={part.stockQuantity}
        availability={part.availability}
        fitmentCount={part.fitmentCount}
        photoCount={photos.length}
      />

      {/*
        Keyed by part id. `useActionState` inside the form holds the last
        submission's values, and React would carry that state across a
        client-side navigation from one part to another — the component sits
        at the same position in the tree. The key makes each part its own form
        instance, so part B never opens showing part A's rejected input.
      */}
      <SparePartForm
        key={part.id}
        part={part}
        categories={categories}
        siteWideVisibility={siteSettings.catalogDisplay.sparePart}
      />

      {/*
        Keyed by part id for the same reason the form is: `useActionState`
        holds the last submission's state, and React would carry it across a
        client-side navigation between two parts sitting at the same position
        in the tree — so part B would open showing part A's "Added Toyota
        Harrier 2020–2023".
      */}
      <SparePartFitmentBoard
        key={`fitment-${part.id}`}
        sparePartId={part.id}
        fitment={fitment}
      />

      <SparePartPhotoBoard
        sparePartId={part.id}
        partName={part.name}
        photos={photos}
      />
    </div>
  )
}
