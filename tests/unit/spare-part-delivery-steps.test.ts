import { describe, expect, it } from "vitest"

import {
  DEFAULT_SPARE_PART_DELIVERY_STEPS,
  MAX_SPARE_PART_DELIVERY_STEPS,
  SPARE_PART_DELIVERY_STEP_DESCRIPTION_MAX,
  SPARE_PART_DELIVERY_STEP_TITLE_MAX,
} from "@/lib/constants/spare-part-delivery"
import {
  businessSettingsSchema,
  sparePartDeliveryStepsSchema,
} from "@/lib/validations/settings.schema"

/**
 * The "How your part reaches you" steps.
 *
 * These live in a `Json` column, which Postgres does not look inside. That
 * makes this schema load-bearing in both directions: it is what validates an
 * operator's submission on the way in, and it is what the read path parses
 * with before a public page renders whatever a restored backup or a hand edit
 * in Studio happens to have left there.
 */

const step = (overrides: Record<string, unknown> = {}) => ({
  title: "We confirm and quote",
  description:
    "You get a written quotation covering the part, shipping and clearing.",
  ...overrides,
})

describe("sparePartDeliveryStepsSchema", () => {
  it("accepts a normal list of steps", () => {
    expect(sparePartDeliveryStepsSchema.safeParse([step(), step()]).success).toBe(true)
  })

  it("accepts an empty list, which is how the section is hidden", () => {
    /**
     * An empty array is a deliberate decision, and it is distinct from the
     * column being null — which means "never configured" and falls back to the
     * built-in steps. Rejecting it would leave an operator unable to remove
     * the section at all.
     */
    expect(sparePartDeliveryStepsSchema.safeParse([]).success).toBe(true)
  })

  it("refuses a step missing either half", () => {
    // A title with no sentence is a word under a numeral; a sentence with no
    // title has nothing for the eye to land on. Both make the band look
    // broken rather than short.
    expect(
      sparePartDeliveryStepsSchema.safeParse([step({ title: "" })]).success
    ).toBe(false)
    expect(
      sparePartDeliveryStepsSchema.safeParse([step({ description: "" })]).success
    ).toBe(false)
  })

  it("bounds both fields, because the layout they render into is fixed", () => {
    expect(
      sparePartDeliveryStepsSchema.safeParse([
        step({ title: "x".repeat(SPARE_PART_DELIVERY_STEP_TITLE_MAX + 1) }),
      ]).success
    ).toBe(false)

    expect(
      sparePartDeliveryStepsSchema.safeParse([
        step({
          description: "x".repeat(SPARE_PART_DELIVERY_STEP_DESCRIPTION_MAX + 1),
        }),
      ]).success
    ).toBe(false)
  })

  it("caps the number of steps", () => {
    const tooMany = Array.from({ length: MAX_SPARE_PART_DELIVERY_STEPS + 1 }, () =>
      step()
    )

    expect(sparePartDeliveryStepsSchema.safeParse(tooMany).success).toBe(false)
  })

  it("rejects anything that is not an array of steps", () => {
    /**
     * This is the read-path case, not the form one: a `Json` column can hold
     * any of these, and a page that trusted it would render `undefined` or
     * throw. Failing here is what routes the caller to the built-in steps.
     */
    for (const value of [null, 42, "steps", { title: "a" }, [{ title: 1 }]]) {
      expect(sparePartDeliveryStepsSchema.safeParse(value).success).toBe(false)
    }
  })

  it("trims what an operator pasted in", () => {
    const parsed = sparePartDeliveryStepsSchema.parse([
      step({ title: "  We confirm and quote  " }),
    ])

    expect(parsed[0].title).toBe("We confirm and quote")
  })
})

describe("businessSettingsSchema — the steps field", () => {
  const valid = {
    whatsappNumber: "+211900000000",
    defaultInitialPercentage: "50",
    defaultMombasaPercentage: "25",
    defaultFinalPercentage: "25",
  }

  it("parses the JSON string the form submits", () => {
    const parsed = businessSettingsSchema.safeParse({
      ...valid,
      sparePartDeliverySteps: JSON.stringify([step()]),
    })

    expect(parsed.success).toBe(true)
    expect(parsed.data?.sparePartDeliverySteps).toEqual([step()])
  })

  it("reads an empty string as a deliberately cleared list", () => {
    const parsed = businessSettingsSchema.safeParse({
      ...valid,
      sparePartDeliverySteps: "",
    })

    expect(parsed.data?.sparePartDeliverySteps).toEqual([])
  })

  it("treats an absent field as 'leave the stored steps alone'", () => {
    /**
     * The security-relevant case, and the reason the field is optional rather
     * than required.
     *
     * `FormData.get` returns null for a field that was not submitted, and a
     * Server Action is a public POST endpoint — so a crafted request carrying
     * only the payment percentages must not be able to wipe an operator's
     * configured copy as a side effect. `undefined` reaches Prisma as "do not
     * touch this column", which is exactly that.
     */
    for (const missing of [null, undefined]) {
      const parsed = businessSettingsSchema.safeParse({
        ...valid,
        sparePartDeliverySteps: missing,
      })

      expect(parsed.success).toBe(true)
      expect(parsed.data?.sparePartDeliverySteps).toBeUndefined()
    }
  })

  it("rejects a string that is not JSON rather than throwing", () => {
    const parsed = businessSettingsSchema.safeParse({
      ...valid,
      sparePartDeliverySteps: "{ not json",
    })

    expect(parsed.success).toBe(false)
  })

  it("still enforces the payment split alongside the steps", () => {
    // The steps must not become a way past the rule that actually matters on
    // this form.
    const parsed = businessSettingsSchema.safeParse({
      ...valid,
      defaultFinalPercentage: "30",
      sparePartDeliverySteps: JSON.stringify([step()]),
    })

    expect(parsed.success).toBe(false)
  })
})

describe("the built-in steps", () => {
  it("are themselves valid", () => {
    // They are what a fresh install publishes, so a typo here would ship a
    // malformed fallback that the read path would then silently discard.
    expect(
      sparePartDeliveryStepsSchema.safeParse([...DEFAULT_SPARE_PART_DELIVERY_STEPS])
        .success
    ).toBe(true)
  })

  it("describe the parts pipeline, not the vehicle import timeline", () => {
    /**
     * The brief is explicit that spare parts must not be forced through the
     * vehicle narrative. A customer reading "arrives at Mombasa" under a set
     * of brake pads learns that the page was written for something else.
     */
    const copy = DEFAULT_SPARE_PART_DELIVERY_STEPS.map(
      (entry) => `${entry.title} ${entry.description}`
    )
      .join(" ")
      .toLowerCase()

    expect(copy).not.toContain("mombasa")
    expect(copy).not.toContain("clearing agent")
    expect(copy).not.toContain("chassis")
  })
})
