import { LoadingState } from "@/components/shared/loading-state"

/**
 * Fallback while the catalogue query runs.
 *
 * ── Why it sits inside a `(catalogue)` route group ────────────────────
 * A `loading.tsx` opens a Suspense boundary over its segment *and every
 * segment beneath it*. Placed at `/spare-parts` it would cover
 * `/spare-parts/[slug]` too — and once a boundary suspends, Next has already
 * flushed the document shell and committed the HTTP status. A later
 * `notFound()` could still render the 404 page but could no longer change the
 * response from `200 OK`, so every archived part URL would answer a crawler
 * with a success status and not-found content: a soft 404, which is exactly
 * how a withdrawn listing stays in search results.
 *
 * The route group separates the two cases — the list gets a fallback, the
 * part page stays outside any boundary so its `notFound()` can set a real
 * 404. Route groups do not appear in the URL, so `/spare-parts` is unchanged.
 *
 * This mirrors the vehicle catalogue exactly; see the longer note there.
 */
export default function SparePartsCatalogueLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingState />
    </div>
  )
}
