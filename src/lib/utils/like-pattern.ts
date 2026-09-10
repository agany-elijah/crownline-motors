/**
 * Escapes the wildcards `LIKE` reads inside a Prisma `contains` value.
 *
 * Prisma binds the value as a parameter, so this is not an injection defence —
 * that is already handled, and a search term containing a quote is a value
 * rather than syntax. It is a *correctness* fix: Prisma does not escape the
 * pattern metacharacters, so a customer typing `%` would match every row in
 * the table and a `_` would match any single character. Both read as a broken
 * search rather than as a clever one.
 *
 * Backslash is Postgres's default `LIKE` escape character, and Prisma emits no
 * `ESCAPE` clause, so doubling it is what makes a literal backslash survive.
 *
 * Lives in its own module because both catalogues need it and neither owns it.
 * It is pure, so it is also directly unit-testable.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}
