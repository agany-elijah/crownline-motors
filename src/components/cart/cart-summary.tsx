"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ImageOff, ShoppingCart, Trash2 } from "lucide-react"

import { QuantityStepper } from "@/components/spare-parts/quantity-stepper"
import { useCart } from "@/components/cart/cart-provider"
import { QuoteRequestPanel } from "@/components/quotes/quote-request-dialog"
import {
  QUOTE_REQUEST_COPY,
  requestItemsLabel,
} from "@/components/quotes/quote-request-triggers"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { CartItem } from "@/lib/cart/cart-storage"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format-currency"

/**
 * What is in the basket, and the one thing to do with it.
 *
 * ── Why this is a panel and not a page ────────────────────────────────
 * A basket page is a step in a checkout, and there is no checkout: an order
 * in this system is created when a quotation is accepted, not when a customer
 * presses a button (see the schema documentation on `Quote` → `Order`).
 * Building a `/cart` route now would be the front half of a purchase flow
 * whose back half deliberately does not exist, and the first thing a customer
 * would do on it is look for a Checkout button.
 *
 * So the basket is a shortlist with a panel to review it, and its one action
 * is the action the business actually supports today: turn this into a
 * quotation. "Request items" switches this same panel to the request form,
 * with every part and quantity already filled in — one panel, two steps,
 * rather than a second modal stacked on the first. When spare-parts checkout
 * is built (Wave B), this is where it gains a second button — nothing about
 * how items are held has to change.
 *
 * A successful request empties the basket: the list *became* the quotation,
 * and leaving it behind would invite the same request twice.
 *
 * ── Why the button hides itself until the basket is read ──────────────
 * `ready` is false until `localStorage` has been read in an effect. Rendering
 * "0" first and then flicking to "3" is worse than rendering nothing for a
 * frame, and the count is the only reason this control exists.
 *
 * That silence is also what makes it safe to mount in the site header, on
 * every public page: a visitor who has never added a part sees no cart glyph
 * at all, so nothing on a page about cars suggests a car goes in a basket.
 */
interface CartSummaryProps {
  /**
   * Which surface the trigger is sitting on.
   *
   * The header goes transparent over the homepage's dark hero, and a control
   * painted `bg-card` with `text-foreground` disappears into it — the same
   * problem the nav links solve with their own tone prop. `dark` swaps to a
   * translucent white treatment that reads on photography.
   *
   * The badge does not change: it is gold on both, which is legible on either
   * surface and is the one part of this control that should stay constant,
   * because the number is the whole point of it.
   */
  tone?: "light" | "dark"
  className?: string
}

export function CartSummary({ tone = "light", className }: CartSummaryProps) {
  const { items, count, subtotal, ready, setQuantity, remove, clear } = useCart()
  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState<"list" | "request">("list")
  /**
   * The lines being requested, frozen as the form opens. The basket is
   * cleared the moment the request is stored, and the form must go on
   * describing what was sent rather than an empty list.
   */
  const [requestItems, setRequestItems] = React.useState<CartItem[]>([])
  const [submitted, setSubmitted] = React.useState(false)

  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next)

    if (!next) {
      setView("list")
      setSubmitted(false)
    }
  }, [])

  /**
   * Emptying the list by hand closes the panel.
   *
   * Without this the panel stayed "open" in state while the control rendered
   * nothing — and the next part added anywhere on the site popped the list
   * open over the page, uninvited. Adjusted during render rather than in an
   * effect, so the stale open state is never committed.
   */
  if (open && view === "list" && ready && count === 0) {
    setOpen(false)
  }

  const onSubmitted = React.useCallback(() => {
    setSubmitted(true)
    clear()
  }, [clear])

  // Nothing to show, and nothing useful to say: an empty basket needs no
  // control, and the catalogue below is already the way to fill one. The
  // panel itself stays up while it is showing a request's confirmation,
  // which is the one moment the basket is empty and the panel is not.
  if (!ready || (count === 0 && !open)) return null

  return (
    <>
      {/*
        A plain button rather than the shared `Button`, because the count is a
        badge rather than a word and the two need different type treatments on
        one control.

        The accessible name is set explicitly and is the whole phrase: without
        it a screen reader announces "Cart" and "3" as two unrelated fragments,
        and on a phone — where the word is hidden and only the glyph and the
        badge remain — it would announce just "3".
      */}
      {count > 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Cart · ${count}`}
          aria-haspopup="dialog"
          className={cn(
            "relative inline-flex size-9 shrink-0 items-center justify-center rounded-[6px] border",
            "transition-[background-color,border-color,box-shadow] duration-fast ease-crownline",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            tone === "dark"
              ? "border-white/20 text-white hover:border-white/40 hover:bg-white/10"
              : "border-border bg-card text-foreground hover:border-gold-ink/40 hover:bg-secondary",
            className
          )}
        >
          <ShoppingCart aria-hidden="true" className="size-5" />

          {/*
            The count, as a badge on the corner of the glyph rather than a
            third element in a row.

            The header is the most contested horizontal space on the site — it
            also holds the wordmark, two CTAs and the menu trigger — so this
            control is a square icon button, the same footprint as the
            hamburger beside it. Overlapping the badge keeps the count at full
            prominence without asking for the width of a word.

            Capped at 9+: a two-digit number fits, a three-digit one would push
            the badge wider than the button it sits on. Nobody shortlists a
            hundred distinct parts, and `MAX_CART_LINES` stops them at fifty.
          */}
          <span
            aria-hidden="true"
            className={cn(
              "tabular absolute -top-1.5 -right-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1",
              "bg-gold-bright text-[0.625rem] font-bold text-gold-bright-foreground",
              "ring-2",
              tone === "dark" ? "ring-transparent" : "ring-background"
            )}
          >
            {count > 9 ? "9+" : count}
          </span>
        </button>
      ) : null}

      {/* Mounted only while open — see the note on the quick view. */}
      {open ? (
        <Dialog open onOpenChange={handleOpenChange}>
          <DialogContent
            className={cn(
              "max-h-[92dvh] gap-0 overflow-y-auto overscroll-contain p-0",
              view === "request" ? "sm:max-w-xl" : "sm:max-w-lg"
            )}
          >
            {view === "request" ? (
              <QuoteRequestPanel
                title={QUOTE_REQUEST_COPY.parts.title}
                description={QUOTE_REQUEST_COPY.parts.description}
                subject={{ kind: "PARTS_LIST", items: requestItems }}
                submitLabel={requestItemsLabel(requestItems.length)}
                onSubmitted={onSubmitted}
                onDone={() => handleOpenChange(false)}
                header={
                  submitted ? null : (
                    <button
                      type="button"
                      onClick={() => setView("list")}
                      className="group/back inline-flex w-fit items-center gap-1.5 text-small font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <ArrowLeft
                        aria-hidden="true"
                        className="size-4 transition-transform duration-fast group-hover/back:-translate-x-0.5"
                      />
                      Back to your list
                    </button>
                  )
                }
              />
            ) : (
              <CartList
                items={items}
                count={count}
                subtotal={subtotal}
                setQuantity={setQuantity}
                remove={remove}
                onNavigate={() => handleOpenChange(false)}
                onRequest={() => {
                  setRequestItems(items)
                  setView("request")
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

function CartList({
  items,
  count,
  subtotal,
  setQuantity,
  remove,
  onNavigate,
  onRequest,
}: {
  items: CartItem[]
  count: number
  subtotal: { total: number; quotedLines: number }
  setQuantity: (slug: string, quantity: number) => void
  remove: (slug: string) => void
  onNavigate: () => void
  onRequest: () => void
}) {
  return (
    <div className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <DialogTitle className="pr-8 text-title">Your parts list</DialogTitle>
        <DialogDescription className="text-small">
          {count === 1 ? "One part, ready to be quoted." : `${count} parts, ready to be quoted.`}
        </DialogDescription>
      </div>

      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {items.map((item) => (
          <li key={item.slug} className="flex gap-3 py-3">
            {/* Contained on white, matching the catalogue card and the
                galleries: a cropped thumbnail of a long part shows a
                slice of metal that identifies nothing. */}
            <div className="relative size-14 shrink-0 overflow-hidden rounded-[4px] border border-border bg-card">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-contain" />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <ImageOff aria-hidden="true" className="size-4" />
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {/*
                The name alone. Our `CLM-SP-…` reference is deliberately not
                shown — a customer identifies a part by the manufacturer's
                number, and an internal code on a shortlist of three things is
                clutter. It still travels with the quotation request, which is
                where an operator needs it.
              */}
              <Link
                href={`/spare-parts/${item.slug}`}
                onClick={onNavigate}
                className="line-clamp-2 text-small font-medium text-foreground transition-colors duration-fast hover:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {item.name}
              </Link>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <QuantityStepper
                  value={item.quantity}
                  onChange={(quantity) => setQuantity(item.slug, quantity)}
                  label={`Quantity of ${item.name}`}
                />

                <div className="flex items-center gap-2">
                  <span className="tabular text-small font-semibold text-price">
                    {item.price === null
                      ? // Never "$0" and never a dash: a quoted part has a
                        // deliberate decision behind it, and either of those
                        // would read as a listing that is not finished.
                        "On enquiry"
                      : formatCurrency(item.price * item.quantity)}
                  </span>

                  <button
                    type="button"
                    onClick={() => remove(item.slug)}
                    aria-label={`Remove ${item.name}`}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-secondary hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between gap-4">
        <span className="text-small text-muted-foreground">Estimated subtotal</span>
        <span className="tabular font-sans text-title font-bold text-price">
          {formatCurrency(subtotal.total)}
        </span>
      </div>

      {/*
        Stated whenever a line has no listed price. A subtotal that quietly
        omitted those lines would understate what the customer is asking for —
        the one direction a figure shown to a customer must never be wrong in.
      */}
      {subtotal.quotedLines > 0 ? (
        <p className="text-small text-muted-foreground">
          {subtotal.quotedLines === 1
            ? "One part is priced on enquiry and is not included in this subtotal."
            : `${subtotal.quotedLines} parts are priced on enquiry and are not included in this subtotal.`}
        </p>
      ) : null}

      <p className="text-small text-muted-foreground">
        Prices are estimates. We confirm availability, shipping and the final cost
        on your quotation before you commit to anything.
      </p>

      <Button type="button" size="lg" onClick={onRequest} className="group/request w-full">
        {requestItemsLabel(items.length)}
        <ArrowRight
          aria-hidden="true"
          className="transition-transform duration-fast group-hover/request:translate-x-0.5"
        />
      </Button>
    </div>
  )
}
