import Link from "next/link"

import { cn } from "@/lib/utils"

interface NavLinkProps {
  href: string
  label: string
  active: boolean
  /** False renders the item as plain text with a "Soon" marker instead of
   *  a link. See NavLink.available in lib/constants/nav-links.ts. */
  available?: boolean
  /** Which surface the link is sitting on. Drives the resting text colour
   *  only — the gold hover and underline adapt on their own, because
   *  `--gold-ink` is re-pointed at the fill gold inside `[data-tone="dark"]`
   *  (see globals.css). */
  tone?: "light" | "dark"
  className?: string
  onNavigate?: () => void
}

/**
 * A main-navigation link: the label turns gold on hover and a gold rule draws
 * itself in beneath it from the left. The rule stays drawn while the route is
 * active.
 *
 * The label never moves. An earlier version swapped in a second, gold copy of
 * the label from below, which read as the word flipping rather than changing
 * colour; the dealership asked for the colour change and the line alone.
 */
export function NavLink({
  href,
  label,
  active,
  available = true,
  tone = "light",
  className,
  onNavigate,
}: NavLinkProps) {
  if (!available) {
    // Deliberately not a disabled <a> or a link with preventDefault. An
    // anchor without a working destination is still announced as a link and
    // still invites a tap; plain text with a visible marker tells both a
    // sighted visitor and a screen reader the same true thing — this
    // section exists but is not open yet.
    return (
      <span
        className={cn(
          "flex items-center gap-2 py-1 text-small font-medium whitespace-nowrap",
          // Light surface: full --muted-foreground. Fading it further put
          // "Spare Parts" at 2.5:1 in the header — unavailable is not the
          // same as unreadable.
          tone === "dark" ? "text-white/55" : "text-muted-foreground",
          className
        )}
      >
        {label}
        <span
          className={cn(
            "rounded-4xl border px-1.5 py-px text-[0.625rem] font-semibold tracking-[0.08em] uppercase",
            tone === "dark"
              ? "border-white/20 text-white/50"
              : "border-border text-muted-foreground"
          )}
        >
          Soon
        </span>
      </span>
    )
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "relative block py-1",
        // whitespace-nowrap is required, not cosmetic: without it "Spare
        // Parts", "How It Works" and "Track My Order" break onto a second
        // line at xl and the header grows to two rows.
        "text-small font-medium whitespace-nowrap",
        "transition-colors duration-fast ease-crownline",
        // The gold rule, drawn in from the left beneath the label.
        "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-gold-ink",
        "after:transition-transform after:duration-fast after:ease-crownline",
        active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
        active
          ? "text-gold-ink"
          : tone === "dark"
            ? "text-white/80 hover:text-gold-ink"
            : "text-muted-foreground hover:text-gold-ink",
        className
      )}
    >
      {label}
    </Link>
  )
}
