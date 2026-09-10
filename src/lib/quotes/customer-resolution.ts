import "server-only"

import type { Prisma } from "@/generated/prisma/client"

/**
 * Finds the Customer an enquiry belongs to, or creates one.
 *
 * ── The rule, from the schema documentation ───────────────────────────
 * `Customer.phone` is indexed but deliberately not unique (a shared
 * household phone is a legitimate second enquirer), so every public form
 * must de-duplicate by hand, in this order:
 *
 *   1. An exact match on email, which *is* unique.
 *   2. Otherwise an exact match on the normalised (E.164) phone number.
 *   3. Otherwise a new row.
 *
 * Skipping it accumulates a duplicate customer for every repeat enquiry,
 * and the admin's "everything this person has asked for" view falls apart.
 *
 * ── Why a match never updates the existing row ────────────────────────
 * The form is anonymous, and anyone can type anyone's email address or phone
 * number. If a match rewrote the stored name or number, a stranger could
 * change the contact details of a customer with a deposit on a car — and the
 * next WhatsApp about that car would go to them. So a match only *links*:
 * what was typed is kept as a snapshot on the enquiry itself
 * (`Quote.contact*`), which is where the operator replies to, and the shared
 * record changes only through the dashboard.
 *
 * Soft-deleted customers are never matched. Their PII has been scrubbed on
 * request, and reviving the row would re-attach a new enquiry to an identity
 * the person asked us to forget.
 *
 * Runs inside the caller's transaction, so the customer and the quote that
 * references it are committed together or not at all.
 */
export interface EnquiryContact {
  fullName: string
  /** E.164, already normalised by the request schema. */
  phone: string
  /** E.164. */
  whatsapp: string
  email: string | undefined
  city: string
}

export async function resolveCustomerForEnquiry(
  tx: Prisma.TransactionClient,
  contact: EnquiryContact
): Promise<{ id: string; created: boolean }> {
  if (contact.email) {
    const byEmail = await tx.customer.findFirst({
      where: { email: contact.email, deletedAt: null },
      select: { id: true },
    })

    if (byEmail) return { id: byEmail.id, created: false }
  }

  const byPhone = await tx.customer.findFirst({
    where: { phone: contact.phone, deletedAt: null },
    // The oldest record is the canonical one if duplicates already exist
    // from before this rule was enforced.
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  if (byPhone) return { id: byPhone.id, created: false }

  const created = await tx.customer.create({
    data: {
      fullName: contact.fullName,
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      /**
       * `email` is unique. A concurrent request with the same address can win
       * the race between the lookup above and this insert; the caller catches
       * that unique violation and retries the whole transaction once, at
       * which point the lookup finds the row the other request created.
       */
      email: contact.email ?? null,
      city: contact.city,
    },
    select: { id: true },
  })

  return { id: created.id, created: true }
}
