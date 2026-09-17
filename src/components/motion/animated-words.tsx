import { cn } from "@/lib/utils"
import { WORD_STEP_MS, delay } from "@/components/motion/motion"

/**
 * Text that rises into place one word at a time, each word from behind its
 * own mask.
 *
 * Server-rendered: the words are ordinary text in the markup, so the heading
 * reads correctly to a crawler and a screen reader, and with motion reduced
 * (or before any script runs) it is simply the finished sentence. The spaces
 * between words stay real text nodes, so copying the heading copies a
 * sentence rather than a run-together string.
 *
 * `trigger="load"` plays on first paint — for the hero only. `"view"` waits
 * for the nearest InView ancestor.
 */
export function AnimatedWords({
  text,
  trigger = "view",
  startDelay = 0,
  step = WORD_STEP_MS,
  wordClassName,
}: {
  text: string
  trigger?: "load" | "view"
  /** Milliseconds before the first word moves. */
  startDelay?: number
  step?: number
  /** Applied to each word, e.g. the gold sheen on the hero's last line. */
  wordClassName?: string
}) {
  const words = text.trim().split(/\s+/)

  return (
    <>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          {/* The mask. Bottom padding and a matching negative margin give
              descenders room inside the clip without changing line height. */}
          <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
            <span
              className={cn(
                "inline-block will-change-transform",
                trigger === "load" ? "load-word" : "rv-word",
                wordClassName
              )}
              style={delay(startDelay + index * step)}
            >
              {word}
            </span>
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  )
}

/** How long a phrase takes to finish starting, for chaining a second phrase after it. */
export function wordsDuration(text: string, step: number = WORD_STEP_MS): number {
  return text.trim().split(/\s+/).length * step
}
