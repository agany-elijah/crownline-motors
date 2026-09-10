"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ImageOff, ShoppingCart } from "lucide-react"

import { SparePartAvailabilityTag } from "@/components/spare-parts/spare-part-availability-tag"
import { SparePartPrice } from "@/components/spare-parts/spare-part-price"
import { SparePartQuickView } from "@/components/spare-parts/spare-part-quick-view"
import { cn } from "@/lib/utils"
import type { PublicSparePartCard } from "@/lib/queries/public-spare-part.queries"

/**
 * One part in the public catalogue.
 *
 * ── The shape ─────────────────────────────────────────────────────────
 *
 *     ┌─────────────────────────┐
 *     │ ● In stock              │  availability, over the photograph
 *     │                         │
 *     │       photograph        │  fills the frame edge to edge
 *     │                         │
 *     ├─────────────────────────┤
 *     │ Front brake pad set     │  the name — the loudest thing here
 *     │ 04465-48150 · Harrier   │  the number, and what it fits
 *     │ $120 est.          [ 🛒 ]│  price · add
 *     └─────────────────────────┘
 *
 * ── What the eye is meant to land on ──────────────────────────────────
 * The part's name, and nothing else. Everything on a card competes for that,
 * and two things were beating it:
 *
 *   The availability tag was a filled, coloured, bordered pill sitting
 *   directly above the name. Twenty-four cards read as twenty-four green
 *   badges. It now sits over the photograph as a quiet frosted plate with a
 *   6px coloured dot (see the tag's `overlay` variant) — still findable at a
 *   glance, no longer the first thing seen.
 *
 *   The brand was a gold eyebrow above the name, and gold above near-black is
 *   never the second thing read. It has gone from the card entirely and lives
 *   on the part's page, where "By: Denso" is one clean line in a specification
 *   block. A brand is a reassurance while deciding, not a way of telling two
 *   cards apart in a grid — the *name* does that.
 *
 * The name itself is now semibold at the body step rather than medium at the
 * small step, which is the change that makes the grid scannable.
 *
 * ── Why `object-cover` ────────────────────────────────────────────────
 * The photograph runs to the card's edges and fills the frame. Contain would
 * letterbox every listing inside margins of five different shapes — the exact
 * opposite of the brief's photography standard, which asks for one consistent
 * aspect ratio across every card. The cropping that risks is handled where it
 * belongs: the preview panel and the part's own page both show the whole
 * photograph, uncropped. A card's job is to be recognised, not inspected.
 *
 * ── Two targets, one card ─────────────────────────────────────────────
 * Pressing the card opens the part. Pressing the gold cart button opens the
 * preview panel, where the customer can see the part properly and add it
 * without losing their place in the grid.
 *
 * That is two controls in one card, and the markup has to be careful: a
 * `<button>` inside an `<a>` is invalid, and browsers resolve it by making one
 * of the two unreachable. So the card is not an anchor. The title is the
 * anchor, stretched over the whole card with `after:absolute after:inset-0`;
 * the button is raised above that overlay with `relative z-10`. One tab stop
 * each, and a real accessible name on both.
 */
interface SparePartCardProps {
  part: PublicSparePartCard
  /**
   * Passed to `next/image` so the browser can pick a source before layout
   * settles. Wrong values here cost real bandwidth on a slow connection — the
   * grid is 2 columns on a phone, 3 at `sm`, 4 at `xl`.
   */
  sizes?: string
  /**
   * Opts this card's photograph out of lazy loading. Set it on the first row
   * only: those images are above the fold and lazy-loading them delays the
   * largest paint, while eager-loading the whole page fetches two dozen
   * photographs nobody has scrolled to yet.
   */
  priority?: boolean
}

const CARD_IMAGE_SIZES =
  "(min-width: 1280px) 20rem, (min-width: 640px) 31vw, 47vw"

export function SparePartCard({
  part,
  sizes = CARD_IMAGE_SIZES,
  priority = false,
}: SparePartCardProps) {
  const [previewOpen, setPreviewOpen] = React.useState(false)

  const [leadFitment] = part.preview.fitment

  return (
    <>
      <article
        className={cn(
          // `w-full` is load-bearing: the grid wraps each card in a flex
          // container, and a flex item with `width: auto` shrinks to its own
          // content rather than filling the column. Without it the cards in a
          // row come out at different widths, sized by how long each part's
          // name happens to be.
          "group/part relative flex h-full w-full flex-col overflow-hidden rounded-[4px]",
          "border border-border bg-card",
          "transition-[border-color,box-shadow,transform] duration-slow ease-crownline-soft",
          "hover:-translate-y-1 hover:border-gold-ink/35 hover:shadow-[var(--shadow-raised)]",
          // The stretched link's focus ring belongs to the card, not to the
          // two words of the title — otherwise a keyboard user sees an outline
          // around a fragment of text with no visible relationship to the
          // thing they are about to open.
          "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
        )}
      >
        {/* ── The photograph ─────────────────────────────────────
            Square, flush to the card's edges. `bg-muted` is what a slow
            connection sees while the image streams in, and what a
            transparent PNG sits on. */}
        <div className="relative aspect-square shrink-0 overflow-hidden bg-muted">
          {part.photoUrl ? (
            <Image
              src={part.photoUrl}
              alt={part.photoAltText ?? part.name}
              fill
              sizes={sizes}
              priority={priority}
              className={cn(
                "object-cover",
                // Named explicitly rather than through a utility, because
                // Tailwind compiles `scale-[1.04]` to the standalone `scale`
                // property rather than to a `transform` function — so the
                // transition has to name `scale`, not `transform`.
                "transition-[scale] duration-cinematic ease-crownline-soft",
                "group-hover/part:scale-[1.04]"
              )}
            />
          ) : (
            /**
             * A listing published before its photography arrived. Stated
             * plainly rather than papered over with a stock image: the brief
             * is emphatic that generic imagery is what makes a dealership look
             * invented.
             */
            <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <ImageOff aria-hidden="true" className="size-5" />
              <span className="px-2 text-center text-xs">Photo coming soon</span>
            </div>
          )}

          {/* Top left, out of the way of the eye's path to the name below.
              It does not scale with the photograph on hover — a tag that
              drifts is a tag that draws attention to itself. */}
          <SparePartAvailabilityTag
            availability={part.availability}
            size="overlay"
            className="absolute top-2 left-2"
          />
        </div>

        {/* ── The details ────────────────────────────────────────
            The name first and loudest, then the two facts that confirm it,
            then the price and the way to add it. Every row but the name and
            the price is optional, and an absent one takes no space rather
            than leaving a gap. */}
        <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
          {/* h3: the page supplies the h1 and the grid sits under an h2, so a
              card must not restart the outline. */}
          <h3 className="text-body leading-snug font-semibold text-foreground">
            <Link
              href={`/spare-parts/${part.slug}`}
              // The stretched link. `after` covers the whole card, so the
              // photograph and the empty space below the title open the part
              // too — one large target for a thumb. The add button sits above
              // it on its own stacking context.
              className="line-clamp-2 outline-none after:absolute after:inset-0 after:content-['']"
            >
              {part.name}
            </Link>
          </h3>

          {/*
            The manufacturer's number and the lead fitment, on one line.

            Two facts a buyer checks in the same glance — is this the number
            off my old part, and is it for my car — so they are set as one
            metadata line rather than two rows. Our own `CLM-SP-…` reference is
            deliberately not here: the customer already has the manufacturer's
            number, and a second code beside it is noise. It still travels with
            the card, because it is what the basket stores and what the
            WhatsApp message quotes.
          */}
          {part.preview.oemPartNumber || leadFitment ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {part.preview.oemPartNumber ? (
                <span className="font-mono">{part.preview.oemPartNumber}</span>
              ) : null}
              {part.preview.oemPartNumber && leadFitment ? (
                <span aria-hidden="true" className="text-muted-foreground/50">
                  {" · "}
                </span>
              ) : null}
              {leadFitment ? (
                <>
                  {leadFitment}
                  {/*
                    "+ more", never a count. The card carries a truncated list,
                    so a number would be a lower bound presented as a total —
                    on a fitment claim, the one direction it must not be wrong
                    in.
                  */}
                  {part.preview.hasMoreFitment ? (
                    <span className="text-muted-foreground/70"> + more</span>
                  ) : null}
                </>
              ) : null}
            </p>
          ) : null}

          {/* Pushed to the bottom so the price and the button sit on one line
              across the row however many optional rows each card rendered. */}
          <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
            <SparePartPrice price={part.price} size="card" />
            <AddButton
              onOpen={() => setPreviewOpen(true)}
              partName={part.name}
            />
          </div>
        </div>
      </article>

      {/*
        Mounted only while open. Twenty-four dialogs' worth of gallery,
        description and fitment in the tree at once would be a real cost on a
        mid-range Android for markup nobody has asked to see.

        The data it renders travels with the card, so opening it costs no
        request. See PREVIEW_PHOTO_LIMIT in public-spare-part.queries.ts.
      */}
      {previewOpen ? (
        <SparePartQuickView part={part} open onOpenChange={setPreviewOpen} />
      ) : null}
    </>
  )
}

/**
 * The gold cart button, opposite the price.
 *
 * ── Why it moved off the photograph ───────────────────────────────────
 * It used to float in the corner of the image, which put a control on top of
 * the one thing on the card that has to be read as a photograph, and gave the
 * card two competing focal points. In the detail block, opposite the price, it
 * reads as what it is: the action that belongs to that figure. It also stops
 * covering part of the product on a card where the crop is already tight.
 *
 * ── The glyph ─────────────────────────────────────────────────────────
 * A shopping cart, at the dealership's instruction. It was a bare `+`, on the
 * argument that a plus promises "one more step" — which is literally what
 * happens — where a cart promises a completed purchase.
 *
 * That argument was thinner than it looked. A `+` beside a price is the most
 * overloaded glyph in interface design: it is "add to basket" on one site,
 * "compare" on the next and "expand" on the third, and a first-time visitor on
 * a phone has to press it to find out which. A cart is the one mark in this
 * whole grid that a customer in this market reads without thinking, and it
 * names the destination of the flow the button starts. The half-step it
 * skips — the preview panel — is not a surprise to anyone who pressed it, it
 * is the panel that lets them check the fitment before committing.
 *
 * ── What it does ──────────────────────────────────────────────────────
 * Opens the preview panel — it does not add silently. A card is a thumbnail, a
 * name and a price, which is enough to be interested in a part and not enough
 * to be sure of one; a parts buyer's real question is whether the component
 * fits their car, and getting that wrong costs them an import. So the button
 * opens the part at a size where the photograph, the fitment and the
 * description answer it, with the real Add control inside.
 *
 * The accessible name says exactly that — see `aria-label` below — so the
 * glyph is never the only thing telling a customer what will happen.
 *
 * ── Hidden on a pointer, always there on a touchscreen ────────────────
 * On a device with a real pointer the button fades in when the card is
 * hovered, which keeps the grid clean and lets the photography carry it. A
 * touchscreen has no hover, and a control revealed by one does not exist on a
 * phone — where most of this business's customers are. So the resting state is
 * gated on `@media (hover: hover)`, the query that actually asks "can this
 * device hover", rather than on a width breakpoint, which guesses and gets
 * touch laptops and small windows wrong in both directions.
 *
 * `group-focus-within` covers the third case: a keyboard user tabbing to the
 * button has not hovered anything, and a control that is focused but invisible
 * is the worst of the three states.
 */
function AddButton({
  onOpen,
  partName,
}: {
  onOpen: () => void
  partName: string
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        // Raised above the stretched link's overlay, or the card would
        // swallow every press of it.
        "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-[6px]",
        "bg-gold-bright text-gold-bright-foreground shadow-[var(--shadow-gold)]",
        "transition-[opacity,box-shadow,transform] duration-base ease-crownline",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-gold-strong)]",
        "active:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        // The resting state on a hover-capable device. `pointer-events-none`
        // stops an invisible control eating a press meant for the card.
        "[@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0",
        "group-hover/part:pointer-events-auto group-hover/part:opacity-100",
        "group-focus-within/part:pointer-events-auto group-focus-within/part:opacity-100"
      )}
      /**
       * Named for what pressing it actually does. "Add to cart" would be a
       * lie — it opens a preview where the customer confirms and then adds —
       * and a screen-reader user who pressed it expecting the first would not
       * know what had happened. The part's name is included because a grid of
       * twenty-four identically-named controls is unnavigable.
       */
      aria-label={`Preview and add ${partName}`}
    >
      <ShoppingCart aria-hidden="true" className="size-4" />
    </button>
  )
}
