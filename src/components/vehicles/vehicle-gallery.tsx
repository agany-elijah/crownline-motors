"use client"

import Image from "next/image"
import { useState } from "react"
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { describeVehiclePhoto, type VehicleNaming } from "@/types/vehicle-photo"

/**
 * The vehicle photograph gallery.
 *
 * ── Why this is the one client component on the page ──────────────────
 * Everything else about a vehicle page is content that never changes after
 * render, so it stays on the server. Choosing which photograph to look at
 * is genuine local state, and isolating it here keeps the rest of the page
 * — description, specifications, pricing, structured data — out of the
 * browser bundle entirely.
 *
 * ── Why every photograph is in the DOM ────────────────────────────────
 * Rather than swapping one `src`. The non-selected frames are hidden but
 * present, so the browser decodes the next image before it is asked for and
 * moving through a gallery does not flash a blank frame on a slow
 * connection. Only the first is eager; the rest carry `loading="lazy"`, so
 * the cost of that is deferred until the viewer actually reaches it.
 *
 * ── Keyboard and screen-reader shape ──────────────────────────────────
 * The thumbnails are a tablist in behaviour, but they are marked up as
 * plain buttons with `aria-pressed` rather than as an ARIA tablist. A
 * tablist commits to arrow-key roving focus and a matching set of panels;
 * this is a single panel whose contents change, and claiming the richer
 * pattern without implementing it is worse for a screen-reader user than
 * describing what is actually here.
 */
interface VehicleGalleryProps {
  photos: {
    id: string
    url: string
    altText: string | null
    isPrimary: boolean
  }[]
  vehicle: VehicleNaming
}

export function VehicleGallery({ photos, vehicle }: VehicleGalleryProps) {
  const [active, setActive] = useState(0)

  if (photos.length === 0) {
    return (
      <div className="media-frame flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted text-muted-foreground">
        <ImageOff aria-hidden="true" className="size-8" />
        <p className="text-small">
          Photographs of this vehicle are being prepared.
        </p>
      </div>
    )
  }

  /** The photograph's position among the supporting images, 1-based. */
  function describe(index: number) {
    const photo = photos[index]
    return describeVehiclePhoto(photo, vehicle, photo.isPrimary ? undefined : index)
  }

  function step(delta: -1 | 1) {
    // Wraps, so a viewer moving through with the arrows never hits a dead
    // end and has to reverse.
    setActive((current) => (current + delta + photos.length) % photos.length)
  }

  const showControls = photos.length > 1

  return (
    <div className="flex flex-col gap-3">
      <div className="media-frame relative aspect-video w-full rounded-xl border border-border bg-muted">
        {photos.map((photo, index) => (
          <Image
            key={photo.id}
            src={photo.url}
            alt={describe(index)}
            fill
            sizes="(min-width: 1024px) 62vw, 100vw"
            preload={index === 0}
            loading={index === 0 ? undefined : "lazy"}
            className={cn(
              "object-cover transition-opacity duration-base ease-crownline",
              index === active ? "opacity-100" : "opacity-0"
            )}
            // Keeps the hidden frames out of the accessibility tree and out
            // of the tab order, so a screen reader announces one image
            // rather than reading the whole gallery on every page load.
            aria-hidden={index === active ? undefined : "true"}
          />
        ))}

        {showControls ? (
          <>
            <GalleryArrow
              direction="previous"
              onClick={() => step(-1)}
              className="left-3"
            />
            <GalleryArrow
              direction="next"
              onClick={() => step(1)}
              className="right-3"
            />

            {/* A quiet counter rather than a row of dots. Forty photographs
                would be forty dots; "3 / 12" reads the same at any count. */}
            {/*
              Built as one string rather than `{active + 1} / {photos.length}`,
              which React renders as three separate text nodes. A screen
              reader then meets "3", "/", "12" as fragments instead of one
              readable position, and it makes the counter awkward to assert
              on from a test.
            */}
            <span className="tabular pointer-events-none absolute right-3 bottom-3 rounded-md bg-foreground/70 px-2 py-1 text-xs font-semibold text-background backdrop-blur-sm">
              {`${active + 1} / ${photos.length}`}
            </span>
          </>
        ) : null}
      </div>

      {showControls ? (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-pressed={index === active}
                aria-label={`Show ${describe(index)}`}
                className={cn(
                  "media-frame relative block aspect-video w-full rounded-lg border transition-colors duration-fast",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  index === active
                    ? "border-gold-ink"
                    : "border-border hover:border-gold-ink/50"
                )}
              >
                <Image
                  src={photo.url}
                  // Empty, deliberately: the button's own aria-label already
                  // describes the photograph, and repeating it here would
                  // make a screen reader announce it twice.
                  alt=""
                  fill
                  sizes="(min-width: 640px) 12vw, 22vw"
                  loading="lazy"
                  className={cn(
                    "object-cover transition-opacity duration-fast",
                    index === active ? "opacity-100" : "opacity-70 hover:opacity-100"
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function GalleryArrow({
  direction,
  onClick,
  className,
}: {
  direction: "previous" | "next"
  onClick: () => void
  className?: string
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${direction === "previous" ? "Previous" : "Next"} photograph`}
      className={cn(
        "absolute top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg",
        "bg-background/85 text-foreground backdrop-blur-sm",
        "transition-colors duration-fast hover:bg-background",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  )
}
