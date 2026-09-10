import type { Prisma } from "@/generated/prisma/client"

/**
 * Does this part fit this car?
 *
 * `SparePartCompatibility` stores fitment as values — make, model, year
 * range, engine — rather than as a foreign key to `Vehicle`, because fitment
 * is a fact about a model of car in the world and not about what happens to
 * be on the dealership floor this week (the reasoning is written out in full
 * on the model in prisma/schema.prisma). That decision moves the question
 * "does it fit?" out of the foreign key and into a predicate, and this module
 * is where that predicate lives — once, so that the SQL that narrows the
 * search and the badge that tells the customer "fits your Harrier" can never
 * answer it differently.
 *
 * ── Matching is exact, case-insensitively ─────────────────────────────
 * "toyota" matches "Toyota". "Landcruiser" does not match "Land Cruiser".
 *
 * That second one is deliberate, and it is the temptation this module
 * refuses. Fuzzy matching — stripping punctuation, collapsing spaces,
 * trigram similarity — would make those two agree, and would also quietly
 * make a part for a "Prado" fit a "Pravda" and a 1.5L fit a 1.5L Turbo. On a
 * catalogue where the consequence of a wrong answer is a customer in Juba
 * paying to import a part that does not fit their car, a false positive is
 * far worse than a false negative.
 *
 * Spelling variants are a data-entry problem with a data-entry fix: the admin
 * fitment form should offer the makes and models already in use rather than
 * a free text box (Stage 14/15), the same argument `Vehicle.features` makes
 * about a curated vocabulary. Until it does, an operator typing the make two
 * ways produces two fitment rules, which is visible and correctable — unlike
 * a matcher that silently over-reaches.
 *
 * ── Why there is no `server-only` marker ──────────────────────────────
 * The only import is a type, erased at compile time, and nothing here touches
 * the database or a secret. Keeping it importable from anywhere is the point:
 * the same predicate runs in a server query and in a client component
 * rendering a fitment badge.
 */

/**
 * One fitment rule, as stored.
 *
 * Structurally typed rather than importing the Prisma model, so a caller can
 * pass the narrow `select` its query actually made instead of a full row.
 */
export interface FitmentRule {
  /** Null means every make — the "fits any vehicle" rule. See the model. */
  make: string | null
  model: string | null
  yearFrom: number | null
  yearTo: number | null
  engine: string | null
}

/**
 * The car being asked about.
 *
 * `engineSize` is optional because the two callers know different amounts. A
 * vehicle listing always has one; a customer typing "Toyota Harrier 2021"
 * into a parts search does not. Absent means "do not consider the engine" —
 * so the answer widens rather than silently narrowing to nothing.
 */
export interface FitmentTarget {
  make: string
  model?: string | null
  year?: number | null
  engineSize?: string | null
}

/** Trimmed and lower-cased. The one normalisation both sides apply. */
function normalize(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Compares two free-text fitment values, either of which may be absent.
 *
 * A null on the *rule* side widens the rule: "Toyota, all models" is one row,
 * not two hundred. A null on the *target* side means the caller did not
 * supply that detail, which cannot be treated as a mismatch — it is a
 * question that was not asked.
 */
function textMatches(ruleValue: string | null, targetValue: string | null | undefined): boolean {
  if (ruleValue === null || ruleValue.trim() === "") return true
  if (targetValue === null || targetValue === undefined || targetValue.trim() === "") {
    return true
  }

  return normalize(ruleValue) === normalize(targetValue)
}

/**
 * Is `year` inside the rule's range?
 *
 * Both bounds are inclusive and either may be absent, meaning unbounded in
 * that direction. A rule with no bounds at all fits every year, which is how
 * a part that has not changed across generations is listed.
 *
 * A reversed range would match nothing; the database refuses to store one
 * (`SparePartCompatibility_year_range_check`), so this does not have to
 * decide what a reversed range means.
 */
function yearMatches(rule: FitmentRule, year: number | null | undefined): boolean {
  if (year === null || year === undefined) return true
  if (rule.yearFrom !== null && year < rule.yearFrom) return false
  if (rule.yearTo !== null && year > rule.yearTo) return false

  return true
}

/** Does this one fitment rule cover this car? */
export function ruleFitsVehicle(rule: FitmentRule, target: FitmentTarget): boolean {
  /**
   * `make` goes through the same `textMatches` as every other column, which
   * is what gives a null make its meaning: the rule widens to every make
   * rather than matching none. Special-casing it here would be a second
   * reading of the same null, and the two would eventually disagree.
   */
  return (
    textMatches(rule.make, target.make) &&
    textMatches(rule.model, target.model) &&
    yearMatches(rule, target.year) &&
    textMatches(rule.engine, target.engineSize)
  )
}

/**
 * Does any of a part's fitment rules cover this car?
 *
 * A part with no rules at all fits nothing. That is the honest answer rather
 * than the convenient one: an unfinished listing whose fitment has not been
 * entered yet must not claim to fit whatever the customer is holding.
 */
export function partFitsVehicle(
  rules: readonly FitmentRule[],
  target: FitmentTarget
): boolean {
  return rules.some((rule) => ruleFitsVehicle(rule, target))
}

/**
 * A `where` fragment that narrows `SparePartCompatibility` to the rules that
 * could cover this car.
 *
 * Every clause mirrors the predicate above exactly — same
 * insensitive-equality, same "null widens the rule" reading of each optional
 * column — so the rows this returns are the rows `ruleFitsVehicle` accepts.
 * Both are written here, next to each other, because the failure mode of
 * letting them drift is a catalogue that lists a part on a vehicle page and
 * then tells the customer it does not fit.
 *
 * Callers still hold the predicate for anything already in memory: a card
 * already carrying its fitment rules should not make a round trip to ask a
 * question it can answer.
 */
export function fitmentWhereForVehicle(
  target: FitmentTarget
): Prisma.SparePartCompatibilityWhereInput {
  const clauses: Prisma.SparePartCompatibilityWhereInput[] = [
    /**
     * `{ make: null }` is the universal rule, and it has to be ORed in here
     * exactly as the other optional columns are — a bare equality would
     * exclude every "fits any vehicle" listing from the one query written to
     * find parts for a car.
     */
    {
      OR: [
        { make: null },
        { make: { equals: target.make.trim(), mode: "insensitive" } },
      ],
    },
  ]

  if (target.model && target.model.trim() !== "") {
    clauses.push({
      OR: [{ model: null }, { model: { equals: target.model.trim(), mode: "insensitive" } }],
    })
  }

  if (target.year !== null && target.year !== undefined) {
    clauses.push({ OR: [{ yearFrom: null }, { yearFrom: { lte: target.year } }] })
    clauses.push({ OR: [{ yearTo: null }, { yearTo: { gte: target.year } }] })
  }

  if (target.engineSize && target.engineSize.trim() !== "") {
    clauses.push({
      OR: [
        { engine: null },
        { engine: { equals: target.engineSize.trim(), mode: "insensitive" } },
      ],
    })
  }

  return { AND: clauses }
}

/**
 * The fitment rule as a customer reads it — "Toyota Harrier 2020–2023 (2.0L)".
 *
 * Rendering this from the stored columns rather than from a free-text summary
 * an operator types is what keeps the badge, the compatibility table and the
 * matcher describing the same rule. An en dash for the range because that is
 * what a year span takes; "2020 onwards" and "up to 2023" for the open-ended
 * cases, because "2020–" reads like a typo.
 */
export function describeFitment(rule: FitmentRule): string {
  /**
   * A rule with no make covers everything, and everything below it is
   * therefore already implied — "All vehicles (all models) 2015 onwards"
   * says the middle clause twice and the year bound about nothing in
   * particular. The engine is the one qualifier that still means something
   * (a universal oil filter for 2.0L engines), so it is kept.
   */
  if (rule.make === null || rule.make.trim() === "") {
    return withEngine("All vehicles", rule.engine)
  }

  const parts: string[] = [rule.make.trim()]

  if (rule.model && rule.model.trim() !== "") {
    parts.push(rule.model.trim())
  } else {
    parts.push("(all models)")
  }

  const years = describeYearRange(rule.yearFrom, rule.yearTo)
  if (years) parts.push(years)

  return withEngine(parts.join(" "), rule.engine)
}

/** Appends the engine qualifier when the rule names one. */
function withEngine(description: string, engine: string | null): string {
  return engine && engine.trim() !== ""
    ? `${description} (${engine.trim()})`
    : description
}

function describeYearRange(from: number | null, to: number | null): string | null {
  if (from !== null && to !== null) {
    return from === to ? String(from) : `${from}–${to}`
  }
  if (from !== null) return `${from} onwards`
  if (to !== null) return `up to ${to}`

  return null
}
