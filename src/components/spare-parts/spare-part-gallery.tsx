"use client"

import * as React from "react"
import Image from "next/image"
import { ImageOff } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  describeSparePartPhoto,
  type SparePartPhotoDTO,
} from "@/types/spare-part-photo"

/**
 * The photograph gallery on a part's page.
 *
 * ── Why this is a client component and the rest of the page is not ────
 * Everything else about a part page is content that never changes after
 * render, so it stays on the server. Choosing which photograph to look at is
 * genuine local state, and isolating it here keeps the description, the
 * fitment table and the structured data out of the browser bundle entirely.
 *
 * ── Why the photographs are contained, not cropped ────────────────────
 * The frame is a padded plinth and every image sits inside it whole. A part
 * arrives photographed however the supplier sent it — a long exhaust section
 * in landscape, a filter shot square, a loom photographed portrait — and
 * `object-cover` would trim whichever dimension did not fit, which on a part
 * is routinely the end that identifies it. The same treatment is on the
 * catalogue card, so the photograph a customer opened is the photograph they
 * see.
 *
 * ── Why every photograph is in the DOM ────────────────────────────────
 * Rather than swapping one `src`. The non-selected frames are hidden but
 * present, so the browser decodes the next image before it is asked for and
 * moving through the gallery does not flash a blank frame on a slow
 * connection. Only the first is eager; the rest carry `loading="lazy"`, so
 * the cost is deferred until the viewer reaches them.
 *
 * ── A thumbnail strip, not arrows ─────────────────────────────────────
 * The vehicle gallery uses arrows because a walk-around can run to forty
 * frames and a strip of forty thumbnails is its own scrolling problem. A part
 * holds at most ten, which fits as a strip on every screen — and a strip is
 * better here, because the frames of a part are *different things* (the unit,
 * its markings, the box) rather than positions around one object, so being
 * able to go straight to the one you want beats stepping through them.
 *
 * The thumbnails behave like a tablist but are marked up as plain buttons
 * with `aria-pressed`. A tablist commits to arrow-key roving focus and a
 * matching set of panels; this is a single panel whose contents change, and
 * claiming the richer pattern without implementing it is worse for a
 * screen-reader user than describing what is actually here.
 */
interface SparePartGalleryProps {
  photos: SparePartPhotoDTO[]
  partName: string
}

export function SparePartGallery({ photos, partName }: SparePartGalleryProps) {
  const [active, setActive] = React.useState(0)

  if (photos.length === 0) {
    return (
      <div className="media-frame flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-[4px] border border-border bg-muted text-muted-foreground">
        <ImageOff aria-hidden="true" className="size-8" />
        <p className="text-small">Photographs of this part are being prepared.</p>
      </div>
    )
  }

  /** The photograph's position among the supporting images, 1-based. */
  function describe(index: number) {
    const photo = photos[index]

    return describeSparePartPhoto(photo, partName, photo.isPrimary ? undefined : index)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* The plinth. Its padding cannot inset the images directly — a `fill`
          image is positioned against the *padding box*, which includes the
          padding — so the frame that measures them is the element inside. */}
      <div className="aspect-square w-full overflow-hidden rounded-[4px] border border-border bg-card p-4 sm:p-6">
        <div className="relative size-full overflow-hidden">
          {photos.map((photo, index) => (
            <Image
              key={photo.id}
              src={photo.url}
              alt={describe(index)}
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              preload={index === 0}
              loading={index === 0 ? undefined : "lazy"}
              className={cn(
                "object-contain transition-opacity duration-base ease-crownline",
                index === active ? "opacity-100" : "opacity-0"
              )}
              // Keeps the hidden frames out of the accessibility tree, so a
              // screen reader announces one image rather than reading the whole
              // gallery on every page load.
              aria-hidden={index === active ? undefined : "true"}
            />
          ))}
        </div>
      </div>

      {photos.length > 1 ? (
        <ul className="no-scrollbar flex gap-2 overflow-x-auto">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-pressed={index === active}
                aria-label={`Show photograph ${index + 1} of ${photos.length}`}
                className={cn(
                  "size-16 shrink-0 overflow-hidden rounded-[4px] border bg-card p-1",
                  "transition-colors duration-fast",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  index === active
                    ? "border-gold-ink"
                    : "border-border hover:border-gold-ink/50",
                )}
              >
                {/* The inner frame again, for the same reason as the main one
                    above: padding on a positioned ancestor does not inset a
                    `fill` image. */}
                <span className="relative block size-full overflow-hidden">
                  {/*
                    Empty alt: the button already carries a label naming the
                    position, and describing the photograph twice would have a
                    screen reader read every thumbnail's full description while
                    tabbing along the strip.
                  */}
                  <Image
                    src={photo.url}
                    alt=""
                    fill
                    sizes="64px"
                    loading="lazy"
                    className="object-contain"
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
