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
        intro:
          "Added when you save the vehicle. You can select several at once, on a phone as well as a computer. Landscape photographs look best — every image is shown at 16:9 across the website, and each one is resized in your browser before it is sent so the listing stays fast on a mobile connection.",
        mainImageHint:
          "This is the first image customers see — on the vehicle card, in search results, and at the top of the gallery.",
        otherImagesHint: (
          <>
            The rest of the walk-around, shown after the main image. Pick as
            many as you like in one go. Use the <span aria-hidden="true">⋯</span>{" "}
            menu on any of them to make it the main image instead.
          </>
        ),
        mainDropLabel: "Choose the main image",
        mainDropHint: "The first photograph customers will see",
        mainAlt: "Main photograph of this vehicle",
        otherAlt: (position) => `Photograph ${position} of this vehicle`,
      }}
    />
  )
}
