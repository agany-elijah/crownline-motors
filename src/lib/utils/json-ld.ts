/**
 * Serialises structured data for a `<script type="application/ld+json">`.
 *
 * ── Why JSON.stringify alone is not safe here ─────────────────────────
 * The browser's HTML parser ends a script element at the first `</script`
 * it sees, whatever is inside a JSON string. `JSON.stringify` does not escape
 * `<`, so a part named `Pads </script><script>…` would close the element and
 * run whatever followed — stored cross-site scripting on a public page, from
 * a value typed into the dashboard.
 *
 * Escaping `<`, `>` and `&` as JSON unicode escapes keeps the payload
 * equivalent JSON (every consumer decodes the `<` escape back to `<`)
 * while leaving the HTML parser nothing to act on. U+2028 and U+2029 are
 * escaped too: they are legal inside JSON strings but were line terminators
 * in older JavaScript parsers, and escaping them costs nothing.
 *
 * Every JSON-LD block on the site goes through this, rather than each call
 * site remembering its own `.replace` — two did and one did not, which is how
 * this was found.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}
