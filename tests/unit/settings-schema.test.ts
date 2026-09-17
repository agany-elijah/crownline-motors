import { describe, expect, it } from "vitest"

import {
  businessInformationSchema,
  commerceSettingsSchema,
  isAllowedSocialUrl,
  trackingNumberPrefixSchema,
} from "@/lib/validations/settings.schema"
import { DEFAULT_BUSINESS_HOURS } from "@/lib/settings/business-hours"

const commerce = {
  defaultInitialPercentage: "50",
  defaultMombasaPercentage: "25",
  defaultFinalPercentage: "25",
}

const business = {
  businessName: "Crownline Motors",
  businessDescription: "Quality vehicles sourced from Japan and Korea.",
  defaultCountry: "SS",
  primaryPhone: "+211 900 000 000",
  whatsappNumber: "+211900000000",
  businessEmail: "info@crownlinemotors.com",
  businessAddress: "Juba, South Sudan",
  publishHours: "on",
  businessHours: JSON.stringify(DEFAULT_BUSINESS_HOURS),
  socialFacebook: "",
  socialInstagram: "",
  socialTiktok: "",
  socialYoutube: "",
  socialLinkedin: "",
  socialX: "",
}

/**
 * The 100% rule has no database constraint behind it — Prisma's schema cannot
 * express a cross-column check, so this Zod schema is the only thing
 * enforcing it (CLAUDE.md, schema documentation §8).
 *
 * A split that does not total 100% would produce an order whose milestones
 * never add up to the price the customer agreed, which surfaces much later as
 * a vehicle that cannot be released or a balance that cannot be cleared.
 */
describe("commerce settings — payment split", () => {
  it("accepts the brief's default 50 / 25 / 25", () => {
    expect(commerceSettingsSchema.safeParse(commerce).success).toBe(true)
  })

  it("accepts any other split that totals 100", () => {
    for (const split of [
      ["60", "20", "20"],
      ["40", "30", "30"],
      ["100", "0", "0"],
      ["33.34", "33.33", "33.33"],
    ]) {
      const result = commerceSettingsSchema.safeParse({
        ...commerce,
        defaultInitialPercentage: split[0],
        defaultMombasaPercentage: split[1],
        defaultFinalPercentage: split[2],
      })

      expect(result.success, `${split.join(" / ")} should be accepted`).toBe(true)
    }
  })

  it("accepts a split that floating-point addition gets wrong", () => {
    // 33.33 + 33.33 + 33.34 is not exactly 100 in IEEE-754.
    expect(0.1 + 0.2).not.toBe(0.3) // the trap this guards against

    const result = commerceSettingsSchema.safeParse({
      ...commerce,
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
      const result = commerceSettingsSchema.safeParse({
        ...commerce,
        defaultInitialPercentage: split[0],
        defaultMombasaPercentage: split[1],
        defaultFinalPercentage: split[2],
      })

      expect(result.success, `${split.join(" / ")} should be rejected`).toBe(false)
    }
  })

  it("rejects negative, over-100 and non-numeric stages", () => {
    expect(
      commerceSettingsSchema.safeParse({
        ...commerce,
        defaultInitialPercentage: "-10",
        defaultMombasaPercentage: "60",
        defaultFinalPercentage: "50",
      }).success
    ).toBe(false)

    expect(commerceSettingsSchema.safeParse({ ...commerce, defaultInitialPercentage: "half" }).success).toBe(false)
  })

  it("owns only the payment schedule — a crafted POST cannot reach other columns", () => {
    const parsed = commerceSettingsSchema.parse({ ...commerce, quoteTerms: "Injected", businessName: "Other" })
    expect(Object.keys(parsed).sort()).toEqual([
      "defaultFinalPercentage",
      "defaultInitialPercentage",
      "defaultMombasaPercentage",
    ])
  })
})

describe("business information — WhatsApp number", () => {
  it("allows an empty value, meaning not configured", () => {
    // Every WhatsApp call-to-action renders nothing when the number is
    // absent — better than linking customers to a placeholder.
    const result = businessInformationSchema.safeParse({ ...business, whatsappNumber: "" })

    expect(result.success).toBe(true)
    expect(result.data?.whatsappNumber).toBe("")
  })

  it("accepts numbers written the way a person reads them", () => {
    for (const number of ["+211900000000", "+211 900 000 000", "+211-900-000-000", "211900000000"]) {
      expect(
        businessInformationSchema.safeParse({ ...business, whatsappNumber: number }).success,
        `${number} should be accepted`
      ).toBe(true)
    }
  })

  it("trims surrounding whitespace", () => {
    const result = businessInformationSchema.safeParse({ ...business, whatsappNumber: "  +211900000000  " })
    expect(result.data?.whatsappNumber).toBe("+211900000000")
  })

  it("rejects values with too few or too many digits, or letters", () => {
    for (const number of ["123", "+1", "12345678901234567890", "call me"]) {
      expect(
        businessInformationSchema.safeParse({ ...business, whatsappNumber: number }).success,
        `${number} should be rejected`
      ).toBe(false)
    }
  })
})

describe("business information — identity and contact", () => {
  it("accepts the defaults", () => {
    expect(businessInformationSchema.safeParse(business).success).toBe(true)
  })

  it("requires a business name", () => {
    expect(businessInformationSchema.safeParse({ ...business, businessName: " " }).success).toBe(false)
  })

  it("only accepts a default country the phone fields know", () => {
    expect(businessInformationSchema.safeParse({ ...business, defaultCountry: "ke" }).data?.defaultCountry).toBe("KE")
    expect(businessInformationSchema.safeParse({ ...business, defaultCountry: "ZZ" }).success).toBe(false)
  })

  it("accepts an empty email but not a malformed one", () => {
    expect(businessInformationSchema.safeParse({ ...business, businessEmail: "" }).success).toBe(true)
    expect(businessInformationSchema.safeParse({ ...business, businessEmail: "not-an-email" }).success).toBe(false)
  })

  it("ignores the hours payload's validity only when hours are not being published", () => {
    // Unpublished hours still arrive and are still validated, so a crafted
    // payload cannot be stored; the action simply stores null.
    expect(
      businessInformationSchema.safeParse({ ...business, publishHours: undefined, businessHours: "[]" }).success
    ).toBe(false)
  })
})

describe("social links", () => {
  it("accepts https links on the network's own domain", () => {
    expect(isAllowedSocialUrl("socialFacebook", "https://www.facebook.com/crownlinemotors")).toBe(true)
    expect(isAllowedSocialUrl("socialX", "https://x.com/crownline")).toBe(true)
    expect(isAllowedSocialUrl("socialYoutube", "https://youtu.be/abc")).toBe(true)
  })

  it("refuses another domain, a lookalike, http and embedded credentials", () => {
    expect(isAllowedSocialUrl("socialFacebook", "https://instagram.com/crownline")).toBe(false)
    expect(isAllowedSocialUrl("socialFacebook", "https://facebook.com.evil.example/page")).toBe(false)
    expect(isAllowedSocialUrl("socialFacebook", "https://notfacebook.com/page")).toBe(false)
    expect(isAllowedSocialUrl("socialFacebook", "http://facebook.com/page")).toBe(false)
    expect(isAllowedSocialUrl("socialFacebook", "https://user:pass@facebook.com/page")).toBe(false)
    expect(isAllowedSocialUrl("socialFacebook", "javascript:alert(1)")).toBe(false)
  })

  it("rejects a bad link through the form schema and accepts an empty one", () => {
    expect(businessInformationSchema.safeParse({ ...business, socialTiktok: "https://tiktok.com/@crownline" }).success).toBe(true)
    expect(businessInformationSchema.safeParse({ ...business, socialTiktok: "tiktok" }).success).toBe(false)
    expect(businessInformationSchema.parse({ ...business, socialTiktok: "" }).socialTiktok).toBeNull()
  })
})

describe("tracking number prefix", () => {
  it("upper-cases and accepts 2–6 letters", () => {
    expect(trackingNumberPrefixSchema.parse("cmx")).toBe("CMX")
    expect(trackingNumberPrefixSchema.safeParse("AB").success).toBe(true)
  })

  it("refuses digits, punctuation and the wrong length", () => {
    for (const prefix of ["C", "CROWNLINE", "CL1", "CL-M"]) {
      expect(trackingNumberPrefixSchema.safeParse(prefix).success, prefix).toBe(false)
    }
  })

  it("refuses prefixes that collide with other references", () => {
    for (const prefix of ["CLMO", "CLMV", "CLMQ", "CLMSP"]) {
      expect(trackingNumberPrefixSchema.safeParse(prefix).success, prefix).toBe(false)
    }
  })
})
