import { humaniseCode } from "@/lib/constants/audit-actions"
import { diffSettings, type SettingChange } from "@/lib/settings/audit-diff"

/**
 * "What changed" for one audit entry, as previous → new pairs.
 *
 * The log was written by many actions over the life of the application, and
 * they recorded their metadata in a handful of shapes. This reads each of
 * them, and returns nothing for an entry that recorded no before-and-after —
 * the entry's action and resource already say what happened.
 *
 * Metadata is a Json column: untrusted in shape, so every field is checked
 * before it is used. Pure, and unit-tested.
 */

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return /^[A-Z][A-Z0-9_]+$/.test(value) ? humaniseCode(value) : value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

export function describeAuditChanges(metadata: unknown): SettingChange[] {
  if (!isRecord(metadata)) return []

  // Settings, account and branding actions: `{ changes: [{ field, from, to }] }`.
  if (Array.isArray(metadata.changes)) {
    return metadata.changes.flatMap((change) =>
      isRecord(change) && typeof change.field === "string"
        ? [{ field: change.field, from: asText(change.from), to: asText(change.to) }]
        : []
    )
  }

  // The original single settings form: `{ previous: {...}, next: {...} }`.
  if (isRecord(metadata.next)) {
    return diffSettings(isRecord(metadata.previous) ? metadata.previous : null, metadata.next)
  }

  // Status transitions across vehicles, parts, quotes and orders.
  if ("previousStatus" in metadata || "newStatus" in metadata) {
    return [{ field: "Status", from: asText(metadata.previousStatus), to: asText(metadata.newStatus) }]
  }

  // Price edits on a listing.
  if ("priceChangedFrom" in metadata || "priceChangedTo" in metadata) {
    return [{ field: "Price", from: asText(metadata.priceChangedFrom), to: asText(metadata.priceChangedTo) }]
  }

  // A single named field.
  if (typeof metadata.field === "string" && ("from" in metadata || "to" in metadata)) {
    return [{ field: metadata.field, from: asText(metadata.from), to: asText(metadata.to) }]
  }

  return []
}
