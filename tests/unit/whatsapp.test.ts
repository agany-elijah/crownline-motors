import { describe, expect, it } from "vitest"

import {
  buildGeneralWhatsAppMessage,
  buildOrderWhatsAppMessage,
  buildSparePartWhatsAppMessage,
  buildTrackingWhatsAppMessage,
  buildVehicleWhatsAppMessage,
  buildWhatsAppUrl,
} from "@/lib/utils/whatsapp"

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

describe("contextual messages", () => {
  const siteName = "Crownline Motors"

  it("names the vehicle and its listing reference", () => {
    // The reference is what stops a reply having to begin with "which of
    // the three 2021 Harriers?".
    expect(
      buildVehicleWhatsAppMessage({
        siteName,
        year: 2021,
        make: "Toyota",
        model: "Harrier",
        referenceNumber: "CLM-V-2026-000123",
      })
    ).toBe(
      "Hello Crownline Motors, I am interested in the Toyota Harrier 2021, listing reference CLM-V-2026-000123."
    )
  })

  it("names the spare part and its part number", () => {
    expect(
      buildSparePartWhatsAppMessage({
        siteName,
        partName: "Toyota Harrier brake pads",
        partNumber: "CLM-SP-00012",
      })
    ).toBe(
      "Hello Crownline Motors, I am interested in the Toyota Harrier brake pads, part number CLM-SP-00012."
    )
  })

  it("names the order", () => {
    expect(
      buildOrderWhatsAppMessage({ siteName, orderNumber: "CLM-O-2026-000012" })
    ).toBe("Hello Crownline Motors, I need assistance with order CLM-O-2026-000012.")
  })

  it("names the tracking number", () => {
    expect(
      buildTrackingWhatsAppMessage({ siteName, trackingNumber: "CLM-2026-000125" })
    ).toBe(
      "Hello Crownline Motors, I need assistance with tracking number CLM-2026-000125."
    )
  })

  it("keeps a vehicle name with URL-meaningful characters inside the message", () => {
    // Model names really do contain "&" and "/". The message must survive
    // encoding as one `text` parameter rather than splitting into two.
    const url = buildWhatsAppUrl({
      phoneNumber: "211900000000",
      message: buildVehicleWhatsAppMessage({
        siteName,
        year: 2021,
        make: "Mercedes-Benz",
        model: "S/500 & AMG",
        referenceNumber: "CLM-V-2026-000123",
      }),
    })

    expect(url).not.toBeNull()
    const text = new URL(url!).searchParams.get("text")

    expect(text).toContain("Mercedes-Benz S/500 & AMG 2021")
    expect(text).toContain("CLM-V-2026-000123")
  })
})
