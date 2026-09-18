import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { cn } from "@/lib/utils"
import { getPublicSiteSettings } from "@/lib/queries/settings.queries"
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

/**
 * Persistent WhatsApp entry point on every public page (brief §13).
 *
 * ── The message ───────────────────────────────────────────────────────
 * A general enquiry, because this button follows the customer everywhere —
 * the homepage, the catalogue, About, Contact — and on most of those pages
 * there is no single vehicle it could name. The pages that *do* have a
 * subject carry their own contextual action instead.
 *
 * ── The number, and whether it appears at all ─────────────────────────
 * Both from Settings: the number from Business information, and the switch
 * from Catalogue display → Actions. `getPublicSiteSettings` returns an empty
 * number when either says no, and `buildWhatsAppUrl` returns null for that,
 * so this renders nothing — better than a button that opens a broken link.
 *
 * A plain anchor with no interactivity beyond CSS hover, so it stays a
 * server component and ships zero client JavaScript.
 */
export async function WhatsAppFloatButton() {
  const settings = await getPublicSiteSettings()
  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: settings.contact.whatsappNumber,
    message: buildGeneralWhatsAppMessage(settings.businessName),
  })

  if (!whatsappUrl) {
    return null
  }

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${settings.businessName} on WhatsApp`}
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
          "max-w-0 opacity-0 transition-[max-width,opacity] duration-base ease-crownline",
          "group-hover/wa:ml-2.5 group-hover/wa:max-w-40 group-hover/wa:opacity-100"
        )}
      >
        Chat with us
      </span>
    </a>
  )
}
