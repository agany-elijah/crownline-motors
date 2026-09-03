import { describe, expect, it } from "vitest"

import { businessSettingsSchema } from "@/lib/validations/settings.schema"

const valid = {
  whatsappNumber: "+211900000000",
  defaultInitialPercentage: "50",
  defaultMombasaPercentage: "25",
  defaultFinalPercentage: "25",
}

/**
 * The 100% rule has no database constraint behind it — Prisma's schema
 * cannot express a cross-column check, so this Zod schema is the only thing
 * enforcing it (CLAUDE.md, schema documentation §8).
 *
 * A split that does not total 100% would produce an order whose milestones
 * never add up to the price the customer agreed, which surfaces much later
 * as a vehicle that cannot be released or a balance that cannot be cleared.
 * That makes this one of the highest-value schemas in the application to
 * test properly.
 */
describe("business settings — payment split", () => {
  it("accepts the brief's default 50 / 25 / 25", () => {
    expect(businessSettingsSchema.safeParse(valid).success).toBe(true)
  })

  it("accepts any other split that totals 100", () => {
    for (const split of [
      ["60", "20", "20"],
      ["40", "30", "30"],
      ["100", "0", "0"],
      ["33.34", "33.33", "33.33"],
    ]) {
      const result = businessSettingsSchema.safeParse({
        ...valid,
        defaultInitialPercentage: split[0],
        defaultMombasaPercentage: split[1],
        defaultFinalPercentage: split[2],
      })

      expect(result.success, `${split.join(" / ")} should be accepted`).toBe(true)
    }
  })

  it("accepts a split that floating-point addition gets wrong", () => {
    // 33.33 + 33.33 + 33.34 is not exactly 100 in IEEE-754. A naive
    // `sum === 100` rejects this, and an admin who cannot save a correct
    // value will eventually enter an incorrect one that does pass.
    expect(0.1 + 0.2).not.toBe(0.3) // the trap this guards against

    const result = businessSettingsSchema.safeParse({
      ...valid,
      defaultInitialPercentage: "33.33",
      defaultMombasaPercentage: "33.33",
      defaultFinalPercentage: "33.34",
    })

    expect(result.success).toBe(true)
  })

  it("rejects a split that does not total 100", () => {
    for (const split of [
      ["50", "25", "20"], // short — the customer never pays in full
      ["50", "30", "25"], // over — the customer is overcharged
      ["0", "0", "0"],
    ]) {
      const result = businessSettingsSchema.safeParse({
        ...valid,
        defaultInitialPercentage: split[0],
        defaultMombasaPercentage: split[1],
        defaultFinalPercentage: split[2],
      })

      expect(result.success, `${split.join(" / ")} should be rejected`).toBe(false)
    }
  })

  it("rejects negative and over-100 stages", () => {
    expect(
      businessSettingsSchema.safeParse({
        ...valid,
        defaultInitialPercentage: "-10",
        defaultMombasaPercentage: "60",
        defaultFinalPercentage: "50",
      }).success
    ).toBe(false)

    expect(
      businessSettingsSchema.safeParse({
        ...valid,
        defaultInitialPercentage: "110",
        defaultMombasaPercentage: "-5",
        defaultFinalPercentage: "-5",
      }).success
    ).toBe(false)
  })

  it("rejects non-numeric input", () => {
    expect(
      businessSettingsSchema.safeParse({
        ...valid,
        defaultInitialPercentage: "half",
      }).success
    ).toBe(false)
  })
})

describe("business settings — WhatsApp number", () => {
  it("allows an empty value, meaning not configured", () => {
    // Every WhatsApp call-to-action renders nothing when the number is
    // absent, which is the correct behaviour — better than linking
    // customers to a placeholder that does not answer.
    const result = businessSettingsSchema.safeParse({ ...valid, whatsappNumber: "" })

    expect(result.success).toBe(true)
    expect(result.data?.whatsappNumber).toBe("")
  })

  it("accepts numbers written the way a person reads them", () => {
    for (const number of [
      "+211900000000",
      "+211 900 000 000",
      "+211-900-000-000",
      "211900000000",
    ]) {
      expect(
        businessSettingsSchema.safeParse({ ...valid, whatsappNumber: number }).success,
        `${number} should be accepted`
      ).toBe(true)
    }
  })

  it("trims surrounding whitespace", () => {
    const result = businessSettingsSchema.safeParse({
      ...valid,
      whatsappNumber: "  +211900000000  ",
    })

    expect(result.data?.whatsappNumber).toBe("+211900000000")
  })

  it("rejects values with too few or too many digits", () => {
    for (const number of ["123", "+1", "12345678901234567890"]) {
      expect(
        businessSettingsSchema.safeParse({ ...valid, whatsappNumber: number }).success,
        `${number} should be rejected`
      ).toBe(false)
    }
  })
})
