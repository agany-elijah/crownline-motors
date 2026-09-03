import { LoadingState } from "@/components/shared/loading-state"

/**
 * Fallback while the catalogue query runs.
 *
 * ── Why it sits inside a `(catalogue)` route group ────────────────────
 * A `loading.tsx` opens a Suspense boundary over its segment *and every
 * segment beneath it*. This one lived at the top of `(public)`, which put
 * a boundary above the whole site — including `/cars/[slug]`.
 *
 * That is not a cosmetic detail. Once a boundary suspends, Next has already
 * flushed the document shell, and the HTTP status is committed with it. A
 * later `notFound()` could still render the 404 page but could no longer
 * change the response from `200 OK`. Every withdrawn, sold or archived
 * vehicle URL therefore answered a crawler with a success status and
 * not-found content — a soft 404, which is exactly how a sold car stays in
 * search results.
 *
 * The route group is what separates the two cases: it wraps the catalogue
 * list, which genuinely waits on a paginated query and benefits from a
 * fallback, while leaving `/cars/[slug]` outside any boundary so its
 * `notFound()` can still set a real 404. Route groups do not appear in the
 * URL, so `/cars` is unchanged.
 *
 * If another public route later needs a fallback, give it its own
 * `loading.tsx` — do not reinstate one at the `(public)` level, or this
 * comes back for every page that can legitimately 404.
 */
export default function CatalogueLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingState />
    </div>
  )
}
