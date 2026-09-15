import { describe, expect, it } from "vitest"

import {
  customerIdentityKey,
  isSameCustomerIdentity,
  normalizeIdentityEmail,
  normalizeIdentityName,
  normalizeIdentityPhone,
  type CustomerIdentityFields,
} from "@/lib/quotes/customer-identity"

const base: CustomerIdentityFields = {
  fullName: "Elijah Agany",
  email: "elijah@example.com",
  phone: "+211912345678",
  whatsapp: "+211912345678",
}

describe("isSameCustomerIdentity", () => {
  it("matches when all four details agree", () => {
    expect(isSameCustomerIdentity(base, { ...base })).toBe(true)
  })

  it("treats a different name on the same email, phone and WhatsApp as a different customer", () => {
    expect(isSameCustomerIdentity(base, { ...base, fullName: "Mary Agany" })).toBe(false)
  })

  it("treats the same name with a different email as a different customer", () => {
    expect(isSameCustomerIdentity(base, { ...base, email: "other@example.com" })).toBe(false)
  })

  it("treats the same name with a different phone as a different customer", () => {
    expect(isSameCustomerIdentity(base, { ...base, phone: "+211987654321" })).toBe(false)
  })

  it("treats the same name with a different WhatsApp as a different customer", () => {
    expect(isSameCustomerIdentity(base, { ...base, whatsapp: "+256700000000" })).toBe(false)
  })

  it("does not match an enquiry without an email to one with an email", () => {
    expect(isSameCustomerIdentity(base, { ...base, email: undefined })).toBe(false)
  })

  it("matches two enquiries that both left the email blank, however blank was stored", () => {
    expect(isSameCustomerIdentity({ ...base, email: null }, { ...base, email: undefined })).toBe(true)
    expect(isSameCustomerIdentity({ ...base, email: "" }, { ...base, email: null })).toBe(true)
  })

  it("does not match a legacy record with no WhatsApp to an enquiry that has one", () => {
    expect(isSameCustomerIdentity({ ...base, whatsapp: null }, base)).toBe(false)
  })

  it("tolerates typing differences in the name", () => {
    expect(isSameCustomerIdentity(base, { ...base, fullName: "  elijah   AGANY " })).toBe(true)
  })

  it("does not treat a missing surname as the same name", () => {
    expect(isSameCustomerIdentity(base, { ...base, fullName: "Elijah" })).toBe(false)
  })

  it("tolerates case and spaces in the email", () => {
    expect(isSameCustomerIdentity(base, { ...base, email: " Elijah@Example.COM " })).toBe(true)
  })

  it("keeps dotted and plus-tagged addresses distinct", () => {
    expect(isSameCustomerIdentity(base, { ...base, email: "eli.jah@example.com" })).toBe(false)
    expect(isSameCustomerIdentity(base, { ...base, email: "elijah+cars@example.com" })).toBe(false)
  })
})

describe("normalizeIdentityName", () => {
  it("folds case and collapses whitespace", () => {
    expect(normalizeIdentityName("  Nyandeng\t DENG ")).toBe("nyandeng deng")
  })

  it("ignores accents on Latin letters", () => {
    expect(normalizeIdentityName("José Ramírez")).toBe(normalizeIdentityName("Jose Ramirez"))
  })

  it("keeps marks that are letters in other scripts", () => {
    expect(normalizeIdentityName("किरण")).not.toBe(normalizeIdentityName("करण"))
  })

  it("unifies keyboard apostrophe and dash variants", () => {
    expect(normalizeIdentityName("Ma’en")).toBe("ma'en")
    expect(normalizeIdentityName("Deng–Garang")).toBe("deng-garang")
    expect(normalizeIdentityName("Deng - Garang")).toBe("deng-garang")
  })

  it("ignores full stops in initials", () => {
    expect(normalizeIdentityName("J. Lado")).toBe(normalizeIdentityName("J Lado"))
    expect(normalizeIdentityName("J.Lado")).toBe(normalizeIdentityName("J Lado"))
  })

  it("folds full-width characters", () => {
    expect(normalizeIdentityName("Ｅｌｉｊａｈ")).toBe("elijah")
  })

  it("keeps Arabic-script names comparable", () => {
    expect(normalizeIdentityName(" محمد  علي ")).toBe("محمد علي")
  })
})

describe("normalizeIdentityEmail / normalizeIdentityPhone", () => {
  it("reads blank emails as no email", () => {
    expect(normalizeIdentityEmail("   ")).toBeNull()
    expect(normalizeIdentityEmail(undefined)).toBeNull()
  })

  it("drops formatting from stored phone numbers", () => {
    expect(normalizeIdentityPhone("+211 912-345 678")).toBe("+211912345678")
    expect(normalizeIdentityPhone(null)).toBeNull()
  })
})

describe("customerIdentityKey", () => {
  it("cannot be forged by moving text between fields", () => {
    expect(
      customerIdentityKey({ fullName: "a", email: "b@c.d", phone: "+1", whatsapp: "+2" })
    ).not.toBe(customerIdentityKey({ fullName: "a b@c.d", email: null, phone: "+1", whatsapp: "+2" }))
  })
})
