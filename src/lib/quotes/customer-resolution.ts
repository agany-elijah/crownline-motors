import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { customerIdentityKey } from "@/lib/quotes/customer-identity"

/**
 * Finds the Customer an enquiry belongs to, or creates one.
 *
 * ── The rule ──────────────────────────────────────────────────────────
 * An enquiry joins an existing Customer only when its full name, email,
 * phone and WhatsApp all match that record (see customer-identity.ts for
 * what "match" tolerates). Sharing a phone, an email or a WhatsApp number
 * alone makes a *different* customer — a household phone, a relative
 * enquiring on someone's behalf, an office inbox.
 *
 * Phone is part of every identity and is indexed, so candidates are read by
 * phone and compared in application code, where the name normalisation
 * lives. Neither `phone` nor `email` is unique in the database.
 *
 * ── Concurrency ───────────────────────────────────────────────────────
 * With no unique constraint to catch it, two simultaneous submissions from
 * one identity could both miss the lookup and both insert. A transaction-
 * scoped advisory lock on the identity key serialises exactly those
 * submissions (and nothing else); the second waits, then finds the row the
 * first committed. It is released with the transaction, so it is safe
 * behind Supabase's transaction-mode pooler.
 *
 * ── Why a match never updates the existing row ────────────────────────
 * The form is anonymous, and anyone can type anyone's details. If a match
 * rewrote the stored record, a stranger could change the contact details of
 * a customer with a deposit on a car. So a match only *links*: what was
 * typed is kept as a snapshot on the enquiry itself (`Quote.contact*`),
 * which is where the operator replies to, and the shared record changes
 * only through the dashboard. City is not part of the identity for the same
 * reason — people move, and it is kept on the enquiry.
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
  const identity = customerIdentityKey(contact)

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-identity:${identity}`}, 0))`

  const candidates = await tx.customer.findMany({
    where: { phone: contact.phone, deletedAt: null },
    // The oldest record is the canonical one if identical duplicates already
    // exist from before this rule was enforced.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, fullName: true, email: true, phone: true, whatsapp: true },
  })

  const match = candidates.find((candidate) => customerIdentityKey(candidate) === identity)
  if (match) return { id: match.id, created: false }

  const created = await tx.customer.create({
    data: {
      fullName: contact.fullName,
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      email: contact.email ?? null,
      city: contact.city,
    },
    select: { id: true },
  })

  return { id: created.id, created: true }
}
