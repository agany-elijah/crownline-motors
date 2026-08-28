import { cn } from "@/lib/utils"

/**
 * Keyboard skip link.
 *
 * Visually hidden until focused, then pinned to the top-left. It is the
 * first thing in the tab order, so a keyboard or screen-reader user can
 * jump straight past the eight main nav items to the page content instead
 * of tabbing through the whole header on every single page.
 *
 * Uses `sr-only` + `focus:not-sr-only` rather than `display: none`, which
 * would remove it from the tab order entirely and defeat the purpose.
 */
function SkipLink({ className }: { className?: string }) {
  return (
    <a
      href="#main-content"
      className={cn(
        "sr-only focus:not-sr-only",
        "focus:fixed focus:top-3 focus:left-3 focus:z-100",
        "focus:rounded-lg focus:bg-foreground focus:px-4 focus:py-2.5",
        "focus:text-small focus:font-medium focus:text-background",
        "focus:shadow-[var(--shadow-raised)]",
        className
      )}
    >
      Skip to content
    </a>
  )
}

export { SkipLink }
