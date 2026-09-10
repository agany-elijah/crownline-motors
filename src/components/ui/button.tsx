import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Crownline button.
 *
 * Three rules from the brand brief are encoded here rather than left to
 * each page to remember:
 *
 * 1. Buttons keep a distinct 8px radius while cards and media frames stay
 *    near-square. That contrast in geometry is what makes a button read as
 *    pressable instead of as another information tile — the brief calls
 *    out badge/button confusion as a specific failure to avoid.
 *
 * 2. `default` is the single gold CTA. It is intentionally the only filled
 *    gold variant, so "one primary action per surface" is enforced by the
 *    palette rather than by discipline. Secondary actions take `outline`.
 *
 * 3. The marketing sizes (`lg`, `xl`) set their labels in Manrope, bold,
 *    uppercase, with wide tracking. In this design language a large button
 *    is always a headline call to action — "VIEW CARS", "GET A QUOTE" —
 *    and that treatment is what makes it read as automotive rather than as
 *    a SaaS form control. `xs`/`sm`/`default` stay in Inter, sentence
 *    case, for dense UI and the admin dashboard.
 *
 * Motion: hover raises the button half a step and deepens its shadow;
 * press returns it to the surface. The lift and the shadow are one
 * gesture — a shadow that grows while the element stays put reads as a
 * filter effect, whereas moving both together reads as the object
 * physically rising. Both run at --duration-fast (250ms) per the brief's
 * micro-interaction budget, and the global reduced-motion rule collapses
 * them to near-zero for anyone who has asked for less movement.
 *
 * On dark surfaces the neutral variants are restyled by descendant rules
 * under `[data-tone="dark"]` in globals.css, keyed off the `data-variant`
 * attribute emitted below — so a header, footer or drawer marks itself
 * dark once instead of hand-patching classes onto each button it renders.
 */
const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center gap-2",
    "rounded-lg border border-transparent bg-clip-padding",
    "font-semibold whitespace-nowrap select-none",
    "outline-none transition-all duration-fast ease-crownline",
    "focus-visible:ring-3 focus-visible:ring-ring/50",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        // The one gold CTA. Dark ink on gold at 10.3:1 — gold-on-white
        // text would fail contrast badly at any of these sizes.
        //
        // Carries --shadow-gold rather than the neutral elevation: a warm
        // bloom in the button's own colour is what separates a premium CTA
        // from a coloured rectangle, and it is the reason the gold reads as
        // bright rather than flat against the warm-white page.
        default: [
          "bg-primary text-primary-foreground shadow-[var(--shadow-gold)]",
          "hover:-translate-y-0.5 hover:bg-[color-mix(in_oklch,var(--primary),white_12%)]",
          "hover:shadow-[var(--shadow-gold-strong)]",
          "active:translate-y-0 active:shadow-[var(--shadow-gold)]",
          "active:bg-[color-mix(in_oklch,var(--primary),black_6%)]",
        ],
        outline: [
          "border-border bg-background text-foreground shadow-[var(--shadow-subtle)]",
          "hover:-translate-y-0.5 hover:border-gold-ink/45 hover:text-gold-ink",
          "hover:shadow-[var(--shadow-raised)]",
          "active:translate-y-0 active:shadow-[var(--shadow-subtle)]",
        ],
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)]",
          "active:translate-y-px",
        ],
        ghost: "bg-transparent hover:bg-accent hover:text-accent-foreground active:translate-y-px",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20 active:translate-y-px",
        // Text + arrow tertiary action. The arrow shift is wired by the
        // consumer via group-hover/button on the icon.
        link: "h-auto p-0 text-foreground underline-offset-4 hover:text-gold-ink",
        /**
         * WhatsApp's green, for the labelled "WhatsApp about …" actions.
         *
         * A variant rather than per-page classes because two pages used to
         * hand-roll it and both painted white text on `#25D366` — 1.98:1,
         * well under the 4.5:1 WCAG AA requires for a 13px label. `#11823F`
         * is a deeper green from the same family: still unmistakably
         * WhatsApp beside the glyph, and 4.90:1 with white. The hover step
         * darkens (5.43:1) rather than lightening, so contrast only improves
         * under the pointer.
         *
         * Hard-coded rather than tokenised on purpose: this is somebody
         * else's brand colour, not part of Crownline's palette, and it must
         * not drift with the theme. The focus ring is the button's own green —
         * a gold ring around a green button reads as two components.
         */
        whatsapp: [
          "bg-[#11823f] text-white shadow-[0_2px_10px_rgb(17_130_63/0.28)]",
          "hover:-translate-y-0.5 hover:bg-[#0e7a3d] hover:shadow-[0_6px_18px_rgb(17_130_63/0.36)]",
          "active:translate-y-0 active:shadow-[0_2px_10px_rgb(17_130_63/0.28)]",
          "focus-visible:ring-[#11823f]/40",
        ],
      },
      size: {
        xs: "h-7 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md px-3 text-small",
        default: "h-9 px-4 text-small",
        lg: "h-11 px-6 font-heading text-small font-bold tracking-[0.11em] uppercase",
        xl: "h-13 px-8 font-heading text-body font-bold tracking-[0.12em] uppercase",
        icon: "size-9",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  /**
   * Base UI assumes it is rendering a real `<button>` and warns when it is
   * not, because swapping in another element silently drops native button
   * semantics — form submission, the space/enter behaviour a screen reader
   * announces, the implicit role.
   *
   * `render` is how a caller deliberately renders something else, which in
   * this codebase is almost always a Next `<Link>`: an action that navigates
   * is a link, and making it a button with an onClick would break
   * middle-click, open-in-new-tab and copy-link-address. So when `render` is
   * supplied we tell Base UI the element is not a native button and let it
   * apply the ARIA it needs instead.
   *
   * An explicit `nativeButton` always wins, for the case where a caller
   * renders a genuine `<button>` through `render`.
   */
  const isNativeButton = nativeButton ?? render === undefined

  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      render={render}
      nativeButton={isNativeButton}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
