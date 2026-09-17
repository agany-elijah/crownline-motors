/**
 * Business hours: the shape stored in `BusinessSettings.businessHours`, the
 * defaults, and how a week of opening times is written out for customers.
 *
 * Pure, so the grouping ("Mon – Sat", not six identical lines) is
 * unit-tested rather than eyeballed.
 *
 * ── Why times are strings ─────────────────────────────────────────────
 * "08:00" is a wall-clock time at the dealership, not an instant. Storing a
 * Date would attach a timezone and a day to something that has neither, and
 * the first server running in UTC would move Juba's opening hour.
 */

export const WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const

export type Weekday = (typeof WEEKDAYS)[number]

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
}

const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
}

export interface BusinessHoursDay {
  day: Weekday
  closed: boolean
  /** 24-hour "HH:MM". Kept when `closed`, so reopening a day restores it. */
  opensAt: string
  closesAt: string
}

/** Exactly seven days, Monday first. */
export type BusinessHours = BusinessHoursDay[]

/** `HH:MM`, 00:00–23:59. */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const DEFAULT_BUSINESS_HOURS: BusinessHours = WEEKDAYS.map((day) => ({
  day,
  closed: day === "SUNDAY",
  opensAt: "08:00",
  closesAt: "18:00",
}))

/** "08:00" → "8:00 AM", "18:30" → "6:30 PM". */
export function formatTimeOfDay(value: string): string {
  const match = TIME_OF_DAY_PATTERN.exec(value)
  if (!match) return value

  const hours = Number(match[1])
  const minutes = value.slice(3)
  const suffix = hours < 12 ? "AM" : "PM"
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12

  return `${twelveHour}:${minutes} ${suffix}`
}

function describeDay(day: BusinessHoursDay): string {
  return day.closed ? "Closed" : `${formatTimeOfDay(day.opensAt)} – ${formatTimeOfDay(day.closesAt)}`
}

/**
 * The week as customers read it: consecutive days with the same hours
 * collapsed into one line.
 *
 *   Mon – Sat: 8:00 AM – 6:00 PM
 *   Sun: Closed
 *
 * Only *consecutive* days are grouped. "Mon, Wed, Fri" style lists are
 * accurate but read as a puzzle on a phone, and a week that alternates is
 * rare enough that one line per run is the clearer answer.
 */
export function summariseBusinessHours(hours: BusinessHours): string[] {
  const lines: string[] = []
  let runStart = 0

  for (let index = 1; index <= hours.length; index += 1) {
    const endOfRun =
      index === hours.length || describeDay(hours[index]) !== describeDay(hours[runStart])

    if (!endOfRun) continue

    const first = WEEKDAY_SHORT_LABELS[hours[runStart].day]
    const last = WEEKDAY_SHORT_LABELS[hours[index - 1].day]
    const days = runStart === index - 1 ? first : `${first} – ${last}`

    lines.push(`${days}: ${describeDay(hours[runStart])}`)
    runStart = index
  }

  return lines
}
