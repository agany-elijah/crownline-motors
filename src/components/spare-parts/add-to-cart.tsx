"use client"

import * as React from "react"
import { Check, ShoppingCart } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useCart } from "@/components/cart/cart-provider"
import type { CartItemInput } from "@/lib/cart/cart-storage"

/**
 * "Add to cart", on a part's own page.
 *
 * ── Why the quantity is no longer chosen here ─────────────────────────
 * There used to be a stepper beside this button, on the argument that
 * someone who wants four brake pads should not have to add one and then go
 * looking for the basket to adjust it.
 *
 * The dealership asked for the opposite, and they are right about their own
 * customers. Choosing a quantity before committing to the part is a decision
 * asked in the wrong order — the customer is still deciding *whether*, and a
 * spinbutton reading "1" beside the button invites them to answer a question
 * they have not reached. Worse, the same control had to exist on the
 * catalogue card and in the basket, so a quantity could be set in three
 * places and the two upstream ones then had to be reset after every add or
 * they silently doubled the next one.
 *
 * There is now exactly one place a quantity is set: the basket, where the
 * customer is looking at what they have chosen and can see the line it
 * applies to. Everything upstream adds one. That is one control instead of
 * three, and it is the arrangement every catalogue a customer in this market
 * already uses.
 *
 * ── The confirmation ──────────────────────────────────────────────────
 * The cart provider announces the add in the single live region it owns for
 * the page, and the header badge increments. The button's own tick is the
 * local, visual half of that — without it the nearest feedback to a press on
 * a phone is a number in the top corner, which is not where the thumb is
 * looking.
 *
 * ── Why an unavailable part can still be added ────────────────────────
 * The basket is a shortlist, not a checkout: adding commits nobody to
 * anything, holds no stock and locks no price (see `cart-storage.ts`). A
 * customer shortlisting a discontinued part is asking us to source one, which
 * is a conversation the business wants — and the availability tag above has
 * already told them what they are asking for.
 */
interface AddToCartProps {
  item: CartItemInput
  /** The part's name, for the button's accessible name. */
  label: string
  /**
   * Layout override for the button itself.
   *
   * The default sizing suits the two-button row in the page body. The pinned
   * mobile action bar needs a plain full-width button instead, and it is the
   * placement — not this component — that knows which. Merged with `cn`, so a
   * caller can drop the `sm:` rules without having to restate the rest.
   */
  className?: string
}

/** How long the button holds its confirmed state. Long enough to register,
 *  short enough that a second press is not blocked by it. */
const ADDED_FEEDBACK_MS = 2000

export function AddToCart({ item, label, className }: AddToCartProps) {
  const { add } = useCart()
  const [justAdded, setJustAdded] = React.useState(false)

  React.useEffect(() => {
    if (!justAdded) return

    const timer = window.setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [justAdded])

  return (
    <Button
      type="button"
      size="lg"
      onClick={() => {
        // One unit. Repeated presses top the line up rather than replacing
        // it, so pressing twice means two — which is the reading anybody
        // pressing a button twice intends.
        add(item, 1)
        setJustAdded(true)
      }}
      aria-label={`Add ${label} to cart`}
      className={cn("w-full sm:w-auto sm:min-w-52 sm:flex-1", className)}
    >
      {justAdded ? (
        <>
          <Check aria-hidden="true" />
          Added to cart
        </>
      ) : (
        <>
          <ShoppingCart aria-hidden="true" />
          Add to cart
        </>
      )}
    </Button>
  )
}
