// Builds contextual wa.me deep links
// Security notes:
// - The phone number is sanitized to digits-only before it ever reaches a
//   URL. It comes from an env var an admin controls, so this isn't a
//   defense against a hostile actor — it's a guard against a misconfigured
//   value (stray spaces, dashes, a leading "+") silently producing a
//   broken or malformed wa.me link.
// - The message text is never string-concatenated into the URL. It always
//   goes through URLSearchParams, which percent-encodes it — so a message
//   containing "&", "#", or other URL-meaningful characters can't break out
//   of the query string or inject extra parameters.

const WHATSAPP_BASE_URL = "https://wa.me/"

function sanitizePhoneNumber(rawNumber: string): string {
  return rawNumber.replace(/[^\d]/g, "")
}

export interface BuildWhatsAppUrlOptions {
  /** Raw phone number, e.g. straight from NEXT_PUBLIC_WHATSAPP_NUMBER.
   *  May include a leading "+", spaces, or dashes — stripped automatically. */
  phoneNumber: string
  /** Pre-filled message shown in the WhatsApp chat composer. */
  message?: string
}

/**
 * Returns a `https://wa.me/<number>?text=<encoded>` URL, or `null` if the
 * phone number has no digits left after sanitizing (missing/misconfigured
 * env var). Callers must treat `null` as "don't render the WhatsApp
 * action" rather than linking to a broken wa.me URL.
 */
export function buildWhatsAppUrl({ phoneNumber, message }: BuildWhatsAppUrlOptions): string | null {
  const digitsOnly = sanitizePhoneNumber(phoneNumber)

  if (digitsOnly.length === 0) {
    return null
  }

  const url = new URL(`${WHATSAPP_BASE_URL}${digitsOnly}`)

  if (message && message.trim().length > 0) {
    url.searchParams.set("text", message.trim())
  }

  return url.toString()
}

/**
 * ── House style for every message below ───────────────────────────────
 *
 * All of them are written in the customer's voice, not the business's.
 * This text lands in the customer's own composer and they may well edit it
 * before sending, so it has to read as something a person would plausibly
 * type — an opening they can send as-is, not a form they have to fill in.
 *
 * Every message that can carry a reference does. "I am interested in the
 * Toyota Harrier 2021" is ambiguous when three are on the floor; the
 * reference is what lets whoever answers reply about the car rather than
 * spend two messages working out which car. The same reasoning applies to
 * an order number and a tracking number, where it is the difference between
 * a support conversation that starts with an answer and one that starts
 * with "which order?".
 *
 * None of these interpolate into a URL themselves — `buildWhatsAppUrl`
 * percent-encodes the whole message through URLSearchParams, so a model
 * name containing "&" is text, never a second query parameter.
 */

/** Generic message for contexts with no specific vehicle, part or order to
 *  reference — the floating button, the footer, the mobile drawer. */
export function buildGeneralWhatsAppMessage(siteName: string): string {
  return `Hello ${siteName}, I'd like to enquire about a vehicle.`
}
/**
 * The message a customer sends from a vehicle's page.
 *
 * Carries the listing reference as well as the vehicle's name, because the
 * name alone is ambiguous — an importer can have three 2021 Harriers on the
 * floor at once, and the first thing whoever answers has to establish is
 * which one. Including it means the reply can be about the car rather than
 * about working out which car.
 *
 * Phrased as the customer, not as the business: this text lands in the
 * customer's own composer, and they may well edit it before sending.
 */
export function buildVehicleWhatsAppMessage({
  siteName,
  year,
  make,
  model,
  referenceNumber,
}: {
  siteName: string
  year: number
  make: string
  model: string
  referenceNumber: string
}): string {
  return `Hello ${siteName}, I am interested in the ${make} ${model} ${year}, listing reference ${referenceNumber}.`
}

/**
 * The message a customer sends from a spare part's page.
 *
 * Written beside its vehicle counterpart so the two stay consistent — the
 * part number plays exactly the role the listing reference does above.
 */
export function buildSparePartWhatsAppMessage({
  siteName,
  partName,
  partNumber,
}: {
  siteName: string
  partName: string
  partNumber: string
}): string {
  return `Hello ${siteName}, I am interested in the ${partName}, part number ${partNumber}.`
}

/**
 * The message a customer sends about an existing order.
 *
 * Deliberately says "I need assistance with" rather than naming a problem:
 * this is reached from an order or payment screen where the customer may be
 * asking about anything from a bank reference to a delivery date, and a
 * message that presumes the complaint puts words in their mouth.
 */
export function buildOrderWhatsAppMessage({
  siteName,
  orderNumber,
}: {
  siteName: string
  orderNumber: string
}): string {
  return `Hello ${siteName}, I need assistance with order ${orderNumber}.`
}

/**
 * The message a customer sends straight after requesting a quotation.
 *
 * Offered on the confirmation screen for the customer who would rather talk
 * now than wait for the reply. The quote number is the whole point: it lets
 * whoever answers open the request the customer has just made instead of
 * asking them to describe it a second time.
 */
export function buildQuoteFollowUpWhatsAppMessage({
  siteName,
  quoteNumber,
}: {
  siteName: string
  quoteNumber: string
}): string {
  return `Hello ${siteName}, I have just sent a quotation request, reference ${quoteNumber}.`
}

/**
 * The message a customer sends from the tracking page.
 *
 * The tracking number is the only identifier this customer has — they may
 * have no account yet (Wave A has none) and may not know their order
 * number. Carrying it is what makes the conversation resolvable.
 *
 * Nothing else from the shipment is included. The message is composed in a
 * public page and the customer may forward it; the reference is the one
 * thing they already typed in to get here, and the vehicle, the value and
 * the delivery address are all things the dealership can look up and the
 * customer has not asked to broadcast.
 */
export function buildTrackingWhatsAppMessage({
  siteName,
  trackingNumber,
}: {
  siteName: string
  trackingNumber: string
}): string {
  return `Hello ${siteName}, I need assistance with tracking number ${trackingNumber}.`
}

/**
 * The message an operator sends a customer to hand over their tracking
 * number, from the order page.
 *
 * The one message in this file written in the business's voice rather than
 * the customer's: it opens in the operator's WhatsApp, addressed to the
 * customer. It carries only what the customer needs to follow the order —
 * the tracking number and the page to enter it on.
 */
export function buildTrackingNumberShareMessage({
  siteName,
  customerFirstName,
  orderNumber,
  trackingNumber,
  trackUrl,
}: {
  siteName: string
  customerFirstName: string
  orderNumber: string
  trackingNumber: string
  trackUrl: string
}): string {
  return `Hello ${customerFirstName}, your order ${orderNumber} with ${siteName} is now being tracked. Your tracking number is ${trackingNumber}. You can follow it at any time here: ${trackUrl}`
}
