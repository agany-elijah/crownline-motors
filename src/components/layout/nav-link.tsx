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
 * A main-navigation link with a vertical label swap on hover.
 *
 * The label is rendered twice inside a clipping box: the resting copy
 * slides up and out while an identical gold copy slides in from below, so
 * the item reads as one piece of type rotating rather than as text
 * changing colour. Paired with a gold rule that wipes in from the left,
 * and which stays put while the route is active.
 *
 * Three details that matter:
 *
 * - The second copy is `aria-hidden`. Without it every nav item would be
 *   announced twice by a screen reader, and the accessible name of the
 *   link would be the label duplicated.
 *
 * - The clip box sets no explicit height. It inherits the full line box,
 *   which already includes descender space — pinning a tighter height here
 *   would shear the tail off the "p" in "Spare Parts". The incoming copy is
 *   offset by `translate-y-full`, i.e. exactly one line box, so it starts
 *   flush below the visible edge at any font size.
 *
 * - Both transitions run at --duration-fast. The global reduced-motion
 *   rule collapses them, in which case the gold copy simply appears — the
 *   hover state stays fully legible without the movement.
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
          tone === "dark" ? "text-white/40" : "text-muted-foreground/60",
          className
        )}
      >
        {label}
        <span
          className={cn(
            "rounded-4xl border px-1.5 py-px text-[0.625rem] font-semibold tracking-[0.08em] uppercase",
            tone === "dark"
              ? "border-white/20 text-white/50"
              : "border-border text-muted-foreground/70"
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
        "group/nav relative block py-1",
        // whitespace-nowrap is required, not cosmetic: without it "Spare
        // Parts", "How It Works" and "Track My Order" break onto a second
        // line at xl and the header grows to two rows.
        "text-small font-medium whitespace-nowrap",
        "transition-colors duration-fast ease-crownline",
        // The gold rule. Sits on the link itself rather than on the clip
        // box below, so it spans the full label without being clipped.
        "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-gold-ink",
        "after:transition-transform after:duration-fast after:ease-crownline",
        active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
        active
          ? "text-gold-ink"
          : tone === "dark"
            ? "text-white/80 hover:text-white"
            : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <span className="relative block overflow-hidden">
        <span
          className={cn(
            "block transition-transform duration-fast ease-crownline",
            // An active item has nowhere better to go — it is already gold,
            // so swapping it for another gold copy would read as a twitch.
            !active && "group-hover/nav:-translate-y-full"
          )}
        >
          {label}
        </span>

        {!active && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-0 block translate-y-full text-gold-ink",
              "transition-transform duration-fast ease-crownline",
              "group-hover/nav:translate-y-0"
            )}
          >
            {label}
          </span>
        )}
      </span>
    </Link>
  )
}
