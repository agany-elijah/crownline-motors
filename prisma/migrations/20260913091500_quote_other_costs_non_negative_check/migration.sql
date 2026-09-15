-- Widens Quote_costs_non_negative_check to also cover otherCostsAmount,
-- added in 20260912090000_quote_other_costs. That migration left the new
-- column guarded only by application-layer validation (parseMoneyInput);
-- this brings it in line with the other three fees, where the schema
-- documentation's own rule applies: "the database is the backstop, not the
-- error message."
--
-- ── Written by hand, applied with `migrate deploy` ────────────────────
-- Same reason as every other hand-written migration in this project: CHECK
-- constraints are invisible to `prisma migrate dev`'s drift detector, which
-- otherwise only sees Supabase's own installed extensions and offers to
-- reset the database.
--
-- ── Safe on a live database ───────────────────────────────────────────
-- Every existing row has otherCostsAmount = NULL (the column did not exist
-- until moments ago), which the new CHECK explicitly allows. No row can
-- violate it at migration time.

ALTER TABLE "Quote" DROP CONSTRAINT "Quote_costs_non_negative_check";

ALTER TABLE "Quote" ADD CONSTRAINT "Quote_costs_non_negative_check"
  CHECK (
    ("shippingCost" IS NULL OR "shippingCost" >= 0)
    AND ("clearingCost" IS NULL OR "clearingCost" >= 0)
    AND ("importDuty" IS NULL OR "importDuty" >= 0)
    AND ("otherCostsAmount" IS NULL OR "otherCostsAmount" >= 0)
  );
