import { describe, expect, it } from "vitest"

import { buildGeneralWhatsAppMessage, buildWhatsAppUrl } from "@/lib/utils/whatsapp"

describe("buildWhatsAppUrl", () => {
  it("strips formatting characters from the phone number", () => {
    const url = buildWhatsAppUrl({ phoneNumber: "+211 900-000 000" })

    expect(url).toBe("https://wa.me/211900000000")
  })

  it("returns null when the number contains no digits", () => {
    // Callers treat null as 'render no WhatsApp action at all' rather than
    // linking to a broken wa.me URL — this is the misconfigured-env-var path.
    expect(buildWhatsAppUrl({ phoneNumber: "" })).toBeNull()
    expect(buildWhatsAppUrl({ phoneNumber: "   " })).toBeNull()
    expect(buildWhatsAppUrl({ phoneNumber: "+-- --" })).toBeNull()
  })

  it("percent-encodes the message rather than concatenating it", () => {
    const url = buildWhatsAppUrl({
      phoneNumber: "211900000000",
      message: "Harrier & Prado #2021",
    })

    // The '&' and '#' must not survive as URL-meaningful characters, or a
    // message could inject extra query params / truncate at a fragment.
    expect(url).toContain("text=Harrier+%26+Prado+%232021")
    expect(url).not.toContain("&Prado")
    expect(url).not.toContain("#2021")
  })

  it("omits the text param for an empty or whitespace-only message", () => {
    expect(buildWhatsAppUrl({ phoneNumber: "211900000000", message: "" })).toBe(
      "https://wa.me/211900000000"
    )
    expect(buildWhatsAppUrl({ phoneNumber: "211900000000", message: "   " })).toBe(
      "https://wa.me/211900000000"
    )
  })

  it("trims surrounding whitespace from the message", () => {
    const url = buildWhatsAppUrl({ phoneNumber: "211900000000", message: "  hello  " })

    expect(url).toBe("https://wa.me/211900000000?text=hello")
  })
})

describe("buildGeneralWhatsAppMessage", () => {
  it("names the business in the prefilled message", () => {
    expect(buildGeneralWhatsAppMessage("Crownline Motors")).toBe(
      "Hello Crownline Motors, I'd like to enquire about a vehicle."
    )
  })
})
