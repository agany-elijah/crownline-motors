"use client"

import * as React from "react"

import { useReveal } from "@/hooks/use-reveal"

/**
 * Marks a region of the homepage as revealed the first time it scrolls into
 * view, by flipping `data-inview` to "true".
 *
 * It animates nothing itself. Every `.rv-*` element inside it animates in CSS
 * off that one attribute (see "Homepage motion" in globals.css), which keeps
 * this the only client code a section needs — the section, its copy and its
 * data stay server-rendered.
 *
 * Do not nest one inside another: an unrevealed inner region would be matched
 * through its revealed parent and appear early.
 */
export function InView({
  as: Element = "div",
  className,
  children,
}: {
  as?: "div" | "ol" | "ul"
  className?: string
  children: React.ReactNode
}) {
  // Fires a little before the region reaches the fold, so the movement is
  // finishing as it arrives rather than starting once it is already there.
  const { ref, isRevealed } = useReveal<HTMLElement>({ rootMargin: "0px 0px -12% 0px" })

  return (
    <Element
      ref={ref as React.Ref<never>}
      data-inview={isRevealed ? "true" : ""}
      className={className}
    >
      {children}
    </Element>
  )
}
