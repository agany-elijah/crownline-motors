import { describe, it } from "vitest"

// Placeholder for Stage 37. The source it covers
// (src/lib/utils/generate-reference.ts) is still a stub, so these are
// declared as todo rather than left as an empty file that fails the run.
describe("generateReference", () => {
  it.todo("allocates sequential numbers from the ReferenceSequence counter")
  it.todo("formats each entity with its own prefix (CLM-V / CLM-Q / CLM-O / CLM)")
  it.todo("resets numbering per calendar year")
  it.todo("never issues a duplicate under concurrent allocation")
})
