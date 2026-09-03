import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * A withdrawn vehicle must answer with a real 404, not a soft one.
 *
 * ── The defect this guards ────────────────────────────────────────────
 * `loading.tsx` opens a Suspense boundary over its own segment and every
 * segment beneath it. One placed at the top of `(public)` covered the whole
 * site, including `/cars/[slug]`.
 *
 * Once a boundary suspends, Next has already flushed the document shell and
 * committed the HTTP status with it. `notFound()` running afterwards could
 * still render the 404 page, but could no longer change the response from
 * `200 OK`. Every sold, archived or draft vehicle URL therefore returned
 * success plus not-found content — a soft 404, which is precisely how a car
 * that is no longer for sale stays in Google's index and keeps drawing
 * enquiries the business cannot fulfil.
 *
 * For a dealership whose listings are withdrawn as a matter of course —
 * every vehicle sold is a URL retired — this is not an edge case. It is the
 * normal end of a listing's life.
 *
 * ── Why the rule is expressed as "not above a page that can 404" ──────
 * The fix is not "never use loading.tsx". It is that a segment which can
 * call `notFound()` must not sit under one. The catalogue list keeps its
 * fallback through a `(catalogue)` route group, which is invisible in the
 * URL and leaves `/cars/[slug]` outside the boundary.
 */

const PUBLIC_ROOT = path.join(process.cwd(), "src/app/(public)")

/** Every directory from `dir` up to, but excluding, `(public)` itself. */
function ancestorsWithin(dir: string): string[] {
  const chain: string[] = []
  let current = path.dirname(dir)

  while (current.startsWith(PUBLIC_ROOT)) {
    chain.push(current)
    if (current === PUBLIC_ROOT) break
    current = path.dirname(current)
  }

  return chain
}

/** Directories under `(public)` whose page component calls `notFound()`. */
function segmentsThatCanNotFound(dir: string = PUBLIC_ROOT): string[] {
  const found: string[] = []

  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)

    if (statSync(full).isDirectory()) {
      found.push(...segmentsThatCanNotFound(full))
      continue
    }

    if (entry === "page.tsx" && /\bnotFound\(\)/.test(readFileSync(full, "utf8"))) {
      found.push(dir)
    }
  }

  return found
}

describe("public routes that can 404", () => {
  it("has at least one, so this test is not vacuously passing", () => {
    // Without this, deleting the vehicle page would make the assertion
    // below pass over an empty list and the guard would quietly stop
    // guarding anything.
    expect(segmentsThatCanNotFound().length).toBeGreaterThan(0)
  })

  it("sits under no loading.tsx, so notFound() can still set the status", () => {
    const offenders: string[] = []

    for (const segment of segmentsThatCanNotFound()) {
      for (const ancestor of ancestorsWithin(segment)) {
        if (existsSync(path.join(ancestor, "loading.tsx"))) {
          offenders.push(
            `${path.relative(process.cwd(), segment)} is under a loading.tsx at ${path.relative(process.cwd(), ancestor)}`
          )
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it("keeps no loading.tsx at the (public) group root", () => {
    // Stated separately from the rule above because this is the specific
    // placement that caused it, and the message a future developer needs to
    // see is about this file rather than about a traversal result.
    expect(existsSync(path.join(PUBLIC_ROOT, "loading.tsx"))).toBe(false)
  })
})
