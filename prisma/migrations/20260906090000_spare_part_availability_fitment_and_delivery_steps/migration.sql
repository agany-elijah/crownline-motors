-- Spare parts: a published availability state, universal fitment rules, and
-- the configurable "how this reaches you" steps.
--
-- Every statement here is additive or a constraint *relaxation*. No column
-- changes meaning, nothing is dropped, and no existing row needs rewriting
-- beyond the backfill below — so this migration is safe to apply to the live
-- catalogue without a maintenance window.

-- ── 1. What a listing says about getting hold of the part ──────────────
--
-- Separate from `status` (may a customer see this listing) and from
-- `stockQuantity` (how many are in hand, which is internal). See the enum
-- comment in schema.prisma for why this is stated rather than derived.
CREATE TYPE "SparePartAvailability" AS ENUM (
  'IN_STOCK',
  'LOW_STOCK',
  'READY_TO_SHIP',
  'ON_ORDER',
  'OUT_OF_STOCK',
  'DISCONTINUED'
);

ALTER TABLE "SparePart"
  ADD COLUMN "availability" "SparePartAvailability" NOT NULL DEFAULT 'ON_ORDER';

-- Existing listings carry a stock figure that was, until now, the only thing
-- the business had recorded about availability. Reading it once here means an
-- operator does not open a catalogue where every part claims to be on order.
-- From this point on the column is set by hand and the two never track each
-- other again.
UPDATE "SparePart" SET "availability" = 'IN_STOCK' WHERE "stockQuantity" > 0;

-- Filtered and sorted alongside the visibility rule, exactly as `isFeatured`
-- and `categoryId` already are: every public read pins `status` first.
CREATE INDEX "SparePart_status_availability_idx"
  ON "SparePart" ("status", "availability");

-- ── 2. A fitment rule that covers every make ───────────────────────────
--
-- NULL already means "widens the rule" on model, engine and both year
-- bounds; make was the one level of the hierarchy that could not express
-- "all", so a universal consumable had to be listed once per make.
--
-- Dropping NOT NULL cannot invalidate an existing row.
ALTER TABLE "SparePartCompatibility" ALTER COLUMN "make" DROP NOT NULL;

-- ── 3. The parts fulfilment steps, on the settings singleton ───────────
--
-- NULL means "never configured" and falls back to the built-in steps; an
-- empty array means an operator deliberately hid the section. The shape is
-- validated with Zod on every read and write — Postgres does not check the
-- inside of a jsonb value, so it is untrusted input like any request body.
ALTER TABLE "BusinessSettings" ADD COLUMN "sparePartDeliverySteps" JSONB;
