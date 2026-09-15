/**
 * When two sets of contact details are the same customer.
 *
 * ── The rule ──────────────────────────────────────────────────────────
 * A customer is the combination of all four details the enquiry form asks
 * for: full name, email, phone and WhatsApp. Two enquiries belong to one
 * Customer only when every one of those agrees. Sharing any one of them is
 * not enough, because in this market it routinely is not the same person:
 * a family shares a phone, a driver or relative enquires on someone else's
 * behalf using their own number, an office shares one inbox. Filing those
 * under whoever used the detail first puts one person's quotes, orders and
 * payments on another person's record.
 *
 * The price of the rule is that a genuinely returning customer who types
 * their name differently gets a second record. The normalisation below
 * absorbs the differences that are typing rather than identity, and the
 * customer screen lists records that share a phone, WhatsApp or email so an
 * operator can see the connection.
 *
 * ── What counts as "the same" ─────────────────────────────────────────
 * Name: case, surrounding and repeated spaces, accents on Latin letters
 * ("José" / "Jose"), apostrophe and dash variants from phone keyboards
 * ("Ma’en" / "Ma'en"), spaces around a hyphen, and full stops ("J. Lado" /
 * "J Lado") are ignored. Anything else — a missing surname, a different
 * spelling — is a different name.
 *
 * Email: case and surrounding spaces are ignored. Nothing else: "a.b@" and
 * "ab@", or "+tag" addresses, are different mailboxes as far as this
 * business can know. No email is its own value — an enquiry without one is
 * not the same identity as an enquiry with one.
 *
 * Phone and WhatsApp: compared as E.164 digits, which the request schema has
 * already produced; formatting characters are dropped defensively for rows
 * stored before that normalisation existed.
 *
 * Pure: no server imports, so it is shared by the resolver and its tests.
 */

export interface CustomerIdentityFields {
  fullName: string
  email: string | null | undefined
  phone: string
  whatsapp: string | null | undefined
}

/** Typographic apostrophes and look-alikes that mobile keyboards substitute for `'`. */
const APOSTROPHE_VARIANTS = /[‘’‛ʹʼ`´]/g
/** Hyphen, non-breaking hyphen, figure/en/em dash, horizontal bar, minus sign. */
const DASH_VARIANTS = /[‐-―−]/g

export function normalizeIdentityName(name: string): string {
  return (
    name
      // Compatibility decomposition: full-width letters and ligatures become
      // their plain forms, and accented letters split into base + mark.
      .normalize("NFKD")
      // Accents are dropped only from Latin letters. In scripts such as
      // Devanagari the combining marks are vowels, and removing them would
      // make different names equal.
      .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
      .normalize("NFC")
      .replace(APOSTROPHE_VARIANTS, "'")
      .replace(DASH_VARIANTS, "-")
      .replace(/\./g, " ")
      .replace(/\s*-\s*/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  )
}

export function normalizeIdentityEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase()
  return value ? value : null
}

export function normalizeIdentityPhone(phone: string | null | undefined): string | null {
  const value = phone?.replace(/[^\d+]/g, "")
  return value ? value : null
}

/**
 * A stable string naming one identity. Equal keys are the same customer;
 * it is also what the resolver locks on, so two simultaneous enquiries from
 * one identity cannot both create a record.
 */
export function customerIdentityKey(fields: CustomerIdentityFields): string {
  return JSON.stringify([
    normalizeIdentityName(fields.fullName),
    normalizeIdentityEmail(fields.email),
    normalizeIdentityPhone(fields.phone),
    normalizeIdentityPhone(fields.whatsapp),
  ])
}

export function isSameCustomerIdentity(a: CustomerIdentityFields, b: CustomerIdentityFields): boolean {
  return customerIdentityKey(a) === customerIdentityKey(b)
}
