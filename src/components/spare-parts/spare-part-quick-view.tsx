"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Check, ImageOff, ShoppingCart } from "lucide-react"

import { SparePartAvailabilityTag } from "@/components/spare-parts/spare-part-availability-tag"
import { SparePartPrice } from "@/components/spare-parts/spare-part-price"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useCart } from "@/components/cart/cart-provider"
import { cn } from "@/lib/utils"
import { describeSparePartPhoto } from "@/types/spare-part-photo"
import type { PublicSparePartCard } from "@/lib/queries/public-spare-part.queries"

/**
 * The preview that opens from a card's Add button.
 *
 * ── Why adding goes through a preview at all ──────────────────────────
 * A card is a thumbnail, a name and a price. That is enough to be
 * *interested* in a part and not enough to be sure of one — a parts buyer's
 * real question is "is this the right component for my car", and getting it
 * wrong costs them an import of something that does not fit.
 *
 * So pressing Add does not silently drop the part in the basket. It opens the
 * part at a size where the photograph is legible, the fitment list is
 * readable and the description says what the thing actually is, with the real
 * Add control inside. One press to look, one to commit — and the second press
 * is made with the answer on screen.
 *
 * ── Why a panel rather than a navigation ──────────────────────────────
 * Someone buying parts is usually buying several, and each is a small
 * decision. Sending them to a full page for each and back again loses their
 * place in a grid they may have scrolled a long way down — on a phone, twice
 * per part. The panel answers the same questions in place and puts them back
 * exactly where they were.
 *
 * It is deliberately *not* the whole part page: a short excerpt of the
 * description and the first few fitment rules, with a link to the page for
 * the rest. A preview that reproduced the page would be a second
 * implementation of it to keep in step.
 *
 * ── Where its data comes from ─────────────────────────────────────────
 * The card it was opened from. Nothing is fetched — see the note on
 * `PREVIEW_PHOTO_LIMIT` in public-spare-part.queries.ts for why half a
 * kilobyte per card beats a request per open on the connections this business
 * runs on. The panel therefore opens instantly, and works for someone whose
 * connection dropped after the page loaded.
 *
 * ── Adding, and what happens after ────────────────────────────────────
 * The button confirms in place for a moment and the panel then closes, so the
 * customer is returned to the grid they were working through rather than
 * being left to dismiss a dialog whose job is done. The spoken confirmation
 * comes from the cart provider's single live region; the header badge
 * increments at the same time.
 */
interface SparePartQuickViewProps {
  part: PublicSparePartCard
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** How long the confirmed state shows before the panel closes itself. Long
 *  enough to read, short enough not to feel like a wait. */
const CONFIRM_MS = 900

export function SparePartQuickView({
  part,
  open,
  onOpenChange,
}: SparePartQuickViewProps) {
  const { add } = useCart()

  const [added, setAdded] = React.useState(false)
  const [activePhoto, setActivePhoto] = React.useState(0)

  const photos = part.preview.photos
  const active = photos[activePhoto] ?? null

  React.useEffect(() => {
    if (!added) return

    const timer = window.setTimeout(() => onOpenChange(false), CONFIRM_MS)
    return () => window.clearTimeout(timer)
  }, [added, onOpenChange])

  function handleAdd() {
    /**
     * One unit. The quantity is chosen in exactly one place — the basket —
     * where the customer can see the line it applies to. See the note on
     * `AddToCart`.
     */
    add(
      {
        slug: part.slug,
        name: part.name,
        referenceNumber: part.referenceNumber,
        price: part.price,
        imageUrl: part.photoUrl,
      },
      1
    )

    setAdded(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Wider than the default `sm:max-w-sm`: this holds a gallery beside a
        // column of text from `sm` up, and at the default width the two would
        // each be too narrow to be worth splitting.
        className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl"
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:gap-6 sm:p-6">
          {/* ── Photographs ──────────────────────────────────────
              Contained rather than cropped, unlike the catalogue card. The
              card's job is to be recognised at a glance and a consistent
              crop is what makes a grid read as one rack; here the customer
              is inspecting the part, and the ends of a long component are
              exactly what a crop would remove. */}
          <div className="flex shrink-0 flex-col gap-2 sm:w-56">
            {/* The padded plinth, and the frame inside that measures the
                photograph. They cannot be merged: a `fill` image is
                positioned against its ancestor's *padding box*, so padding
                alone does not inset it. */}
            <div className="aspect-square overflow-hidden rounded-[4px] border border-border bg-card p-3">
              <div className="relative size-full overflow-hidden">
                {active ? (
                  <Image
                    src={active.url}
                    alt={describeSparePartPhoto(
                      active,
                      part.name,
                      active.isPrimary ? undefined : activePhoto
                    )}
                    fill
                    sizes="(min-width: 640px) 14rem, 90vw"
                    className="object-contain"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff aria-hidden="true" className="size-6" />
                    <span className="text-small">Photographs coming soon</span>
                  </div>
                )}
              </div>
            </div>

            {photos.length > 1 ? (
              <ul className="flex gap-2">
                {photos.map((photo, index) => (
                  <li key={photo.id}>
                    <button
                      type="button"
                      onClick={() => setActivePhoto(index)}
                      aria-pressed={index === activePhoto}
                      aria-label={`Show photograph ${index + 1} of ${photos.length}`}
                      className={cn(
                        "size-12 overflow-hidden rounded-[4px] border bg-card p-1",
                        "transition-colors duration-fast",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        index === activePhoto
                          ? "border-gold-ink"
                          : "border-border hover:border-gold-ink/50"
                      )}
                    >
                      <span className="relative block size-full overflow-hidden">
                        <Image
                          src={photo.url}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-contain"
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* ── The decision ─────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              {/* Padded on the right so a long name does not run under the
                  dialog's own close button. */}
              <DialogTitle className="pr-8 text-title leading-snug font-semibold">
                {part.name}
              </DialogTitle>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <SparePartAvailabilityTag availability={part.availability} />

                {/*
                  The manufacturer's number, and only that — the number a
                  customer reads off the old part and matches against. Our own
                  `CLM-SP-…` reference is deliberately not beside it: two codes
                  on one line, one of which means nothing outside our
                  dashboard, is noise on a panel whose whole job is a quick yes
                  or no.
                */}
                {part.preview.oemPartNumber ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {part.preview.oemPartNumber}
                  </span>
                ) : null}
              </div>
            </div>

            <SparePartPrice price={part.price} size="panel" />

            {part.preview.fitment.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <h3 className="eyebrow text-muted-foreground">Fits</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {part.preview.fitment.map((line) => (
                    <li
                      key={line}
                      className="rounded-[3px] border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                    >
                      {line}
                    </li>
                  ))}
                  {part.preview.hasMoreFitment ? (
                    <li className="px-1 py-1 text-xs text-muted-foreground">
                      and others
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {/*
              The dialog's described-by target, so a screen reader reads the
              part's opening line after its name rather than announcing an
              unlabelled modal.
            */}
            <DialogDescription className="text-small">
              {part.preview.excerpt}
            </DialogDescription>

            <div className="mt-auto flex flex-col gap-3 pt-1">
              <Button
                type="button"
                onClick={handleAdd}
                disabled={added}
                aria-label={`Add ${part.name} to cart`}
                className="w-full"
              >
                {added ? (
                  <>
                    <Check aria-hidden="true" />
                    Added to cart
                  </>
                ) : (
                  <>
                    <ShoppingCart aria-hidden="true" />
                    Add to cart
                  </>
                )}
              </Button>

              <Link
                href={`/spare-parts/${part.slug}`}
                className="group/more inline-flex w-fit items-center gap-1.5 text-small font-medium text-muted-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Full details, photographs and fitment
                <ArrowRight
                  aria-hidden="true"
                  className="size-3.5 transition-transform duration-fast group-hover/more:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
