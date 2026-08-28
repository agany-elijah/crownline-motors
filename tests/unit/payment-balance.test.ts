import { describe, it } from "vitest"

// Placeholder for Stage 37. The source it covers (order balance +
// milestone math) is still a stub, so these are declared as todo rather
// than left as an empty file that fails the run.
describe("order balance", () => {
  it.todo("counts only CONFIRMED payments toward amountPaid")
  it.todo("derives balance as totalAmount minus amountPaid, never a stored column")
  it.todo("splits milestones 50/25/25 from the percentages locked in at order creation")
  it.todo("reports the lowest-sequence unpaid milestone as currently due")
})
