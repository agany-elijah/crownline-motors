/**
 * Calendar dates as a customer reads them, for estimates stored as the start
 * of a day in UTC (see `orderDeliveryDateSchema`). Formatted in UTC for the
 * same reason: a date must not slip a day for a reader in another time zone.
 */

const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })

export function formatCalendarDate(date: Date): string {
  return DAY_MONTH_YEAR.format(date)
}

/**
 * "17–30 October 2026", "28 September – 5 October 2026", or one date when
 * there is no end (or the end is the same day). Written with the shortest
 * form that stays unambiguous.
 */
export function formatDateRange(start: Date, end: Date | null): string {
  if (!end || end.getTime() <= start.getTime()) return formatCalendarDate(start)

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth()

  if (sameMonth) return `${start.getUTCDate()}–${DAY_MONTH_YEAR.format(end)}`
  if (sameYear) return `${DAY_MONTH.format(start)} – ${DAY_MONTH_YEAR.format(end)}`
  return `${DAY_MONTH_YEAR.format(start)} – ${DAY_MONTH_YEAR.format(end)}`
}
