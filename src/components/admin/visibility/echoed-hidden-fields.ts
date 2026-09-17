/**
 * The `hiddenFields` a rejected submission echoed back, or undefined when
 * there is nothing usable — the form then falls back to the stored value.
 * The field list itself is re-checked by `normalizeHiddenFields` downstream.
 */
export function echoedHiddenFields(value: string | undefined): string[] | undefined {
  if (!value) return undefined

  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : undefined
  } catch {
    // A value this form did not produce; the stored choice is the safe default.
    return undefined
  }
}
