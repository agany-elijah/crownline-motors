import { z } from "zod"

import { normalizeHiddenFields } from "@/lib/visibility/product-visibility"

/**
 * A listing's `hiddenFields`, as the admin forms submit it: one hidden input
 * holding a JSON array of field keys.
 *
 * Absent or empty means nothing is hidden. Anything that is not an array of
 * known keys is refused rather than cleaned up — a malformed value here is a
 * crafted request, not an operator's typo, and silently dropping part of it
 * could publish a fact somebody meant to withhold.
 */
export function hiddenFieldsField<const F extends string>(fields: readonly F[]) {
  const known = new Set<string>(fields)

  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((value, ctx): F[] => {
      if (!value) return []

      let parsed: unknown
      try {
        parsed = JSON.parse(value)
      } catch {
        parsed = undefined
      }

      if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string" || !known.has(entry))) {
        ctx.addIssue({ code: "custom", message: "The visibility choices could not be read. Reload and try again." })
        return z.NEVER
      }

      return normalizeHiddenFields(fields, parsed)
    })
}
