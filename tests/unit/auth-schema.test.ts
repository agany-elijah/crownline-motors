import { describe, expect, it } from "vitest"

import {
  passwordResetRequestSchema,
  signInSchema,
  updatePasswordSchema,
} from "@/lib/validations/auth.schema"

/**
 * The auth schemas are the server's boundary. A Server Action compiles to a
 * public POST endpoint, so whatever these accept is what an arbitrary caller
 * can put in front of Supabase and Prisma — the form is irrelevant to them.
 */
describe("signInSchema", () => {
  it("normalises the email before it is ever compared to a stored address", () => {
    // AdminProfile.email is stored lowercased. Without this the same person
    // typing a capitalised address would fail the admin lookup and be told,
    // correctly but uselessly, that they are not an administrator.
    const result = signInSchema.safeParse({
      email: "  Santos@Example.COM  ",
      password: "correct horse battery",
    })

    expect(result.success).toBe(true)
    expect(result.data?.email).toBe("santos@example.com")
  })

  it("rejects malformed addresses", () => {
    for (const email of ["", "   ", "not-an-email", "a@", "@b.com"]) {
      expect(signInSchema.safeParse({ email, password: "x" }).success).toBe(false)
    }
  })

  it("rejects a password longer than bcrypt's 72-byte input limit", () => {
    // Beyond 72 bytes the hash silently ignores the remainder, so two
    // different long passwords would open the same account.
    const result = signInSchema.safeParse({
      email: "a@b.com",
      password: "x".repeat(73),
    })

    expect(result.success).toBe(false)
  })

  it("does not impose complexity rules at sign-in", () => {
    // Deliberate: a complexity rule here tells an attacker which guesses are
    // structurally impossible, and locks out any account whose password
    // predates the rule.
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "a" }).success
    ).toBe(true)
  })

  it("treats `next` as optional and does not validate it as a path", () => {
    // Path safety is isSafeReturnPath's job, checked at the point of
    // redirect. This schema only bounds the length.
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "x", next: "//evil" })
        .success
    ).toBe(true)
    expect(
      signInSchema.safeParse({
        email: "a@b.com",
        password: "x",
        next: "/".repeat(513),
      }).success
    ).toBe(false)
  })
})

describe("passwordResetRequestSchema", () => {
  it("normalises the email the same way sign-in does", () => {
    const result = passwordResetRequestSchema.safeParse({ email: " A@B.COM " })

    expect(result.success).toBe(true)
    expect(result.data?.email).toBe("a@b.com")
  })
})

describe("updatePasswordSchema", () => {
  it("requires at least 12 characters", () => {
    const short = "x".repeat(11)
    const result = updatePasswordSchema.safeParse({
      password: short,
      confirmPassword: short,
    })

    expect(result.success).toBe(false)
  })

  it("accepts a long passphrase with no symbols or digits", () => {
    // Length over composition — the point of the rule.
    const phrase = "correct horse battery staple"
    expect(
      updatePasswordSchema.safeParse({
        password: phrase,
        confirmPassword: phrase,
      }).success
    ).toBe(true)
  })

  it("reports a mismatch against the confirmation field", () => {
    const result = updatePasswordSchema.safeParse({
      password: "correct horse battery",
      confirmPassword: "correct horse batteries",
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"])
  })
})
