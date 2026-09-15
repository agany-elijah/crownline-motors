import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * The Track My Order search.
 *
 * A plain GET form: it works with JavaScript off or still loading on a slow
 * connection, and the result has a URL a customer can bookmark or share with
 * whoever is collecting the car.
 */
export function TrackingSearch({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form method="get" action="/track-my-order" role="search" aria-label="Track an order" className="flex flex-col gap-3">
      <Label htmlFor="tracking-number" className="text-small font-medium">
        Tracking number
      </Label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="tracking-number"
          name="number"
          type="text"
          defaultValue={defaultValue}
          placeholder="CLM-2026-000125"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          required
          aria-describedby="tracking-number-hint"
          className="h-12 flex-1 font-mono text-base tracking-wide"
        />
        <Button type="submit" size="lg" className="h-12 sm:px-8">
          <Search aria-hidden="true" />
          Track order
        </Button>
      </div>

      <p id="tracking-number-hint" className="text-small text-muted-foreground">
        You&apos;ll find it in your tracking email or WhatsApp message. Your order number (CLM-O-…) works too.
      </p>
    </form>
  )
}
