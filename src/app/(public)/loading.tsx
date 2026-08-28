import { LoadingState } from "@/components/shared/loading-state"

/**
 * Route-level fallback for the public site.
 *
 * Rendered inside the shell, so the header and footer stay put and only
 * the content area swaps — the page never blanks out entirely on
 * navigation, which is what makes the site feel quick on a slow
 * connection even when it isn't.
 */
export default function PublicLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingState />
    </div>
  )
}
