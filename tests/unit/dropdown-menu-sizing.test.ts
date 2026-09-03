import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * The shared dropdown menu must not size itself out of its own contents.
 *
 * ── The defect this guards ────────────────────────────────────────────
 * `DropdownMenuContent` shipped with `max-h-(--available-height)` beside
 * `overflow-y-auto`. Base UI defines that variable as the gap between the
 * trigger and the edge of the viewport, so the pair silently shrank the menu
 * to whatever room happened to sit under the button and scrolled the rest
 * out of sight.
 *
 * The compounding half is what made it hard to spot: a positioner decides
 * whether to flip a panel to the opposite side by measuring overflow, and a
 * panel pre-clamped to the space available can never overflow. The flip
 * never fired, so the menu stayed squashed rather than opening upwards where
 * it fitted whole.
 *
 * It reached a user as a photograph's ⋯ menu offering two of its five
 * actions on a desktop window and all five on a phone — same component, same
 * props, different amount of room beneath the trigger. A menu that hides
 * actions depending on scroll position is worse than one that is simply
 * short, because nothing about it looks broken.
 *
 * ── Why a source assertion rather than a rendered one ─────────────────
 * The bug is entirely in CSS that only a real layout engine resolves;
 * jsdom computes no geometry, so a render test would pass against the
 * broken class list. Asserting on the class list is the honest scope — it
 * cannot prove the menu positions correctly, only that the two declarations
 * known to break it have not come back, which is what a copy-paste from
 * Select or a component-library update would reintroduce.
 */

const CONTENT = readFileSync(
  path.join(process.cwd(), "src/components/ui/dropdown-menu.tsx"),
  "utf8"
)

/** Just the popup's class list, so a mention in a comment is not a match. */
function popupClasses(): string {
  const match = CONTENT.match(/data-slot="dropdown-menu-content"\s*\n\s*className={cn\("([^"]*)"/)

  expect(match, "could not find the dropdown popup's class list").not.toBeNull()

  return match![1]
}

describe("dropdown menu panel sizing", () => {
  it("does not clamp its height to the space beneath the trigger", () => {
    expect(popupClasses()).not.toContain("max-h-(--available-height)")
  })

  it("still caps its height, so a menu taller than the screen scrolls", () => {
    // The cap is what stops the last-resort case running off the page. It is
    // `svh` on purpose: a mobile browser's collapsing toolbar makes `vh`
    // larger than what is actually on screen.
    expect(popupClasses()).toMatch(/max-h-\[\d+svh\]/)
  })

  it("does not size itself to the trigger's width", () => {
    // A dropdown trigger is routinely an icon button — the photo tile's is
    // 32px square — and a menu of labelled actions sized to it is unreadable.
    // That variable belongs to Select, where matching the trigger is the point.
    expect(popupClasses()).not.toContain("w-(--anchor-width)")
  })

  it("keeps a floor and a viewport-aware ceiling on its width", () => {
    const classes = popupClasses()

    expect(classes).toContain("min-w-32")
    expect(classes).toMatch(/max-w-\[calc\(100vw-/)
  })
})
