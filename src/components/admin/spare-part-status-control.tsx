"use client"

import { useActionState } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import type { SparePartAvailability } from "@/generated/prisma/enums"
import { SparePartPricingMode, SparePartStatus } from "@/generated/prisma/enums"
import {
  updateSparePartStatusAction,
  type SparePartFormState,
} from "@/lib/actions/spare-part.actions"
import { ListingStatusBar } from "@/components/admin/listing-status-bar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { SparePartStatusBadge } from "@/components/admin/spare-part-status-badge"
import { SPARE_PART_STATUS_LABELS } from "@/lib/constants/spare-part-options"
// The same table the Server Action enforces. Rendering buttons from it is a
// convenience; `updateSparePartStatusAction` is what actually refuses a move.
import { ALLOWED_SPARE_PART_TRANSITIONS } from "@/lib/constants/spare-part-status-transitions"
import { SPARE_PART_AVAILABILITY_LABELS } from "@/lib/constants/spare-part-options"

/**
 * The availability states that claim we physically hold the part.
 *
 * A `Set` rather than a boolean expression so that adding a value to the enum
 * forces a decision about which side of this line it falls on, in one place,
 * rather than leaving the check quietly answering "no" for it.
 */
const CLAIMS_STOCK_IN_HAND: ReadonlySet<SparePartAvailability> = new Set([
  "IN_STOCK",
  "LOW_STOCK",
])

const INITIAL_STATE: SparePartFormState = { status: "idle" }

interface SparePartStatusControlProps {
  sparePartId: string
  status: SparePartStatus
  pricingMode: SparePartPricingMode
  price: number | null
  stockQuantity: number
  /** What the listing currently promises a customer. Not derived from the
   *  stock figure above — the two are separate decisions, and the useful
   *  warning below is precisely where they disagree. */
  availability: SparePartAvailability
  fitmentCount: number
  /** Live photographs. A catalogue card leads with an image, so publishing
   *  without one is worth naming — but not blocking. */
  photoCount: number
}

/**
 * Status transitions for a spare part.
 *
 * Separate from the details form on purpose. Changing a stock figure is a
 * correction; publishing puts a price in front of customers and archiving
 * takes the line away. Mixing the two into one Save button means those
 * decisions get made by accident, in passing.
 */
export function SparePartStatusControl({
  sparePartId,
  status,
  pricingMode,
  price,
  stockQuantity,
  availability,
  fitmentCount,
  photoCount,
}: SparePartStatusControlProps) {
  const [state, formAction, isPending] = useActionState(
    updateSparePartStatusAction,
    INITIAL_STATE
  )

  const transitions = ALLOWED_SPARE_PART_TRANSITIONS[status]
  const canPublish = transitions.includes(SparePartStatus.PUBLISHED)

  /**
   * A priced part with no price cannot be published at all — the action
   * refuses it, and the database would too. This is the only hard block on
   * this screen, and it is hard because there is no version of the listing
   * that would be honest.
   */
  const missingPrice =
    pricingMode === SparePartPricingMode.FIXED && price === null

  /**
   * Everything else is a warning, not a block.
   *
   * No fitment means the part will not surface in "does this fit my car?",
   * which is how most people find a part — but a universal consumable
   * genuinely has none, and a hard block on a judgement call is how people
   * learn to work around a tool instead of with it.
   *
   * Zero stock is deliberately *not* warned about: a published part at zero
   * is a supported state, not a mistake. It tells the customer we carry the
   * line and lets them enquire about the next shipment.
   */
  const noFitment = fitmentCount === 0

  /**
   * The same judgement as fitment, for the same reason it is not a block: a
   * listing entered today and photographed tomorrow is a normal working
   * pattern, and a dealership that cannot publish until the photographs
   * arrive will publish something worse instead. But the catalogue card is
   * mostly image, so an operator should be told what the customer will see.
   */
  const noPhotos = photoCount === 0

  return (
    <ListingStatusBar
      badge={<SparePartStatusBadge status={status} />}
      live={status === SparePartStatus.PUBLISHED}
      actions={transitions.map((target) => {
        const blocked = target === SparePartStatus.PUBLISHED && missingPrice

        return (
          <form key={target} action={formAction}>
            <input type="hidden" name="id" value={sparePartId} />
            <input type="hidden" name="status" value={target} />
            <Button
              type="submit"
              disabled={isPending || blocked}
              variant={target === SparePartStatus.PUBLISHED ? "default" : "outline"}
            >
              {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {labelForTransition(target, status)}
            </Button>
          </form>
        )
      })}
    >
      {state.status === "success" && state.message ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" className="text-success" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {canPublish && missingPrice ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>
            This part is set to a fixed price but has no price entered. Add one
            above, or change it to <strong>Price on enquiry</strong>, before
            publishing.
          </AlertDescription>
        </Alert>
      ) : null}

      {canPublish && !missingPrice && noPhotos ? (
        <Alert>
          <AlertCircle aria-hidden="true" className="text-warning" />
          <AlertDescription>
            This part has no photographs. You can publish it, but its catalogue
            card will show a placeholder where the image belongs.
          </AlertDescription>
        </Alert>
      ) : null}

      {canPublish && !missingPrice && noFitment ? (
        <Alert>
          <AlertCircle aria-hidden="true" className="text-warning" />
          <AlertDescription>
            No compatible vehicles are listed for this part. You can publish it,
            but customers searching by their own car will not find it.
          </AlertDescription>
        </Alert>
      ) : null}

      {/*
        The one stock warning worth showing, and it is not "stock is zero".

        Zero stock on a published part is a perfectly normal state: the
        listing stays up, the customer enquires, and we source it. That is
        exactly what "Available to order" says, and warning about it would be
        an alert an operator learns to dismiss.

        What is worth interrupting for is the *disagreement*: a listing
        telling customers we have one in hand while the count behind it says
        we have none. That is a promise the business cannot keep, published,
        on a page a customer is reading right now — and it is invisible from
        either column alone, which is why it is checked here.
      */}
      {status === SparePartStatus.PUBLISHED &&
      stockQuantity === 0 &&
      CLAIMS_STOCK_IN_HAND.has(availability) ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>
            This part tells customers it is{" "}
            <strong className="font-semibold">
              &ldquo;{SPARE_PART_AVAILABILITY_LABELS[availability]}&rdquo;
            </strong>
            , but the stock count is zero. Either correct the count, or change
            the availability to &ldquo;Available to order&rdquo; so the listing
            matches what we can actually supply.
          </AlertDescription>
        </Alert>
      ) : null}

    </ListingStatusBar>
  )
}

/**
 * Buttons are named for the action, not the resulting state.
 *
 * "Publish" tells an operator what will happen; "Published" describes a state
 * and reads like a label. The move to DRAFT is named for where it comes
 * from: from a live listing it is "Unpublish", which is what the operator is
 * doing, while from an archived one it is "Restore to draft", which is not
 * the same act at all even though it writes the same value.
 */
function labelForTransition(
  target: SparePartStatus,
  from: SparePartStatus
): string {
  switch (target) {
    case SparePartStatus.PUBLISHED:
      return "Publish"
    case SparePartStatus.ARCHIVED:
      return "Archive"
    case SparePartStatus.DRAFT:
      return from === SparePartStatus.PUBLISHED ? "Unpublish" : "Restore to draft"
    default:
      return SPARE_PART_STATUS_LABELS[target]
  }
}
