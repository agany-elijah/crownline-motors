import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * The Track My Order search.
 *
 * A plain GET form: it works with JavaScript off or still loading on a slow
 * connection, and the result has a URL a customer can bookmark or share with
 * whoever is collecting the car. The action carries `#track`, so the result
 * page opens scrolled to the answer rather than to the top of the page.
 */
export function TrackingSearch({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form
      method="get"
      action="/track-my-order#track"
      role="search"
      aria-label="Track an order"
      className="flex flex-col gap-3"
    >
      <label htmlFor="tracking-number" className="text-small font-medium">
        Tracking number
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="tracking-number"
            name="number"
            type="text"
            defaultValue={defaultValue}
            placeholder="Tracking or order number"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            required
            className="h-14 w-full rounded-xl border border-input bg-card pr-4 pl-11 font-mono text-base tracking-wider text-foreground uppercase outline-none transition-[border-color,box-shadow] duration-fast placeholder:text-muted-foreground/60 placeholder:normal-case focus-visible:border-gold-ink focus-visible:ring-4 focus-visible:ring-gold/20"
          />
        </div>
        <Button type="submit" size="xl" className="h-14 sm:px-9">
          Track order
        </Button>
      </div>
    </form>
  )
}
