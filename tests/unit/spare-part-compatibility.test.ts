import { describe, expect, it } from "vitest"

import {
  describeFitment,
  fitmentWhereForVehicle,
  partFitsVehicle,
  ruleFitsVehicle,
  type FitmentRule,
} from "@/lib/utils/spare-part-compatibility"

/**
 * Fitment is the one question a spare-parts catalogue has to get right.
 *
 * A wrong answer is not a cosmetic defect: it is a customer in Juba paying to
 * import a part that does not fit their car, having been told on our own page
 * that it would. So these tests care as much about what must *not* match as
 * about what must.
 *
 * `SparePartCompatibility` stores fitment as values rather than as a foreign
 * key to Vehicle, because a Harrier brake pad fits every 2020–2023 Harrier
 * whether or not one is on the dealership floor. That is what makes this a
 * predicate to be tested rather than a join to be trusted.
 */

/** A complete rule, narrowed per test. Keeps each case to what it is about. */
function rule(overrides: Partial<FitmentRule> = {}): FitmentRule {
  return {
    make: "Toyota",
    model: "Harrier",
    yearFrom: 2020,
    yearTo: 2023,
    engine: null,
    ...overrides,
  }
}

describe("ruleFitsVehicle", () => {
  it("matches a car inside the rule", () => {
    expect(
      ruleFitsVehicle(rule(), { make: "Toyota", model: "Harrier", year: 2021 })
    ).toBe(true)
  })

  it("treats the year range as inclusive at both ends", () => {
    const fitment = rule()
    const car = { make: "Toyota", model: "Harrier" }

    expect(ruleFitsVehicle(fitment, { ...car, year: 2020 })).toBe(true)
    expect(ruleFitsVehicle(fitment, { ...car, year: 2023 })).toBe(true)
    expect(ruleFitsVehicle(fitment, { ...car, year: 2019 })).toBe(false)
    expect(ruleFitsVehicle(fitment, { ...car, year: 2024 })).toBe(false)
  })

  it("reads an absent bound as unbounded in that direction", () => {
    const openEnded = rule({ yearFrom: 2015, yearTo: null })
    const car = { make: "Toyota", model: "Harrier" }

    expect(ruleFitsVehicle(openEnded, { ...car, year: 2015 })).toBe(true)
    expect(ruleFitsVehicle(openEnded, { ...car, year: 2099 })).toBe(true)
    expect(ruleFitsVehicle(openEnded, { ...car, year: 2014 })).toBe(false)

    const upTo = rule({ yearFrom: null, yearTo: 2010 })
    expect(ruleFitsVehicle(upTo, { ...car, year: 1998 })).toBe(true)
    expect(ruleFitsVehicle(upTo, { ...car, year: 2011 })).toBe(false)
  })

  it("reads a null model as every model of that make", () => {
    // "Toyota, all models, 2015 onwards" is one row in a real parts
    // catalogue, not two hundred.
    const anyModel = rule({ model: null, yearFrom: null, yearTo: null })

    expect(ruleFitsVehicle(anyModel, { make: "Toyota", model: "Harrier", year: 2021 })).toBe(
      true
    )
    expect(ruleFitsVehicle(anyModel, { make: "Toyota", model: "Hilux", year: 2008 })).toBe(
      true
    )
    expect(ruleFitsVehicle(anyModel, { make: "Nissan", model: "X-Trail", year: 2021 })).toBe(
      false
    )
  })

  it("reads a null engine as any engine", () => {
    expect(
      ruleFitsVehicle(rule(), {
        make: "Toyota",
        model: "Harrier",
        year: 2021,
        engineSize: "2.0L",
      })
    ).toBe(true)
  })

  it("narrows on engine when the rule names one", () => {
    const twoLitre = rule({ engine: "2.0L" })
    const car = { make: "Toyota", model: "Harrier", year: 2021 }

    expect(ruleFitsVehicle(twoLitre, { ...car, engineSize: "2.0L" })).toBe(true)
    expect(ruleFitsVehicle(twoLitre, { ...car, engineSize: "2.5L Hybrid" })).toBe(false)
  })

  it("ignores a detail the caller did not supply rather than treating it as a mismatch", () => {
    // A customer searching "Toyota Harrier 2021" has not told us their engine.
    // That is a question not asked, not an answer of "no" — the alternative
    // hides every engine-specific part from the person most likely to want one.
    const twoLitre = rule({ engine: "2.0L" })

    expect(ruleFitsVehicle(twoLitre, { make: "Toyota", model: "Harrier", year: 2021 })).toBe(
      true
    )
    // Likewise a search with no year at all.
    expect(ruleFitsVehicle(rule(), { make: "Toyota", model: "Harrier" })).toBe(true)
  })

  it("matches case- and whitespace-insensitively", () => {
    // An operator types "toyota", the vehicle record says "Toyota". Neither
    // is wrong and both must match.
    expect(
      ruleFitsVehicle(rule({ make: "toyota", model: " harrier " }), {
        make: "TOYOTA",
        model: "Harrier",
        year: 2021,
      })
    ).toBe(true)
  })

  it("does not match different spellings of the same model", () => {
    // Deliberate. Collapsing punctuation and spacing would make "Landcruiser"
    // and "Land Cruiser" agree — and would also make a "Prado" part fit
    // things it does not. A false positive here costs a customer an import;
    // spelling variants are fixed at data entry with a picker, where they are
    // visible and correctable.
    expect(
      ruleFitsVehicle(rule({ model: "Land Cruiser" }), {
        make: "Toyota",
        model: "Landcruiser",
        year: 2021,
      })
    ).toBe(false)
  })

  it("does not match a different make", () => {
    expect(
      ruleFitsVehicle(rule(), { make: "Lexus", model: "Harrier", year: 2021 })
    ).toBe(false)
  })
})

describe("partFitsVehicle", () => {
  it("fits if any one rule covers the car", () => {
    const rules = [
      rule({ model: "Harrier", yearFrom: 2020, yearTo: 2023 }),
      rule({ model: "RAV4", yearFrom: 2019, yearTo: 2024 }),
    ]

    expect(partFitsVehicle(rules, { make: "Toyota", model: "RAV4", year: 2020 })).toBe(true)
    expect(partFitsVehicle(rules, { make: "Toyota", model: "Hilux", year: 2020 })).toBe(
      false
    )
  })

  it("fits nothing when no fitment has been entered", () => {
    // The honest answer rather than the convenient one: a listing whose
    // fitment is still blank must not claim to fit whatever the customer is
    // holding.
    expect(partFitsVehicle([], { make: "Toyota", model: "Harrier", year: 2021 })).toBe(
      false
    )
  })
})

describe("fitmentWhereForVehicle", () => {
  /**
   * The `where` and the predicate are two expressions of one rule, and the
   * failure mode of letting them drift is a part listed on a vehicle page
   * that the fitment badge then says does not fit. These tests pin the shape
   * of the query so that a change to one without the other is visible.
   */
  it("always constrains the make, insensitively", () => {
    expect(fitmentWhereForVehicle({ make: " Toyota " })).toEqual({
      AND: [
        {
          OR: [
            // A rule with no make fits every vehicle, so it has to be
            // selected here too — the same "null widens the rule" reading
            // every other column already gets.
            { make: null },
            { make: { equals: "Toyota", mode: "insensitive" } },
          ],
        },
      ],
    })
  })

  it("lets a null model through as 'all models of this make'", () => {
    const where = fitmentWhereForVehicle({ make: "Toyota", model: "Harrier" })

    expect(where.AND).toContainEqual({
      OR: [{ model: null }, { model: { equals: "Harrier", mode: "insensitive" } }],
    })
  })

  it("brackets the year from both sides, treating null bounds as open", () => {
    const where = fitmentWhereForVehicle({ make: "Toyota", year: 2021 })

    expect(where.AND).toContainEqual({ OR: [{ yearFrom: null }, { yearFrom: { lte: 2021 } }] })
    expect(where.AND).toContainEqual({ OR: [{ yearTo: null }, { yearTo: { gte: 2021 } }] })
  })

  it("omits a clause entirely for a detail the caller did not supply", () => {
    // Matching the predicate: an unsupplied detail must widen the result, not
    // filter it to nothing.
    const where = fitmentWhereForVehicle({ make: "Toyota", model: "", engineSize: null })

    // The make clause is an OR rather than a bare equality, because a rule
    // with no make at all fits every vehicle and must not be filtered out of
    // the one query written to find parts for a car.
    expect(where.AND).toEqual([
      {
        OR: [
          { make: null },
          { make: { equals: "Toyota", mode: "insensitive" } },
        ],
      },
    ])
  })

  it("agrees with the in-memory predicate on the same data", () => {
    /**
     * The property that matters, checked directly: for every rule in a small
     * fixture set, being selected by the query must mean the same thing as
     * being accepted by the predicate. The query is applied here by hand,
     * which is the closest a unit test can get to Postgres without one.
     */
    const rules: FitmentRule[] = [
      rule({ model: "Harrier", yearFrom: 2020, yearTo: 2023 }),
      rule({ model: null, yearFrom: null, yearTo: null }),
      rule({ model: "Harrier", yearFrom: 2013, yearTo: 2019 }),
      rule({ make: "Nissan", model: "X-Trail", yearFrom: 2018, yearTo: 2024 }),
      rule({ model: "Harrier", yearFrom: 2020, yearTo: 2023, engine: "2.5L Hybrid" }),
      // The universal rule: no make at all, which fits anything.
      rule({ make: null, model: null, yearFrom: null, yearTo: null }),
    ]

    const target = {
      make: "toyota",
      model: "Harrier",
      year: 2021,
      engineSize: "2.0L",
    }

    const selectedByQuery = rules.filter(
      (r) =>
        (r.make === null || r.make.toLowerCase() === target.make.toLowerCase()) &&
        (r.model === null || r.model.toLowerCase() === target.model.toLowerCase()) &&
        (r.yearFrom === null || r.yearFrom <= target.year) &&
        (r.yearTo === null || r.yearTo >= target.year) &&
        (r.engine === null || r.engine.toLowerCase() === target.engineSize.toLowerCase())
    )
    const acceptedByPredicate = rules.filter((r) => ruleFitsVehicle(r, target))

    expect(acceptedByPredicate).toEqual(selectedByQuery)
    // And it is a real selection, not two empty sets agreeing: the two Harrier
    // rules that cover 2021, plus the universal one.
    expect(acceptedByPredicate).toHaveLength(3)
  })
})

describe("describeFitment", () => {
  it("reads as a customer would say it", () => {
    expect(describeFitment(rule())).toBe("Toyota Harrier 2020–2023")
  })

  it("names the engine when the rule is engine-specific", () => {
    expect(describeFitment(rule({ engine: "2.0L" }))).toBe("Toyota Harrier 2020–2023 (2.0L)")
  })

  it("collapses a single-year range", () => {
    expect(describeFitment(rule({ yearFrom: 2021, yearTo: 2021 }))).toBe(
      "Toyota Harrier 2021"
    )
  })

  it("spells out an open-ended range rather than leaving a dangling dash", () => {
    expect(describeFitment(rule({ yearFrom: 2020, yearTo: null }))).toBe(
      "Toyota Harrier 2020 onwards"
    )
    expect(describeFitment(rule({ yearFrom: null, yearTo: 2019 }))).toBe(
      "Toyota Harrier up to 2019"
    )
  })

  it("says so when a rule covers every model or every year", () => {
    expect(
      describeFitment(rule({ model: null, yearFrom: null, yearTo: null }))
    ).toBe("Toyota (all models)")
  })

  it("reduces a universal rule to two words", () => {
    /**
     * A rule with no make covers everything, which makes every qualifier
     * under it redundant — "All vehicles (all models) 2020–2023" says the
     * middle clause twice and bounds the years of nothing in particular.
     * This is the tag printed on the card of a wiper blade or a bulb, so it
     * has to be short and it has to be true.
     */
    expect(describeFitment(rule({ make: null, model: null }))).toBe("All vehicles")
    expect(
      describeFitment(rule({ make: null, model: null, yearFrom: null, yearTo: null }))
    ).toBe("All vehicles")
  })

  it("keeps the engine on a universal rule, because that one still narrows", () => {
    // A universal oil filter for 2.0L engines is a real listing: the make is
    // irrelevant and the engine is the whole rule.
    expect(describeFitment(rule({ make: null, model: null, engine: "2.0L" }))).toBe(
      "All vehicles (2.0L)"
    )
  })
})
