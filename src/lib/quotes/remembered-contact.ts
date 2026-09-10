/**
 * The contact details a customer last sent a request with, remembered for
 * the rest of their visit.
 *
 * ── Why ───────────────────────────────────────────────────────────────
 * Customers ask about more than one thing: a car, then the parts for the car
 * they already own, then a second car. Re-typing a name, two phone numbers
 * and a city on a phone keyboard for each is the friction that makes people
 * give up and message instead — so a successful request remembers what it
 * was sent with and the next form opens filled in.
 *
 * ── Why sessionStorage, not localStorage ──────────────────────────────
 * Personal details on what may be a shared or borrowed phone. Session
 * storage dies with the tab, so the convenience covers one visit and never
 * outlives it; nothing is sent anywhere, and the server never reads it. The
 * form is still the only thing that submits — every value is re-validated on
 * the server exactly as if it had been typed.
 *
 * Every read is defensive: storage is the customer's, can be edited by hand,
 * and can throw outright (private mode, blocked storage). A failure is an
 * empty form, never a crash.
 */

export interface RememberedContact {
  fullName: string
  phoneCountry: string
  phone: string
  whatsappSameAsPhone: boolean
  whatsappCountry: string
  whatsapp: string
  email: string
  city: string
}

export const REMEMBERED_CONTACT_KEY = "crownline.quote-contact.v1"

const FIELD_MAX = 254

function text(value: unknown): string {
  return typeof value === "string" ? value.slice(0, FIELD_MAX) : ""
}

/** Reads a stored value, dropping anything that is not the expected shape. */
export function parseRememberedContact(raw: string | null): RememberedContact | null {
  if (!raw) return null

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== "object" || parsed === null) return null

  const candidate = parsed as Record<string, unknown>
  const contact: RememberedContact = {
    fullName: text(candidate.fullName),
    phoneCountry: text(candidate.phoneCountry),
    phone: text(candidate.phone),
    whatsappSameAsPhone: candidate.whatsappSameAsPhone !== false,
    whatsappCountry: text(candidate.whatsappCountry),
    whatsapp: text(candidate.whatsapp),
    email: text(candidate.email),
    city: text(candidate.city),
  }

  // A record without the two fields every request needs is not worth
  // pre-filling from.
  return contact.fullName && contact.phone ? contact : null
}

/** Builds the value to remember from a submitted form. */
export function contactFromFormData(formData: FormData): RememberedContact {
  return {
    fullName: text(formData.get("fullName")),
    phoneCountry: text(formData.get("phoneCountry")),
    phone: text(formData.get("phone")),
    whatsappSameAsPhone: formData.get("whatsappSameAsPhone") === "on",
    whatsappCountry: text(formData.get("whatsappCountry")),
    whatsapp: text(formData.get("whatsapp")),
    email: text(formData.get("email")),
    city: text(formData.get("city")),
  }
}

// ── As an external store, for useSyncExternalStore ─────────────────────
//
// The Get a Quote page renders its form on the server, where there is no
// storage, so a component that read storage during its first render would
// hydrate with different defaults from the HTML it was sent. React's
// external-store API is built for exactly this: the server snapshot (null)
// is used for the server render *and* for hydration, and the real value is
// read immediately afterwards.
//
// The snapshot is cached by the raw string, because `getSnapshot` must
// return an identical value between calls while nothing has changed —
// parsing afresh each time would hand React a new object on every read and
// re-render forever.

let cachedRaw: string | null | undefined
let cachedContact: RememberedContact | null = null
const listeners = new Set<() => void>()

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(REMEMBERED_CONTACT_KEY)
  } catch {
    // Storage unavailable. An empty form is the correct fallback.
    return null
  }
}

export function getRememberedContactSnapshot(): RememberedContact | null {
  const raw = readRaw()

  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedContact = parseRememberedContact(raw)
  }

  return cachedContact
}

export function getServerRememberedContactSnapshot(): RememberedContact | null {
  return null
}

export function subscribeRememberedContact(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function writeRememberedContact(contact: RememberedContact): void {
  try {
    window.sessionStorage.setItem(REMEMBERED_CONTACT_KEY, JSON.stringify(contact))
  } catch {
    // Quota or a blocked store: the request itself has already been sent, and
    // the only cost is re-typing next time. Nothing to tell the customer.
    return
  }

  for (const listener of listeners) listener()
}
