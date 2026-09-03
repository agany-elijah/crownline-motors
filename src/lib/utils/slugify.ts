/**
 * URL slugs for vehicle pages.
 *
 * These are public, indexable URLs — `/cars/toyota-harrier-2021-clm-v-2026-000123`
 * — so they carry real SEO weight (brief §18) and, once shared or indexed,
 * are effectively permanent. That makes two properties matter more than
 * elegance: they must be unique, and they must be stable.
 */

/**
 * Reduces arbitrary text to a URL-safe slug fragment.
 *
 * The Unicode normalisation step is what makes this correct rather than
 * merely adequate: `NFD` splits an accented character into its base letter
 * and a combining mark, and stripping the marks turns "Citroën" into
 * "citroen" instead of "citron". Vehicle makes and models routinely carry
 * accents, and dropping a letter changes the word.
 */
export function slugifyFragment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks left by NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alphanumerics becomes one hyphen
    .replace(/^-+|-+$/g, "") // no leading or trailing hyphens
}

/**
 * Builds the canonical slug for a vehicle.
 *
 * The reference number is appended deliberately. Two 2021 Toyota Harriers
 * are not an edge case for an importer — they are a normal Tuesday — and
 * `slug` is unique in the database, so a make/model/year slug would collide
 * and fail the second save. Suffixing the reference guarantees uniqueness
 * without a retry loop, and keeps the human-readable part in front where
 * both a customer and a search engine will read it.
 *
 * Callers must treat the result as stable. Regenerating it when a vehicle is
 * edited would break every link already shared over WhatsApp and every URL
 * already indexed — see `vehicle.actions.ts`, which sets the slug once at
 * creation and never again.
 */
export function buildVehicleSlug(input: {
  make: string
  model: string
  year: number
  referenceNumber: string
}): string {
  return [
    slugifyFragment(input.make),
    slugifyFragment(input.model),
    String(input.year),
    slugifyFragment(input.referenceNumber),
  ]
    .filter(Boolean)
    .join("-")
}
