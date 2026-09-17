import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, CarFront, LayoutGrid } from "lucide-react"

import { cn } from "@/lib/utils"
import { Container } from "@/components/layout/container"
import { InView } from "@/components/motion/in-view"
import { HomeSectionHeading } from "@/components/home/section-heading"
import { ITEM_STEP_MS, delay } from "@/components/motion/motion"

/** Columns the closing tile spans, keyed by how many tiles precede it in its row. */
const CLOSING_SPAN_SM: Record<number, string> = { 0: "col-span-2", 1: "col-span-1" }
const CLOSING_SPAN_LG: Record<number, string> = {
  0: "lg:col-span-4",
  1: "lg:col-span-3",
  2: "lg:col-span-2",
  3: "lg:col-span-1",
}

export interface CategoryTile {
  key: string
  label: string
  href: string
  count: number
  photoUrl: string | null
}

/**
 * Ways into the inventory, built from what is actually on sale.
 *
 * Body types when listings carry them; makes otherwise — both are counts of
 * published vehicles, so no tile ever opens onto an empty catalogue. The
 * closing "All vehicles" tile is the way out for anyone whose shape of car
 * is not a tile.
 */
export function BrowseCategories({
  mode,
  tiles,
  totalVehicles,
}: {
  mode: "bodyType" | "make"
  tiles: CategoryTile[]
  totalVehicles: number
}) {
  if (tiles.length === 0) return null

  return (
    <section aria-labelledby="home-browse-heading" className="bg-night py-20 md:py-28">
      <Container size="wide">
        <InView className="flex flex-col gap-12">
          <HomeSectionHeading
            id="home-browse-heading"
            icon={LayoutGrid}
            label="Browse the inventory"
            lead="Browse by"
            accent={mode === "bodyType" ? "body type." : "make."}
            description={
              mode === "bodyType"
                ? "Start from the kind of vehicle you need — every category below is in stock now."
                : "Start from the make you trust — every one below has vehicles for sale now."
            }
          />

          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {tiles.map((tile, index) => (
              <li key={tile.key} className="rv-up" style={delay(350 + index * ITEM_STEP_MS)}>
                <CategoryCard tile={tile} />
              </li>
            ))}
            {/* Spans whatever is left of its row, so the grid never ends on a
                lone tile — two columns on a phone, four on a laptop. */}
            <li
              className={cn("rv-up", CLOSING_SPAN_SM[tiles.length % 2], CLOSING_SPAN_LG[tiles.length % 4])}
              style={delay(350 + tiles.length * ITEM_STEP_MS)}
            >
              <CategoryCard
                tile={{ key: "all", label: "All vehicles", href: "/cars", count: totalVehicles, photoUrl: null }}
                emphasis
              />
            </li>
          </ul>
        </InView>
      </Container>
    </section>
  )
}

function CategoryCard({ tile, emphasis = false }: { tile: CategoryTile; emphasis?: boolean }) {
  return (
    <Link
      href={tile.href}
      className={cn(
        "group/cat relative isolate flex h-full min-h-56 flex-col justify-end overflow-hidden rounded-2xl border p-5 sm:min-h-60 sm:p-6",
        "transition-[border-color,translate,box-shadow] duration-slow ease-crownline-soft",
        "hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_oklch(0_0_0/0.8)]",
        emphasis
          ? "border-gold/35 bg-gradient-to-br from-gold/20 via-card to-card hover:border-gold/70"
          : "border-white/10 bg-card hover:border-gold/45"
      )}
    >
      {tile.photoUrl ? (
        <div aria-hidden="true" className="media-frame absolute inset-0 -z-10">
          <Image
            src={tile.photoUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 300px, 50vw"
            className="object-cover group-hover/cat:scale-[1.08]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-night via-night/60 to-night/5" />
        </div>
      ) : (
        <CarFront
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -z-10 size-24 -translate-x-1/2 -translate-y-2/3 text-white/[0.06] transition-[scale,color] duration-slow ease-crownline-soft group-hover/cat:scale-110 group-hover/cat:text-gold/15"
        />
      )}

      <span
        aria-hidden="true"
        className={cn(
          "absolute top-4 right-4 grid size-10 place-items-center rounded-full border backdrop-blur-md",
          "transition-[background-color,border-color,color,rotate] duration-slow ease-crownline-soft",
          "border-white/20 bg-night/40 text-white group-hover/cat:rotate-45 group-hover/cat:border-gold group-hover/cat:bg-gold group-hover/cat:text-gold-foreground"
        )}
      >
        <ArrowUpRight className="size-4" />
      </span>

      <h3 className="font-heading text-title text-white">{tile.label}</h3>
      <p className="mt-1 text-small text-white/65">
        <span className="tabular">{tile.count}</span> {tile.count === 1 ? "vehicle" : "vehicles"}
      </p>
      {/* A gold rule that draws itself under the label on hover. */}
      <span
        aria-hidden="true"
        className="mt-4 block h-0.5 w-12 origin-left scale-x-50 rounded-full bg-gold/60 transition-[scale,background-color] duration-slow ease-crownline-soft group-hover/cat:scale-x-100 group-hover/cat:bg-gold"
      />
    </Link>
  )
}
