import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { cn } from "@/lib/utils"
import { siteConfig } from "@/config/site"
import { getWhatsAppNumber } from "@/lib/queries/settings.queries"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

/**
 * Persistent WhatsApp entry point on every public page (brief §13).
 *
 * ── The message ───────────────────────────────────────────────────────
 * A general enquiry, because this button follows the customer everywhere —
 * the homepage, the catalogue, About, Contact — and on most of those pages
 * there is no single vehicle it could name. The pages that *do* have a
 * subject carry their own contextual action instead: the vehicle page's
 * "WhatsApp about this car" pre-fills the make, model and listing
 * reference, and the tracking page pre-fills the tracking number. This is
 * the fallback for everywhere else, not a duplicate of those.
 *
 * ── The number ────────────────────────────────────────────────────────
 * From BusinessSettings, which an operator edits in the dashboard —
 * `getWhatsAppNumber` reads it through a tagged cache, so a change is live
 * on every public page as soon as it is saved and costs no query per
 * request. The brief is explicit that the number must be configurable
 * rather than hard-coded into individual pages.
 *
 * A plain anchor with no interactivity beyond CSS hover, so it stays a
 * server component and ships zero client JavaScript.
 *
 * The label expands on hover at desktop widths only. On a phone there is
 * no hover state and no spare width, so it stays a circular button — and
 * `bottom` respects the iOS safe-area inset so it never sits under the
 * Safari home indicator.
 */
export async function WhatsAppFloatButton() {
  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: await getWhatsAppNumber(),
    message: buildGeneralWhatsAppMessage(siteConfig.name),
  })

  // Rendering nothing is the correct fallback for a missing/misconfigured
  // number — better than a button that opens a broken wa.me URL.
  if (!whatsappUrl) {
    return null
  }

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${siteConfig.shortName} on WhatsApp`}
      /**
       * The handle globals.css uses to lift this button above a page that
       * pins its own action bar to the bottom of a phone screen (see the
       * `data-mobile-action-bar` rules there). Without it the float and
       * the bar occupy the same corner.
       */
      data-slot="whatsapp-float"
      className={cn(
        "group/wa fixed right-5 z-30 flex items-center gap-0 overflow-hidden",
        "bottom-[max(1.25rem,env(safe-area-inset-bottom))]",
        "h-14 rounded-full bg-[#25D366] pl-4 text-white",
        "shadow-[0_6px_24px_oklch(0.16_0.004_90/0.22)]",
        // No explicit width: pl-4 + a 24px glyph + pr-4 already measures
        // exactly 56px, so the button is a circle at rest and grows only
        // as the label's max-width animates open.
        "transition-[padding,box-shadow] duration-base ease-crownline",
        "pr-4 md:hover:pr-6",
        "hover:shadow-[0_10px_32px_oklch(0.16_0.004_90/0.3)]",
        "active:scale-95"
      )}
    >
      <span className="grid size-6 shrink-0 place-items-center">
        <WhatsAppGlyph className="size-6" />
      </span>

      {/* Width-animated rather than display-toggled so the expansion is a
          smooth slide. Hidden from assistive tech because the anchor
          already carries a full aria-label. */}
      <span
        aria-hidden="true"
        className={cn(
          "hidden overflow-hidden whitespace-nowrap text-small font-semibold md:block",
          "max-w-0 opacity-0 transition-all duration-base ease-crownline",
          "group-hover/wa:ml-2.5 group-hover/wa:max-w-40 group-hover/wa:opacity-100"
        )}
      >
        Chat with us
      </span>
    </a>
  )
}
