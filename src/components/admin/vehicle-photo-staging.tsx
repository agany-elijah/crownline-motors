"use client"

import { PhotoStaging } from "@/components/admin/photo-staging"
import { MAX_PHOTOS_PER_UPLOAD } from "@/lib/constants/vehicle-photo-options"

/**
 * The photographs section of the create-vehicle form.
 *
 * All of the behaviour lives in `PhotoStaging`, which the spare-parts form
 * also uses — see the notes there for why the photographs are part of this
 * form at all, and how the bytes reach the Server Action. What is here is the
 * vehicle's ceiling and the vehicle's wording.
 */
export function VehiclePhotoStaging({ disabled = false }: { disabled?: boolean }) {
  return (
    <PhotoStaging
      capacity={MAX_PHOTOS_PER_UPLOAD}
      // Must match what `createVehicleAction` reads from the FormData.
      inputName="photos"
      disabled={disabled}
      copy={{
        mainDropLabel: "Choose the main image",
        mainDropHint: "16:9 landscape",
        mainAlt: "Main photograph of this vehicle",
        otherAlt: (position) => `Photograph ${position} of this vehicle`,
      }}
    />
  )
}
