"use client"

import { PhotoStaging } from "@/components/admin/photo-staging"
import { MAX_PHOTOS_PER_SPARE_PART } from "@/lib/constants/spare-part-photo-options"

/**
 * The photographs section of the create-part form.
 *
 * All of the behaviour lives in `PhotoStaging`, which the vehicle form also
 * uses. What is here is the part's ceiling and the part's wording.
 *
 * The copy is not the vehicle copy with the noun swapped. A parts buyer is
 * looking for different things in a photograph — the markings that confirm it
 * is the right unit, the condition of the wearing surfaces, what is actually
 * in the box — and the hints say so, because an operator photographing a
 * brake pad the way they would photograph a car produces four images of the
 * same angle.
 */
export function SparePartPhotoStaging({ disabled = false }: { disabled?: boolean }) {
  return (
    <PhotoStaging
      capacity={MAX_PHOTOS_PER_SPARE_PART}
      // Must match what `createSparePartAction` reads from the FormData.
      inputName="photos"
      disabled={disabled}
      copy={{
        intro: `Added when you save the part. Up to ${MAX_PHOTOS_PER_SPARE_PART} images, selected several at a time.`,
        mainImageHint:
          "Shown on the catalogue card and first in the gallery. A clear shot of the whole part on a plain background works best.",
        otherImagesHint: (
          <>
            Part markings, wearing surfaces, what is in the box. Use the{" "}
            <span aria-hidden="true">⋯</span> menu to change the main image.
          </>
        ),
        mainDropLabel: "Choose the main image",
        mainDropHint: "The first photograph customers will see",
        mainAlt: "Main photograph of this part",
        otherAlt: (position) => `Photograph ${position} of this part`,
      }}
    />
  )
}
