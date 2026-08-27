import * as React from "react";
import { MessageCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp";

/**
 * Persistent floating WhatsApp entry point on every public page per the
 * brand brief. A plain anchor with no interactivity needed, so this stays
 * a server component - zero client JS cost.
 */
export function WhatsAppFloatButton() {
  const whatsappUrl = buildWhatsAppUrl({
    phoneNumber: siteConfig.whatsappNumber,
    message: buildGeneralWhatsAppMessage(siteConfig.name),
  });

  if (!whatsappUrl) {
    return null;
  }

  const buttonClassName = cn(
    "fixed bottom-5 right-5 z-30 flex size-14 items-center justify-center rounded-full",
    "bg-[#25D366] text-white shadow-lg shadow-charcoal/20",
    "transition-transform duration-[var(--duration-fast)] ease-[var(--ease-crownline)]",
    "hover:scale-105 active:scale-95",
    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
  );

  const anchorProps: React.AnchorHTMLAttributes<HTMLAnchorElement> = {
    href: whatsappUrl,
    target: "_blank",
    rel: "noopener noreferrer",
  };

  return (
    <a {...anchorProps}
      aria-label={"Chat with " + siteConfig.shortName + " on WhatsApp"}
      className={buttonClassName}
    >
      <MessageCircleIcon className="size-7" aria-hidden="true" />
    </a>
  );
}
