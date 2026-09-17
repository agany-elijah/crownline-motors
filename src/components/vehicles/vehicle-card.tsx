import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Bolt, Cog, Fuel, Gauge, ImageOff, MapPin } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  COUNTRY_LABELS,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
} from "@/lib/constants/vehicle-options"
import { formatCurrency, formatMileage } from "@/lib/utils/format-currency"
import type { PublicVehicleCard } from "@/lib/queries/public-vehicle.queries"

/**
 * One vehicle in the public catalogue.
 *
 * ── The three bands, and why they are three ───────────────────────────
 * A card is a photograph, an identity, and a set of facts — in that order,
 * separated so the eye can take them one at a time instead of reading a
 * paragraph of mixed weights.
 *
 *     ┌──────────────────────────────┐
 *     │  photograph (16:10)   [JAPAN]│  ~60% of the card's height
 *     ├──────────────────────────────┤
 *     │  Toyota Harrier 2021  $22,500│  Manrope, black · price in green
 *     │  ─────────────────────────── │  hairline
 *     │  ⚙ Automatic  ⛽ Petrol       │  Inter, muted grey
 *     │  ⬡ 2.0L       ⏱ 42,000 km  ▸ │  2×2 matrix · Explore on the right
 *     └──────────────────────────────┘
 *
 * The photograph is the largest single element by a wide margin, which is
 * the brief's "photography first" rule expressed as a proportion rather
 * than as an intention. Everything below it is sized so the picture keeps
 * roughly 60% of the card at every grid width.
 *
 * ── Why 16:10 and not 16:9 ────────────────────────────────────────────
 * A slightly taller crop gives the photograph the height it needs to hold
 * that 60% share without the detail block having to be squeezed, and it is
 * still wide enough that a landscape vehicle photograph is cropped at the
 * top and bottom — where there is sky and tarmac — rather than at the
 * sides, where there is car. A 4:3 crop would sit deeper into the stated
 * band but starts eating the front and rear of the vehicle on a wide
 * source image, which is the one thing a vehicle photograph cannot lose.
 *
 * ── The identity band ─────────────────────────────────────────────────
 * Make, model and year in Manrope at full foreground black, with the price
 * on the far right. This is the line someone reads to decide whether the
 * photograph is worth their attention, so nothing in it is greyed:
 * secondary colour on a primary line is how a card starts looking like a
 * database row.
 *
 * The price is the one coloured value on the card. Green because it is
 * money and because green is the only hue in this palette that is not
 * already spoken for — gold means Crownline, and a gold price would put
 * the brand accent on twelve cards at once. It is a deep, low-chroma green
 * (`--price`), chosen to read as considered rather than as a discount tag.
 *
 * ── The specification band ────────────────────────────────────────────
 * Transmission, fuel, engine and mileage in a 2×2 matrix — the four facts
 * a buyer sorts on at a glance. In Inter, one step down, in muted grey,
 * each behind a small line icon: the whole band is deliberately quieter
 * than the line above it, because it is reference material rather than the
 * pitch. Everything else — drive type, colours, location, the full
 * gallery — is one tap away on the vehicle page, and the brief is explicit
 * that a card carrying fifteen specifications is a spreadsheet row with a
 * picture on it.
 *
 * The values are printed without visible labels, which is how the brief's
 * own card sketch reads — "42,000 km" and "Automatic" need no caption. The
 * terms stay in the `<dl>` as `sr-only` `<dt>`s, so a screen reader still
 * announces "Mileage, 42,000 km" rather than four loose fragments, and the
 * icons are `aria-hidden` so they are never read as a fifth thing.
 *
 * Country of origin sits on the photograph rather than in that matrix. For
 * this business it is a differentiator rather than a detail — Japan and
 * Korea are the two sources the company is built around.
 *
 * Availability is not shown. Every vehicle reachable from this grid is
 * PUBLISHED, because `publicVehicleWhere` admits nothing else, so an
 * "Available" chip on all twelve cards would be a label that never varies.
 * A badge that is always the same value is noise, not information.
 *
 * ── Why the whole card is one link ────────────────────────────────────
 * Pressing anywhere on the card opens the vehicle. One target is far
 * easier to hit on a phone, which is where most of this audience is, and
 * it leaves the card with a single tab stop instead of competing ones.
 *
 * "Explore" is therefore drawn as a button but is not one: a real
 * `<button>` or second `<a>` inside this link would be invalid markup and
 * would fight the card for the tap. It is an `aria-hidden` span that
 * inherits the card's hover, so it reads as the affordance it looks like
 * while the link stays the only control. Its 8px radius against the card's
 * rounder corners is the geometric contrast the brief asks for between
 * something pressable and something merely informative.
 */
interface VehicleCardProps {
  vehicle: PublicVehicleCard
  /**
   * Passed to `next/image` so the browser can pick a source before layout
   * settles. Wrong values here cost real bandwidth on a slow connection —
   * the grid is 1 column on a phone, 2 at `sm`, 3 at `lg`.
   */
  sizes?: string
  /**
   * Opts this card's photograph out of lazy loading. Set it on the first
   * row only: those images are above the fold and lazy-loading them delays
   * the largest paint, while eager-loading the whole page fetches twelve
   * photographs nobody has scrolled to yet.
   */
  priority?: boolean
}

/**
 * The widest a card's photograph is ever asked to be, per breakpoint.
 *
 * At `lg` and above the catalogue caps its grid so three cards measure
 * roughly 310–330px whatever the screen width — so the third of the
 * viewport the old value claimed is now consistently more than the card
 * can use. 32vw covers the tightest case (a 1024px viewport, where the cap
 * has not engaged yet) with a little headroom, and stops wider screens
 * fetching a source a third larger than the slot it lands in.
 */
/**
 * What the browser needs to pick a source before layout settles.
 *
 * Tracks the catalogue grid: four columns from 1280px (a card is roughly a
 * quarter of the wide container, so ~24vw and never more than 400px), three
 * from 1024px, two from 640px, one below that. Overstating these costs real
 * bandwidth on exactly the connections the brief asks us to protect;
 * understating them ships a soft photograph to a desktop.
 *
 * The related-vehicles strip passes its own value — its cards are a fixed
 * width, not a fraction of the viewport.
 */
const CARD_IMAGE_SIZES =
  "(min-width: 1280px) min(24vw, 400px), (min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw"

export function VehicleCard({
  vehicle,
  sizes = CARD_IMAGE_SIZES,
  priority = false,
}: VehicleCardProps) {
  const name = `${vehicle.make} ${vehicle.model}`

  /**
   * The enum labels are looked up rather than printed raw.
   *
   * The DTO types these as `string` — the query layer widens them so a
   * customer-facing payload carries no Prisma enum types — so the lookup
   * needs a fallback. It should never fire, but printing `AUTOMATIC` in
   * shouting case on a listing is a worse failure than printing nothing
   * clever, so an unrecognised value falls through to itself rather than
   * to `undefined`.
   */
  const transmission = vehicle.transmission
    ? (TRANSMISSION_LABELS[vehicle.transmission as keyof typeof TRANSMISSION_LABELS] ?? vehicle.transmission)
    : null
  const fuel = vehicle.fuelType
    ? (FUEL_TYPE_LABELS[vehicle.fuelType as keyof typeof FUEL_TYPE_LABELS] ?? vehicle.fuelType)
    : null
  const country = vehicle.countryOfOrigin
    ? (COUNTRY_LABELS[vehicle.countryOfOrigin as keyof typeof COUNTRY_LABELS] ?? vehicle.countryOfOrigin)
    : null

  /**
   * The specification band, in its fixed order. A hidden fact arrives as null
   * from the query layer (Settings → Catalogue display, or the listing's own
   * hidden facts) and simply takes no cell.
   */
  const specs = [
    transmission ? { icon: Cog, label: "Transmission", value: transmission } : null,
    fuel ? { icon: Fuel, label: "Fuel", value: fuel } : null,
    vehicle.engineSize ? { icon: Bolt, label: "Engine", value: vehicle.engineSize } : null,
    vehicle.mileageKm !== null ? { icon: Gauge, label: "Mileage", value: formatMileage(vehicle.mileageKm) } : null,
    vehicle.currentLocation ? { icon: MapPin, label: "Location", value: vehicle.currentLocation } : null,
  ].filter((spec) => spec !== null)

  return (
    <Link
      href={`/cars/${vehicle.slug}`}
      // `h-full w-full` so that a card in a grid row stretches to the
      // tallest sibling rather than sizing to its own content — otherwise a
      // two-line model name leaves a short card with its price floating.
      className="block h-full w-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      /**
       * The heading inside already names the vehicle, and the price and
       * specifications are read after it, so the link needs no label of its
       * own. What it does need is for the year to be part of the accessible
       * name rather than a separate line a screen reader meets out of
       * context — hence the explicit label.
       */
      aria-label={`${vehicle.year !== null ? `${vehicle.year} ` : ""}${name} — ${
        vehicle.price !== null ? formatCurrency(vehicle.price) : "price on request"
      }`}
    >
      <Card interactive className="h-full gap-0 py-0">
        {/* Fixed 16:10 crop, so a portrait phone photograph and a wide
            press shot occupy exactly the same space and the grid stays on
            its rails. `media-frame` owns the overflow and the transition;
            the scale is applied to the image itself. */}
        <div className="media-frame aspect-[16/10]">
          {vehicle.photoUrl ? (
            <Image
              src={vehicle.photoUrl}
              alt={vehicle.photoAltText ?? (vehicle.year !== null ? `${vehicle.year} ${name}` : name)}
              fill
              sizes={sizes}
              priority={priority}
              className="object-cover group-hover/card:scale-[1.08]"
            />
          ) : (
            /**
             * A listing published before its photography arrived. Stated
             * plainly rather than papered over with a stock car: the brief
             * is emphatic that generic imagery is what makes a dealership
             * look invented, and an honest empty frame costs less trust
             * than a photograph of a vehicle that is not the one for sale.
             */
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
              <ImageOff aria-hidden="true" className="size-6" />
              <span className="text-small">Photographs coming soon</span>
            </div>
          )}

          {country ? (
            <Badge
              variant="secondary"
              className="absolute top-3 left-3 bg-background/85 backdrop-blur-sm"
            >
              {country}
            </Badge>
          ) : null}

          {/* Every vehicle in this grid is published, so this is reassurance
              rather than information; Settings can switch it off. */}
          {vehicle.showAvailability ? (
            <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
              Available
            </span>
          ) : null}
        </div>

        {/*
          `p-4 sm:p-5` — generous without pushing the photograph below the
          60% share it is meant to hold. `gap-0` on the Card, so the two
          bands' own spacing is the only spacing here.

          `@container` because the specification band has to adapt to how
          much room *this card* has, which is not what the viewport says.
          The same 390px phone gives the card 358px, while a 1100px laptop
          — three columns, below the catalogue's 72rem cap — gives it 332px
          and a 320px phone gives it 288px. Keying the adjustments below to
          screen width would tighten the roomiest case and leave the
          tightest one truncating, and it would break outright the moment a
          card is dropped into a narrower column somewhere else on the
          site.
        */}
        <div className="@container flex flex-1 flex-col p-4 sm:p-5">
          {/* ── Identity ─────────────────────────────────────────────
              Inter, not the Manrope the base layer gives an `<h3>`. Two
              reasons, and the second is the load-bearing one:

              Manrope's display proportions are drawn for headlines, and at
              card size a two-word vehicle name in it reads as a title
              rather than as a label on a product. Inter is the grotesque
              this design system already uses for everything factual, and
              the name of a car on a listing is a fact.

              More to the point, this line ends in a price. Manrope draws a
              dollar sign as a display glyph — a narrow stroked S that
              stops reading as currency once it sits beside four figures.
              Inter's is the conventional one, which is what a price on a
              car needs to be.

              Full foreground black: this is the line someone reads to
              decide whether the photograph is worth their attention, so
              nothing in it is greyed. The year keeps its own quieter
              treatment — a size down, lighter, slightly recessed — because
              it qualifies the name rather than competing with it.

              `min-w-0` lets a long model name truncate rather than shoving
              the price off the edge; the price is `shrink-0` because it is
              the one thing on this line that must never be clipped. */}
          <div className="flex items-baseline justify-between gap-3 font-sans">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              {/* h3 because the page supplies the h1 and the grid sits
                  under an h2 — the card must not restart the outline. */}
              <h3 className="truncate font-sans text-title font-semibold text-foreground">
                {name}
              </h3>
              {vehicle.year !== null ? (
                <span className="tabular text-body font-normal text-foreground/60">
                  {vehicle.year}
                </span>
              ) : null}
            </div>

            {vehicle.price !== null ? (
              <span className="tabular shrink-0 text-title font-bold text-price">
                {formatCurrency(vehicle.price)}
              </span>
            ) : (
              <span className="shrink-0 text-small font-medium text-muted-foreground">Price on request</span>
            )}
          </div>

          {/* ── Specifications ───────────────────────────────────────
              `mt-auto` pushes this band to the bottom edge, so cards with
              differing title lengths still line their specifications and
              their Explore cues up across a row. The hairline is this
              block's own top border rather than a separate element —
              same reading, one node less, and it can never drift away
              from the content it separates. */}
          <div className="mt-auto flex items-end justify-between gap-4 border-t border-border pt-5 @max-[322px]:gap-2 @max-[288px]:flex-col @max-[288px]:items-stretch @max-[288px]:gap-4">
            {/*
              Content-sized columns, not `grid-cols-2`.

              Two equal halves spend the same width on "2.0L" as on
              "Automatic", and in a three-column row that waste is exactly
              enough to truncate the longest transmission label while half
              the engine column sits empty. `auto` columns give each one
              the width its own longest value needs and hand the slack to
              the Explore cue instead, while still aligning row two under
              row one, which is what makes this read as a matrix rather
              than as four loose labels.

              `min-w-0` on the items keeps `truncate` as the fallback for a
              value longer than anything in the current inventory, rather
              than letting one overflow the card.

              Two container steps below that. Note the thresholds are in
              *content-box* terms — a container query measures the
              container's content box, so a 332px card with 20px of padding
              each side queries as 292px, not 332px.

              At 322px of content the generous gaps close up, buying back
              the ~36px that "Automatic" beside "250,000 km" needs.
              Narrow rules on purpose: spending that everywhere to satisfy
              the tightest column would cost every other visitor the
              breathing room this band was widened for.

              At 288px no arrangement of gaps fits both, so the cue drops
              below the matrix and takes the full width. That happens where
              a grid or a strip has already given every card the same
              narrow column, so they all do it at once and the row stays
              uniform — a phone-width card in the "You may also like"
              strip is the common case, and a full-width gold button is a
              better thing to hand a thumb anyway.

              Both numbers were set by measurement, not arithmetic: every
              card is rendered with the longest value each specification
              can hold ("Automatic", "Electric", "250,000 km") and swept
              across seventeen viewport widths on both surfaces. Change one
              and re-run that sweep — the bands are only a few pixels wider
              than the text they have to hold.
            */}
            {specs.length > 0 ? (
              <dl className="grid min-w-0 flex-1 grid-cols-[auto_auto] justify-start gap-x-6 gap-y-3 @max-[322px]:gap-x-2 @max-[322px]:gap-y-2.5">
                {specs.map((spec) => (
                  <Spec key={spec.label} icon={spec.icon} label={spec.label} value={spec.value} />
                ))}
              </dl>
            ) : null}

            <ExploreCue className={specs.length === 0 ? "ml-auto" : undefined} />
          </div>
        </div>
      </Card>
    </Link>
  )
}

/**
 * The card's call to action — drawn as a button, deliberately not one.
 *
 * See the note on the card above for why this is a span: the whole card is
 * the link, and a nested control would be invalid markup and a competing
 * tap target. `aria-hidden` keeps it out of the accessibility tree, where
 * the link's own label already says where it goes.
 *
 * Filled in `--gold-bright` at rest rather than tinted and outlined. The
 * champagne fill used across the rest of the site is tuned to sit quietly
 * over large surfaces, and at this size it read as a dull tan chip that a
 * customer could mistake for a badge. This is the one element on the card
 * that has to say "press me" on its own, so it takes the brighter gold and
 * dark ink, at a full 12.8:1, and carries the gold bloom from the palette
 * so it reads as raised rather than as printed.
 *
 * The card's hover deepens the bloom and moves the arrow. It does not
 * change the fill: the button is already the loudest thing in the band,
 * and something that is gold at rest and *more* gold on hover reads as a
 * colour change rather than as an invitation.
 */
function ExploreCue({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        className,
        "eyebrow inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5",
        "@max-[322px]:px-2",
        "bg-gold-bright text-gold-bright-foreground shadow-[var(--shadow-gold)]",
        "transition-[box-shadow,transform,translate,scale] duration-slow ease-crownline-soft",
        "group-hover/card:shadow-[var(--shadow-gold-strong)]"
      )}
    >
      Explore
      <ArrowRight className="size-3.5 transition-transform duration-slow ease-crownline-soft group-hover/card:translate-x-1" />
    </span>
  )
}

/**
 * One specification, in the 2×2 matrix.
 *
 * A `<dl>` rather than stacked divs: these genuinely are term-and-value
 * pairs, and the markup saying so is what lets a screen reader read
 * "Mileage, 42,000 km" instead of four unrelated fragments. The term is
 * `sr-only` because the value speaks for itself in print — see the note on
 * the card above.
 *
 * The icon is decorative and marked as such. It is a recognition aid for
 * someone scanning a grid, not information: every value here is already
 * self-describing in words, and an icon announced as "cog" would add a
 * fifth thing to read for no gain.
 *
 * Deliberately faint — 12px at 40% of the muted foreground, a hairline
 * stroke at the bottom of the card's visual hierarchy. At 14px and 65% the
 * four of them formed a column of dark marks that pulled the eye before
 * the vehicle's name and price did, which inverts what the card is for.
 * The mark should be findable when someone is scanning for "which of these
 * is the mileage" and invisible the rest of the time.
 */
function Spec({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    // The icon lives inside the <dd>, not beside it: a <div> grouping
    // inside a <dl> may contain only <dt> and <dd>, so an <svg> as a third
    // child would be invalid markup.
    <div className="flex min-w-0 items-center">
      <dt className="sr-only">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 font-sans text-small text-muted-foreground @max-[322px]:gap-1.5">
        <Icon
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-3 shrink-0 text-muted-foreground/40"
        />
        <span className="tabular truncate">{value}</span>
      </dd>
    </div>
  )
}
