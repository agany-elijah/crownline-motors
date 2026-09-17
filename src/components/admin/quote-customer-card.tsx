import { Mail, MapPin, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp"

interface QuoteCustomerCardProps {
  name: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  city: string | null
}

/**
 * The compact customer card the brief asks for: identity, contact details,
 * and one-tap Call / WhatsApp / Email — no navigating away from the quote to
 * reach the customer.
 *
 * `id="customer"` is the anchor `QuoteIssuesPanel` links to when contact
 * details are the thing missing.
 */
export function QuoteCustomerCard({ name, phone, whatsapp, email, city }: QuoteCustomerCardProps) {
  const whatsappUrl = whatsapp ? buildWhatsAppUrl({ phoneNumber: whatsapp }) : null

  return (
    <section id="customer" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-subtle)]">
      <h2 className="text-small font-medium text-foreground">Customer</h2>

      <div className="flex flex-col gap-1">
        <p className="text-title font-semibold text-balance">{name}</p>
        {city ? (
          <p className="flex items-center gap-1.5 text-small text-muted-foreground">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            {city}
          </p>
        ) : null}
      </div>

      {phone || email ? (
        <div className="flex flex-col gap-1 text-small text-muted-foreground">
          {phone ? <p className="font-mono text-xs text-foreground tabular-nums">{phone}</p> : null}
          {email ? <p className="truncate">{email}</p> : null}
        </div>
      ) : null}

      {phone || whatsappUrl || email ? (
        <div className="flex flex-wrap gap-2">
          {phone ? (
            <Button render={<a href={`tel:${phone}`} />} variant="outline" size="sm" className="flex-1">
              <Phone aria-hidden="true" />
              Call
            </Button>
          ) : null}
          {whatsappUrl ? (
            <Button
              render={<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" />}
              variant="whatsapp"
              size="sm"
              className="flex-1"
            >
              <WhatsAppGlyph className="size-4" />
              WhatsApp
            </Button>
          ) : null}
          {email ? (
            <Button
              render={<a href={`mailto:${email}`} />}
              variant="outline"
              size="icon-sm"
              aria-label="Email customer"
            >
              <Mail aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-small text-muted-foreground">No contact details on file yet.</p>
      )}
    </section>
  )
}
