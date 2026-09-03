import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * The project's own type scale, as font-size utilities.
 *
 * These are declared in globals.css as Tailwind v4 `--text-*` theme tokens,
 * which is what makes `text-h1`, `text-small` and friends real font-size
 * utilities in the generated CSS.
 *
 * ── Why tailwind-merge has to be told about them ──────────────────────
 * tailwind-merge does not read the CSS theme. It ships with the *default*
 * Tailwind scale (`text-xs` … `text-9xl`) and classifies any other
 * `text-<something>` as a **text colour**, because that is what an unknown
 * value after `text-` almost always is.
 *
 * So `text-small` was being filed as a colour, and `cn()` treated it as
 * conflicting with the colour beside it — dropping the earlier one. The
 * button primitive composes `text-foreground` (from the `outline` variant)
 * ahead of `text-small` (from the `lg` size), so every outline button was
 * emitted with a background and *no* colour of its own, silently inheriting
 * whatever the surrounding surface set.
 *
 * On a light page that inherited colour is dark and the bug is invisible.
 * In the dark mobile navigation drawer it inherits `text-background`, and
 * the WhatsApp button rendered as white text on a white fill — a primary
 * call to action that was, in practice, blank on every phone.
 *
 * Registering the scale here fixes it at the cause rather than at the one
 * place it happened to show: the utilities are now known to be font sizes,
 * so they no longer collide with colours anywhere in the codebase.
 *
 * Keep this list in step with the `--text-*` tokens in globals.css. A size
 * added there and forgotten here does not error — it quietly starts
 * cannibalising text colours again.
 */
const TYPE_SCALE = [
  "display",
  "h1",
  "h2",
  "h3",
  "title",
  "body-lg",
  "body",
  "small",
  "meta",
] as const

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TYPE_SCALE] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
