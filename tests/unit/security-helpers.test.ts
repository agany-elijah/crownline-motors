import { describe, expect, it } from "vitest"

import { describeDevice } from "@/lib/auth/device-label"
import { AUDIT_CATEGORIES, AUDIT_ACTION_LABELS, humaniseCode } from "@/lib/constants/audit-actions"
import { describeAuditChanges } from "@/lib/settings/describe-audit"
import {
  changePasswordSchema,
  securityControlsSchema,
  totpCodeSchema,
} from "@/lib/validations/security.schema"

describe("describeDevice", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Chrome on Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0",
      "Edge on Windows",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Safari on iPhone",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
      "Chrome on Android",
    ],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0", "Firefox on macOS"],
  ])("names %s", (userAgent, expected) => {
    expect(describeDevice(userAgent)).toBe(expected)
  })

  it("returns null without a header and a fallback for anything unrecognised", () => {
    expect(describeDevice(null)).toBeNull()
    expect(describeDevice("curl/8.0")).toBe("Unknown device")
  })
})

describe("describeAuditChanges", () => {
  it("reads the settings shape", () => {
    expect(
      describeAuditChanges({ changes: [{ field: "WhatsApp number", from: "+211900", to: "+211911" }, { bogus: true }] })
    ).toEqual([{ field: "WhatsApp number", from: "+211900", to: "+211911" }])
  })

  it("diffs the original settings form's previous/next shape", () => {
    expect(
      describeAuditChanges({ previous: { initial: "50", final: "25" }, next: { initial: "60", final: "25" } })
    ).toEqual([{ field: "initial", from: "50", to: "60" }])
  })

  it("reads a status transition and humanises enum values", () => {
    expect(describeAuditChanges({ previousStatus: "PENDING_DEPOSIT", newStatus: "DEPOSIT_CONFIRMED" })).toEqual([
      { field: "Status", from: "Pending deposit", to: "Deposit confirmed" },
    ])
  })

  it("returns nothing for metadata without a before and after, or that is not an object", () => {
    expect(describeAuditChanges({ orderId: "abc" })).toEqual([])
    expect(describeAuditChanges(null)).toEqual([])
    expect(describeAuditChanges("changes")).toEqual([])
  })
})

describe("audit action vocabulary", () => {
  it("files every categorised action under exactly one category", () => {
    const seen = new Map<string, string>()
    for (const [category, { actions }] of Object.entries(AUDIT_CATEGORIES)) {
      for (const action of actions) {
        expect(seen.get(action), `${action} is in ${seen.get(action)} and ${category}`).toBeUndefined()
        seen.set(action, category)
      }
    }
    // Every labelled action is filterable.
    expect([...seen.keys()].sort()).toEqual(Object.keys(AUDIT_ACTION_LABELS).sort())
  })

  it("humanises codes", () => {
    expect(humaniseCode("TRANSPORT_TO_SOUTH_SUDAN")).toBe("Transport to south sudan")
  })
})

describe("security schemas", () => {
  it("accepts an authenticator code typed with a space", () => {
    expect(totpCodeSchema.parse("123 456")).toBe("123456")
    expect(totpCodeSchema.safeParse("12345").success).toBe(false)
    expect(totpCodeSchema.safeParse("12a456").success).toBe(false)
  })

  it("requires the new password to match, and to differ from the current one", () => {
    const base = { currentPassword: "old-password-123", password: "a-brand-new-passphrase", confirmPassword: "a-brand-new-passphrase" }
    expect(changePasswordSchema.safeParse(base).success).toBe(true)
    expect(changePasswordSchema.safeParse({ ...base, confirmPassword: "different-passphrase" }).success).toBe(false)
    expect(
      changePasswordSchema.safeParse({ ...base, password: base.currentPassword, confirmPassword: base.currentPassword })
        .success
    ).toBe(false)
    expect(changePasswordSchema.safeParse({ ...base, password: "short", confirmPassword: "short" }).success).toBe(false)
  })

  it("only accepts a session timeout from the offered list", () => {
    expect(securityControlsSchema.safeParse({ sessionTimeoutHours: "24" }).data).toEqual({
      requireTwoFactor: false,
      allowPasswordRecovery: false,
      sessionTimeoutHours: 24,
    })
    expect(securityControlsSchema.safeParse({ sessionTimeoutHours: "25" }).success).toBe(false)
    expect(securityControlsSchema.safeParse({ sessionTimeoutHours: "0" }).success).toBe(false)
  })
})
