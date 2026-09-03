import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CheckCircle2, TriangleAlert } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { VehicleForm } from "@/components/admin/vehicle-form"
import { VehiclePhotoBoard } from "@/components/admin/vehicle-photo-board"
import { VehicleStatusBadge } from "@/components/admin/vehicle-status-badge"
import { VehicleStatusControl } from "@/components/admin/vehicle-status-control"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { requirePermission } from "@/lib/auth/admin-guard"
import { listVehiclePhotos } from "@/lib/queries/vehicle-photo.queries"
import { getVehicleById } from "@/lib/queries/vehicle.queries"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"

export async function generateMetadata(
  props: PageProps<"/Ricky@2000/vehicles/[id]">
): Promise<Metadata> {
  const { id } = await props.params
  const vehicle = await getVehicleById(id)

  // Cached by the DAL-style `cache()` on getVehicleById, so this does not
  // cost a second query alongside the page below.
  return {
    title: vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
      : "Vehicle",
  }
}

export default async function AdminVehicleDetailPage(
  props: PageProps<"/Ricky@2000/vehicles/[id]">
) {
  await requirePermission("vehicle:read")

  const { id } = await props.params
  const searchParams = await props.searchParams

  const vehicle = await getVehicleById(id)

  if (!vehicle) {
    // A vehicle is never deleted, so this is a mistyped or stale URL rather
    // than something that used to exist. 404 is the honest answer.
    notFound()
  }

  const photos = await listVehiclePhotos(id)

  const justCreated = searchParams.created === "1"
  /** The vehicle saved, but its photographs did not. See createVehicleAction
   *  for why the two are allowed to diverge and why the vehicle is kept. */
  const photosFailed = searchParams.photos === "failed"

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href={`${ADMIN_BASE_PATH}/vehicles`}
          className="inline-flex w-fit items-center gap-1.5 text-small text-muted-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          All vehicles
        </Link>

        <AdminPageHeader
          title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-small">{vehicle.referenceNumber}</span>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <span className="text-small">
                Web address: <code className="text-xs">/cars/{vehicle.slug}</code>
              </span>
            </span>
          }
          actions={<VehicleStatusBadge status={vehicle.status} />}
        />
      </div>

      {justCreated && !photosFailed ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" className="text-gold-ink" />
          <AlertDescription>
            Vehicle created as a draft, with reference{" "}
            <strong className="font-semibold">{vehicle.referenceNumber}</strong>
            {photos.length > 0
              ? ` and ${photos.length} photograph${photos.length === 1 ? "" : "s"}.`
              : "."}{" "}
            Publish it below when the listing is ready.
          </AlertDescription>
        </Alert>
      ) : null}

      {photosFailed ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            The vehicle was saved as{" "}
            <strong className="font-semibold">{vehicle.referenceNumber}</strong>,
            but its photographs could not be uploaded. Nothing else was lost —
            add them again in the Photographs section below. The listing is a
            draft, so no customer has seen it without images.
          </AlertDescription>
        </Alert>
      ) : null}

      <VehicleStatusControl
        vehicleId={vehicle.id}
        status={vehicle.status}
        photoCount={photos.length}
      />

      {/*
        Keyed by vehicle id. `useActionState` inside the form holds the last
        submission's values, and React would carry that state across a
        client-side navigation from one vehicle to another — the component
        sits at the same position in the tree. The key makes each vehicle its
        own form instance, so vehicle B never opens showing vehicle A's
        rejected input.
      */}
      <VehicleForm key={vehicle.id} vehicle={vehicle} />

      <VehiclePhotoBoard
        vehicleId={vehicle.id}
        vehicle={{ year: vehicle.year, make: vehicle.make, model: vehicle.model }}
        photos={photos}
      />
    </div>
  )
}
