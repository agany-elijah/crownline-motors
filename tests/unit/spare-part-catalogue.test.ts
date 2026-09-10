import { describe, expect, it } from "vitest"

import {
  ORDER_TYPE_LABELS,
  SPARE_PART_CATEGORY_SEEDS,
  SPARE_PART_CONDITION_LABELS,
  SPARE_PART_PRICING_MODE_LABELS,
  SPARE_PART_STATUS_LABELS,
} from "@/lib/constants/spare-part-options"
import { buildSparePartSlug, slugifyFragment } from "@/lib/utils/slugify"

/**
 * The two things about a part listing that are effectively permanent once a
 * customer has seen them: its public URL, and the category taxonomy that URL
 * sits inside.
 *
 * A slug that changes breaks every link already shared over WhatsApp and
 * every URL already indexed, and the catalogue's SEO value (brief §18) is
 * built on both staying put.
 */

describe("buildSparePartSlug", () => {
  it("puts the readable name in front and the reference behind", () => {
    expect(
      buildSparePartSlug({
        name: "Toyota Harrier Front Brake Pads",
        referenceNumber: "CLM-SP-2026-000045",
      })
    ).toBe("toyota-harrier-front-brake-pads-clm-sp-2026-000045")
  })

  it("distinguishes two listings with the same name", () => {
    // Not an edge case: a genuine set and a refurbished set are both called
    // "Front Brake Pads", and `slug` is unique in the database — a name-only
    // slug would fail the second save.
    const genuine = buildSparePartSlug({
      name: "Front Brake Pads",
      referenceNumber: "CLM-SP-2026-000045",
    })
    const refurbished = buildSparePartSlug({
      name: "Front Brake Pads",
      referenceNumber: "CLM-SP-2026-000046",
    })

    expect(genuine).not.toBe(refurbished)
  })

  it("survives punctuation, accents and doubled separators", () => {
    expect(
      buildSparePartSlug({
        name: "  Citroën   C4 — Oil Filter (OEM)  ",
        referenceNumber: "CLM-SP-2026-000001",
      })
    ).toBe("citroen-c4-oil-filter-oem-clm-sp-2026-000001")
  })

  it("still produces a usable slug when the name reduces to nothing", () => {
    // A name of only symbols slugifies to an empty fragment. The reference is
    // what keeps the URL valid and unique rather than leaving a bare hyphen.
    expect(
      buildSparePartSlug({ name: "###", referenceNumber: "CLM-SP-2026-000002" })
    ).toBe("clm-sp-2026-000002")
  })
})

describe("spare-part category seeds", () => {
  it("covers the categories the brief starts the catalogue with", () => {
    // The brief's twelve, plus the "Others" catch-all — every part must have
    // a category, and without somewhere honest to file an odd one an operator
    // files it under whichever is closest, which is how "Brakes" quietly
    // stops meaning brakes.
    expect(SPARE_PART_CATEGORY_SEEDS).toHaveLength(13)

    const names = SPARE_PART_CATEGORY_SEEDS.map((category) => category.name)
    expect(names).toEqual(
      expect.arrayContaining([
        "Engine",
        "Brakes",
        "Suspension",
        "Electrical",
        "Body",
        "Interior",
        "Transmission",
        "Cooling",
        "Filters",
        "Lighting",
        "Wheels & Tyres",
        "Accessories",
        "Others",
      ])
    )
  })

  it("has unique slugs and names", () => {
    // Both are unique columns in the database. A duplicate here would make
    // the seed fail halfway through, leaving a partly-installed taxonomy.
    const slugs = SPARE_PART_CATEGORY_SEEDS.map((category) => category.slug)
    const names = SPARE_PART_CATEGORY_SEEDS.map((category) => category.name)

    expect(new Set(slugs).size).toBe(slugs.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it("writes slugs that are already URL-safe", () => {
    // The slug is written out rather than derived from the name on purpose —
    // it is a public URL segment and must not move if the slugifier changes.
    // This checks the written value is one the slugifier would accept, so
    // "Wheels & Tyres" cannot ship as a category whose URL contains an
    // ampersand.
    for (const category of SPARE_PART_CATEGORY_SEEDS) {
      expect(category.slug).toBe(slugifyFragment(category.slug))
    }
  })

  it("orders the taxonomy deliberately and leaves room to insert", () => {
    const orders = SPARE_PART_CATEGORY_SEEDS.map((category) => category.displayOrder)

    expect(new Set(orders).size).toBe(orders.length)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
    // Gaps of ten, so a category can be slotted between two others without
    // renumbering the whole list.
    expect(orders.every((order) => order % 10 === 0)).toBe(true)
  })

  it("describes every category", () => {
    // The description is what the catalogue's category rail shows under the
    // name. An unlabelled category is one a customer has to guess at.
    for (const category of SPARE_PART_CATEGORY_SEEDS) {
      expect(category.description.trim().length).toBeGreaterThan(0)
    }
  })
})

describe("spare-part labels", () => {
  /**
   * Each map is typed as `Record<Enum, string>`, so an unlabelled enum value
   * is already a compile error. These check the other half: that no label is
   * blank, and that the wording customers read is the wording the brief and
   * the dashboard use.
   */
  it("labels every value of every enum with real text", () => {
    const maps = [
      SPARE_PART_CONDITION_LABELS,
      SPARE_PART_STATUS_LABELS,
      SPARE_PART_PRICING_MODE_LABELS,
      ORDER_TYPE_LABELS,
    ]

    for (const map of maps) {
      for (const label of Object.values(map)) {
        expect(label.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it("says 'Price on enquiry' rather than leaving a quoted part looking free", () => {
    // The customer-facing consequence of the QUOTE_ONLY pricing mode. A blank
    // or vague label on a part with no price reads as a dealership that will
    // not say what things cost.
    expect(SPARE_PART_PRICING_MODE_LABELS.QUOTE_ONLY).toBe("Price on enquiry")
  })

  it("uses the plain word for a used part", () => {
    // "Used", not "Pre-owned" — matching the vehicle side, where the
    // euphemism was rejected for the same reason.
    expect(SPARE_PART_CONDITION_LABELS.USED).toBe("Used")
  })
})
