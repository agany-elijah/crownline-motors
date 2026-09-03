import { cn } from "@/lib/utils"
import { siteConfig } from "@/config/site"
import { getWhatsAppNumber } from "@/lib/queries/settings.queries"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

/** The official WhatsApp glyph. Inlined rather than pulled from an icon
 *  set so the mark is correct — a generic speech bubble reads as "chat",
 *  not as "WhatsApp", and recognisability is the entire point here. */
function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23a8.18 8.18 0 0 1 5.82 2.42 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Z" />
    </svg>
  )
}

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
        <WhatsAppGlyph />
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
