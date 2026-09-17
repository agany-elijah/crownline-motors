/**
 * The session lifetimes an administrator can choose from.
 *
 * A list rather than a free number: "how long until the dashboard asks me to
 * sign in again" is a decision people make in hours and days, and a typed
 * figure invites 0 (sign out on every request) or 99999 (no timeout). The
 * database CHECK bounds the column to 1–720 hours regardless.
 */
export const SESSION_TIMEOUT_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 4, label: "4 hours" },
  { hours: 8, label: "8 hours" },
  { hours: 12, label: "12 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
  { hours: 336, label: "14 days" },
  { hours: 720, label: "30 days" },
] as const

export function sessionTimeoutLabel(hours: number): string {
  return SESSION_TIMEOUT_OPTIONS.find((option) => option.hours === hours)?.label ?? `${hours} hours`
}
