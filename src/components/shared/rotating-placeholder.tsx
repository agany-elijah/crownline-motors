"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A placeholder that cycles through the things people actually search for.
 *
 * ── What it is for ────────────────────────────────────────────────────
 * An empty search box is a question with no examples. "Part name or number"
 * describes the field; it does not tell a customer that typing half a
 * stamping off an old casting will work, or that the box understands a model
 * name as readily as a part number. Showing real examples, one after another,
 * teaches the control in the two seconds someone spends deciding whether to
 * use it — which on a catalogue with a search-first layout is the difference
 * between a customer searching and a customer scrolling.
 *
 * ── Why this is not the `placeholder` attribute ───────────────────────
 * A native placeholder cannot be animated: swapping the attribute makes the
 * text jump, with no way to cross-fade between two values. So the visible
 * placeholder is a real element layered over the field, and the input's own
 * `placeholder` is set to a single space by the caller.
 *
 * That space is load-bearing. `:placeholder-shown` only matches when a
 * placeholder attribute is actually present and the field is empty, and it is
 * what hides this overlay the moment somebody types — in CSS, with no state
 * and no re-render per keystroke. An empty attribute would never match and the
 * overlay would sit on top of the customer's own text.
 *
 * ── It degrades to a plain placeholder ────────────────────────────────
 * The server renders the first suggestion, and so does the first client
 * render — so there is no hydration mismatch, and with JavaScript unavailable
 * or still loading the field shows one honest example rather than nothing. The
 * rotation is the enhancement; the first frame is the baseline.
 *
 * ── Motion ────────────────────────────────────────────────────────────
 * A short rise-and-fade per swap, at the design system's own timings, on a
 * four-second dwell. Fast enough to read, slow enough that the eye is not
 * pulled back to it — the brief's "the user should never think *that website
 * has lots of animations*". It stops entirely while the field has focus: once
 * somebody is typing, a moving hint beside the caret is a distraction, not a
 * suggestion. `prefers-reduced-motion` pins it to the first suggestion.
 */
interface RotatingPlaceholderProps {
  /**
   * The examples, in order. The first is what the server renders and what a
   * reduced-motion or no-JavaScript visitor sees, so it should be the single
   * most representative one rather than the cleverest.
   */
  suggestions: readonly string[]
  /** Words before the rotating part — "Search", "Try". Rendered quieter. */
  prefix?: string
  /** True while the field has focus. Freezes the rotation. */
  paused?: boolean
  className?: string
}

/** How long each suggestion holds before the next one rises. */
const DWELL_MS = 4000

const MOTION_QUERY = "(prefers-reduced-motion: no-preference)"

/**
 * The `prefers-reduced-motion` media query, as an external store.
 *
 * Declared at module scope so the three functions keep a stable identity
 * across renders — `useSyncExternalStore` resubscribes whenever `subscribe`
 * changes, and an inline closure would tear the listener down and rebuild it
 * on every render of every search box on the page.
 */
function subscribeToMotionPreference(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {}

  const query = window.matchMedia(MOTION_QUERY)
  query.addEventListener("change", onChange)

  return () => query.removeEventListener("change", onChange)
}

function getMotionPreference(): boolean {
  if (typeof window.matchMedia !== "function") return false

  return window.matchMedia(MOTION_QUERY).matches
}

/** Used for the server render *and* for hydration, so the two agree. */
function getServerMotionPreference(): boolean {
  return false
}

export function RotatingPlaceholder({
  suggestions,
  prefix,
  paused = false,
  className,
}: RotatingPlaceholderProps) {
  const [index, setIndex] = React.useState(0)

  /**
   * Whether motion is welcome.
   *
   * `useSyncExternalStore` rather than state synced from an effect. A media
   * query *is* an external store — a value that lives outside React with its
   * own change events — and this is the API built for one: it reads the
   * server's answer during SSR and hydration, then switches to the live one,
   * so there is no mismatch and no render committed only to be corrected by
   * an effect a frame later.
   *
   * The server snapshot is `false`, which is the conservative reading: a
   * reduced-motion visitor sees the first suggestion and never a swap, and
   * the rotation only ever starts once the browser has confirmed it is wanted.
   */
  const mayAnimate = React.useSyncExternalStore(
    subscribeToMotionPreference,
    getMotionPreference,
    getServerMotionPreference
  )

  React.useEffect(() => {
    // One suggestion is a static hint, not a rotation — and an interval that
    // sets the same index forever is a wasted timer on a phone.
    if (!mayAnimate || paused || suggestions.length < 2) return

    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % suggestions.length),
      DWELL_MS
    )

    return () => window.clearInterval(timer)
  }, [mayAnimate, paused, suggestions.length])

  /**
   * Guarded against the list shrinking under a held index — a caller passing
   * a shorter array on a later render would otherwise read past its end and
   * render `undefined`.
   */
  const current = suggestions[index % suggestions.length] ?? suggestions[0] ?? ""

  return (
    <span
      // Decorative: the field it belongs to carries its own label, and a
      // screen reader announcing a hint that changes every four seconds would
      // interrupt whatever the user was doing.
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-0 flex items-center gap-1",
        "truncate text-muted-foreground",
        // The whole reason the input keeps a single-space placeholder: this
        // is what gets out of the way the instant somebody types, without a
        // state update or a re-render.
        "opacity-0 transition-opacity duration-fast peer-placeholder-shown:opacity-100",
        className
      )}
    >
      {prefix ? <span className="shrink-0">{prefix}</span> : null}

      {/*
        Keyed by the suggestion so React replaces the node on each swap and
        replays the entrance. Without the key it would patch the text in place
        and the animation would never run a second time.

        `overflow-hidden` on the clip so the rising word appears from behind
        the line rather than sliding in over the field's own border.
      */}
      <span className="relative min-w-0 overflow-hidden">
        <span
          key={current}
          className={cn(
            "block truncate font-medium text-foreground/55",
            mayAnimate && "duration-base ease-crownline animate-in fade-in-0 slide-in-from-bottom-2"
          )}
        >
          {current}
        </span>
      </span>
    </span>
  )
}
