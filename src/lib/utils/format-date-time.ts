/**
 * Dates and times as the dashboard's security pages show them.
 *
 * Formatted on the server in one fixed zone and handed to components as
 * strings, so the server render and the browser's hydration can never
 * disagree about a timestamp — and every administrator reads the same time
 * for the same event, whichever device they are on.
 *
 * East Africa Time: the dealership's own clock, so "signed in at 14:32" means
 * what the person in Juba remembers doing.
 */
const TIME_ZONE = "Africa/Juba"

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
})

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE })

export function formatDateTime(value: Date): string {
  return DATE_TIME.format(value)
}

export function formatDate(value: Date): string {
  return DATE.format(value)
}

/** "just now", "12 minutes ago", "3 hours ago", else the date and time. */
export function formatRelativeTime(value: Date, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - value.getTime()) / 60_000)
  if (minutes < 2) return "Just now"
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  return formatDateTime(value)
}
