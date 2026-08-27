import * as React from "react"

import { cn } from "@/lib/utils"

// Three widths only — matches the brief's instruction to keep the system
// disciplined rather than letting pages invent arbitrary max-widths.
const containerSizes = {
  narrow: "max-w-3xl", // single-column content: contact form, get-a-quote form
  default: "max-w-7xl", // standard content: catalogue grids, page bodies
  wide: "max-w-[1600px]", // hero imagery, galleries — photography-first sections
} as const

type ContainerSize = keyof typeof containerSizes

function Container({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: ContainerSize }) {
  return (
    <div
      data-slot="container"
      data-size={size}
      className={cn(
        // Gutters widen at xl instead of staying flat — small deliberate
        // detail that reads as "premium" rather than a generic template.
        "mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12",
        containerSizes[size],
        className
      )}
      {...props}
    />
  )
}

export { Container, containerSizes }
export type { ContainerSize }