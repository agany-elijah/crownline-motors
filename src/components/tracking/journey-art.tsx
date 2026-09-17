"use client"

import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { JOURNEY_ICONS } from "@/components/tracking/journey-icons"
import type { JourneyIcon } from "@/lib/tracking/customer-journey"

/**
 * The picture for a journey phase: a photograph when one has been added under
 * `public/images/journey/`, and a quiet gold-on-charcoal icon plate when it has
 * not.
 *
 * The plate is always rendered underneath, and the photograph fades in over it
 * only once it has actually loaded — so a phase without a photograph never
 * flashes a broken image, and adding the file is all it takes to show one.
 */
export function JourneyArt({
  image,
  icon,
  sizes,
  className,
  iconClassName,
}: {
  image: string
  icon: JourneyIcon
  sizes: string
  className?: string
  iconClassName?: string
}) {
  const [state, setState] = React.useState<"loading" | "loaded" | "missing">("loading")
  const Icon = JOURNEY_ICONS[icon]

  return (
    <div
      data-tone="dark"
      className={cn(
        "relative isolate overflow-hidden bg-[radial-gradient(120%_90%_at_30%_20%,oklch(0.3_0.02_85),oklch(0.16_0.005_85))]",
        className
      )}
    >
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/25">
          <Icon className={cn("size-6 text-gold", iconClassName)} strokeWidth={1.5} />
        </span>
      </div>

      {state !== "missing" ? (
        <Image
          src={image}
          alt=""
          fill
          sizes={sizes}
          onLoad={() => setState("loaded")}
          onError={() => setState("missing")}
          className={cn(
            "object-cover transition-[opacity,scale] duration-slow ease-crownline-soft",
            state === "loaded" ? "opacity-100" : "opacity-0"
          )}
        />
      ) : null}
    </div>
  )
}
