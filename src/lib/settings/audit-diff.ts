/**
 * What changed in a settings save, in the shape the Security Activity log
 * renders as "previous → new".
 *
 * Every settings action records `{ changes: SettingChange[] }`. Recording
 * only the fields that actually changed is what keeps the log readable: a
 * save that altered the WhatsApp number says so, rather than burying it
 * among twenty unchanged values.
 *
 * Pure, so it is unit-tested.
 */

export interface SettingChange {
  field: string
  from: string | null
  to: string | null
}

/** Longer values are summarised rather than copied into every audit row. */
const MAX_VALUE_LENGTH = 160

/**
 * JSON with object keys sorted.
 *
 * Postgres stores `jsonb` with its keys reordered, so the business hours read
 * back from the database and the same hours just validated from the form
 * serialise differently with plain `JSON.stringify` — and every save would
 * record hours that had not changed.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`
  }

  return JSON.stringify(value)
}

function normalise(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value instanceof Date) return value.toISOString()
  return stableStringify(value)
}

function clip(value: string | null): string | null {
  if (value === null || value.length <= MAX_VALUE_LENGTH) return value
  return `${value.slice(0, MAX_VALUE_LENGTH - 1)}…`
}

function isNumeric(value: string): boolean {
  return value.trim() !== "" && !Number.isNaN(Number(value))
}

/**
 * The fields in `next` whose value differs from `previous`.
 *
 * Callers pass plain values (Decimals already converted), and structured
 * values compare by content. Numbers that are equal but formatted
 * differently — "50" and "50.00" — are not a change.
 */
export function diffSettings(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown>,
  labels: Record<string, string> = {}
): SettingChange[] {
  const changes: SettingChange[] = []

  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue
    collectChanges(changes, labels[key] ?? key, previous?.[key], value)
  }

  return changes
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)
}

/** "sparePart" → "spare part", "stockQuantity" → "stock quantity". */
function humaniseKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()
}

/**
 * One change per leaf that differs. A group of switches stored as one object
 * (catalogue display, say) is reported switch by switch — "Catalogue display ›
 * spare part › category: true → false" — rather than as two walls of JSON an
 * operator has to compare by eye.
 */
function collectChanges(changes: SettingChange[], field: string, before: unknown, after: unknown) {
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
    for (const key of keys) {
      if (after[key] === undefined && before[key] === undefined) continue
      collectChanges(changes, `${field} › ${humaniseKey(key)}`, before[key], after[key])
    }
    return
  }

  const from = normalise(before)
  const to = normalise(after)

  if (from === to) return
  if (from !== null && to !== null && isNumeric(from) && isNumeric(to) && Number(from) === Number(to)) return

  changes.push({ field, from: clip(from), to: clip(to) })
}
