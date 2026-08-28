"use client"

import * as React from "react"

interface UseRevealOptions {
  /** Fraction of the element that must be visible. Left at 0 by default:
   *  a section taller than the viewport can never satisfy a fractional
   *  threshold, so it would silently never reveal. */
  threshold?: number
  /** Negative bottom inset so the reveal fires a little *before* the
   *  element reaches the fold, letting the transition finish as it
   *  arrives rather than starting once it is already in view. */
  rootMargin?: string
}

/**
 * Reveals an element once, the first time it scrolls into view.
 *
 * The reveal is deliberately one-way — the observer disconnects on the
 * first intersection, so content never re-animates or fades back out when
 * the user scrolls up past it again. The brief calls this out explicitly,
 * and it is also what stops a long page from feeling twitchy.
 *
 * The visual transition itself lives entirely in CSS (see the
 * `[data-reveal]` block in globals.css, which is scoped to browsers with
 * scripting enabled and no reduced-motion preference). This hook only
 * flips the state — so if these styles are inert for a given visitor, the
 * content is simply visible and nothing here needs to know.
 */
export function useReveal<T extends HTMLElement>({
  threshold = 0,
  rootMargin = "0px 0px -8% 0px",
}: UseRevealOptions = {}) {
  const ref = React.useRef<T>(null)
  const [isRevealed, setIsRevealed] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node || isRevealed) return

    // Older browsers without IntersectionObserver get the content
    // immediately rather than an element stuck at opacity 0.
    //
    // Deferred to a microtask rather than called straight from the effect
    // body: a synchronous setState here would run during commit and force
    // an immediate cascading re-render. It also cannot be folded into the
    // initial useState value, because the server has no
    // IntersectionObserver either — branching on it during render would
    // make the first client render disagree with the server's HTML and
    // break hydration.
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setIsRevealed(true))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          setIsRevealed(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, rootMargin, isRevealed])

  return { ref, isRevealed }
}
