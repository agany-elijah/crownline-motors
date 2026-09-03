/**
 * Money and measurement formatting.
 *
 * Centralised so a price reads identically on the admin list, the vehicle
 * page and a future invoice. Two figures for the same vehicle formatted two
 * ways is the kind of small inconsistency that makes a customer wonder
 * which one is real.
 */

/**
 * Crownline prices in US dollars.
 *
 * The brief's examples are all USD ("$22,500"), which is the working
 * currency for imports into South Sudan. Multi-currency is Phase 3 of the
 * roadmap; when it arrives, this is the single place that has to learn
 * about it, which is most of the reason it exists now.
 */
const CURRENCY = "USD"
const LOCALE = "en-US"

/**
 * Formats a price for display: `$22,500` or `$22,500.50`.
 *
 * Whole amounts drop the decimals — vehicles are priced in round figures,
 * and `$22,500.00` reads like an accounting export rather than a price.
 * Fractional amounts keep both places, because dropping them would show a
 * different number from the one stored.
 */
export function formatCurrency(amount: number): string {
  const hasFraction = Math.abs(amount % 1) > 1e-9

  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formats an amount that may not be known yet.
 *
 * Returns the placeholder for null — never "$0". An unset shipping estimate
 * means "we have not priced this", and showing zero would state, with
 * apparent confidence, that shipping is free.
 */
export function formatCurrencyOrDash(
  amount: number | null | undefined,
  placeholder = "—"
): string {
  return amount === null || amount === undefined ? placeholder : formatCurrency(amount)
}

/** Formats a distance: `42,000 km`. */
export function formatMileage(km: number): string {
  return `${new Intl.NumberFormat(LOCALE).format(km)} km`
}

/** Formats a plain integer with thousands separators. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value)
}
