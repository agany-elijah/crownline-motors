"use client"

import * as React from "react"
import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { MAX_ITEM_QUANTITY, clampQuantity } from "@/lib/cart/cart-storage"

/**
 * How many of a part.
 *
 * ── Why a stepper and not a number input ──────────────────────────────
 * A bare `<input type="number">` on Android puts a full numeric keyboard over
 * half the screen to change a 1 into a 2, and its spin buttons are a 12px
 * target on a desktop. Two 36px buttons either side of the figure is the
 * gesture people already make, and it is reachable with a thumb.
 *
 * The figure is still a real, editable input rather than a `<span>`, so
 * someone ordering twenty can type it, and so a screen reader announces a
 * labelled spinbutton with a current value instead of three unrelated
 * controls. `inputMode="numeric"` gets the compact keypad rather than the
 * full keyboard.
 *
 * ── Why the value is not committed while typing ───────────────────────
 * A field cleared to type "12" passes through the empty string, and clamping
 * that on every keystroke rewrites it to "1" under the cursor — the classic
 * controlled-number-input trap, where the box fights the person using it. The
 * text is held locally while it is being typed and committed on blur (and on
 * Enter), which is also when an out-of-range figure is clamped and shown back.
 */
interface QuantityStepperProps {
  value: number
  onChange: (quantity: number) => void
  /** Names the control for a screen reader — "Quantity of front brake pads". */
  label: string
  /** The stepper on the part page is bigger than the one in a dialog. */
  size?: "default" | "lg"
  disabled?: boolean
  className?: string
}

export function QuantityStepper({
  value,
  onChange,
  label,
  size = "default",
  disabled = false,
  className,
}: QuantityStepperProps) {
  const [draft, setDraft] = React.useState(String(value))

  // Re-sync when the value changes from outside — the basket panel and the
  // quick view can both drive this. Compared numerically so "02" typed by
  // hand does not fight a stored 2.
  const [lastValue, setLastValue] = React.useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(String(value))
  }

  function commit(raw: string) {
    const parsed = Number.parseInt(raw, 10)
    const next = Number.isNaN(parsed) ? value : clampQuantity(parsed)

    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  const buttonSize = size === "lg" ? "size-11" : "size-9"
  const fieldWidth = size === "lg" ? "w-12" : "w-10"

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-[4px] border border-input bg-background",
        className
      )}
    >
      <StepButton
        icon={Minus}
        label={`Decrease ${label}`}
        onClick={() => onChange(clampQuantity(value - 1))}
        // At one, decreasing has nowhere to go: this control never removes a
        // line, because the two places it appears both offer an explicit
        // Remove and a stepper that deletes the thing it is counting is a
        // surprise.
        disabled={disabled || value <= 1}
        className={buttonSize}
      />

      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
        className={cn(
          "tabular h-full border-x border-input bg-transparent py-1.5 text-center",
          // 16px on mobile: iOS Safari zooms the page in on focus for
          // anything smaller and never zooms back out.
          "text-base font-semibold text-foreground outline-none md:text-sm",
          "focus-visible:bg-accent",
          "disabled:opacity-50",
          fieldWidth
        )}
      />

      <StepButton
        icon={Plus}
        label={`Increase ${label}`}
        onClick={() => onChange(clampQuantity(value + 1))}
        disabled={disabled || value >= MAX_ITEM_QUANTITY}
        className={buttonSize}
      />
    </div>
  )
}

function StepButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
}: {
  icon: typeof Minus
  label: string
  onClick: () => void
  disabled: boolean
  className: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center text-muted-foreground",
        "transition-colors duration-fast hover:text-gold-ink",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        className
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
    </button>
  )
}
