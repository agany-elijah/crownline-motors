import { describe, expect, it } from "vitest"

import { orderDeliveryDateSchema } from "@/lib/validations/order.schema"

const parse = (deliveryDate: string, deliveryDateLatest: string) =>
  orderDeliveryDateSchema.safeParse({ orderId: "order-1", deliveryDate, deliveryDateLatest })

describe("the expected delivery window", () => {
  it("accepts a window from the first day to the last", () => {
    const result = parse("2026-10-17", "2026-10-30")
    expect(result.success).toBe(true)
    expect(result.data?.deliveryDate).toEqual(new Date(Date.UTC(2026, 9, 17)))
    expect(result.data?.deliveryDateLatest).toEqual(new Date(Date.UTC(2026, 9, 30)))
  })

  it("accepts a single date, and clears when both are empty", () => {
    expect(parse("2026-10-17", "").data?.deliveryDateLatest).toBeUndefined()
    expect(parse("", "").data).toMatchObject({ deliveryDate: undefined, deliveryDateLatest: undefined })
  })

  it("stores a window of one day as a single date", () => {
    expect(parse("2026-10-17", "2026-10-17").data?.deliveryDateLatest).toBeUndefined()
  })

  it("refuses a window that ends before it starts", () => {
    const result = parse("2026-10-30", "2026-10-17")
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("The last day cannot be before the first.")
  })

  it("refuses a last day without a first", () => {
    expect(parse("", "2026-10-30").success).toBe(false)
  })

  it("refuses a date that does not exist", () => {
    expect(parse("2026-02-30", "").success).toBe(false)
  })
})
