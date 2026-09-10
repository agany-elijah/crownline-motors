-- Quote management: the public request forms, the operator's quotation
-- builder, dispatch, and conversion into an order.
--
-- ── Written by hand, applied with `migrate deploy` ────────────────────
-- Same reason as the earlier hand-written migrations: Supabase installs
-- extensions this schema does not declare, so `prisma migrate dev` reads them
-- as drift and offers to reset a database holding real inventory. The DDL
-- below was generated with `prisma migrate diff --from-config-datasource`
-- against the live database, then annotated and extended with CHECK
-- constraints the Prisma DSL cannot express.
--
-- ── Safe on a live database ───────────────────────────────────────────
-- Every statement is additive: three new enum types, two appended enum
-- values, new nullable or defaulted columns, one unique index on a column
-- that is NULL everywhere, and CHECK constraints that every existing row
-- satisfies (the new columns are NULL or at their default). Nothing is
-- dropped, renamed or rewritten.
--
-- `ALTER TYPE ... ADD VALUE` inside a transaction is permitted from
-- PostgreSQL 12 provided the new value is not *used* in the same
-- transaction. Nothing below uses SENT or WON.

-- ── 1. Enums ──────────────────────────────────────────────────────────

-- Which public surface raised an enquiry.
CREATE TYPE "QuoteSource" AS ENUM ('VEHICLE_PAGE', 'VEHICLE_CATALOGUE', 'SPARE_PART_CART', 'SPARE_PART_CATALOGUE', 'QUOTE_PAGE');

-- A quotation line is either the thing sold or an extra priced beside it.
CREATE TYPE "QuoteLineKind" AS ENUM ('ITEM', 'ACCESSORY');

-- How a quotation was last sent.
CREATE TYPE "QuoteDispatchChannel" AS ENUM ('WHATSAPP', 'EMAIL');

-- The two states the quote lifecycle was missing: a quotation that has gone
-- to the customer, and one that has become an order. Appended, never
-- interleaved — see the note on OrderStatus in schema.prisma.
ALTER TYPE "QuoteStatus" ADD VALUE 'SENT';
ALTER TYPE "QuoteStatus" ADD VALUE 'WON';

-- ── 2. Quotation defaults on the settings singleton ───────────────────
ALTER TABLE "BusinessSettings" ADD COLUMN     "quotePaymentInstructions" TEXT,
ADD COLUMN     "quoteTerms" TEXT,
ADD COLUMN     "quoteValidityDays" INTEGER NOT NULL DEFAULT 14;

-- ── 3. What conversion locks into an order ────────────────────────────
ALTER TABLE "Order" ADD COLUMN     "importDuty" DECIMAL(12,2);

-- How many units each line took off the shelf, so a cancellation puts back
-- exactly that. Existing rows (there are none with stock behind them) take
-- zero, which releases nothing.
ALTER TABLE "OrderItem" ADD COLUMN     "stockReserved" INTEGER NOT NULL DEFAULT 0;

-- ── 4. The quotation itself ───────────────────────────────────────────
ALTER TABLE "Quote" ADD COLUMN     "clearingCost" DECIMAL(12,2),
ADD COLUMN     "contactCity" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "contactWhatsapp" TEXT,
ADD COLUMN     "importDuty" DECIMAL(12,2),
ADD COLUMN     "lastSentVia" "QuoteDispatchChannel",
ADD COLUMN     "paymentInstructions" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "shippingCost" DECIMAL(12,2),
ADD COLUMN     "source" "QuoteSource",
ADD COLUMN     "terms" TEXT,
ADD COLUMN     "validUntil" TIMESTAMP(3);

ALTER TABLE "QuoteItem" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "QuoteLineKind" NOT NULL DEFAULT 'ITEM';

-- The customer's PDF link resolves a quote by this token, and two quotes
-- sharing one would hand a customer someone else's quotation.
CREATE UNIQUE INDEX "Quote_shareToken_key" ON "Quote"("shareToken");

-- ─────────────────────────────────────────────────────────────────────
-- CHECK CONSTRAINTS
--
-- Not expressible in schema.prisma and invisible to the migrate engine,
-- which therefore never proposes to drop them. `npm run db:check` verifies
-- every one against a real database.
-- ─────────────────────────────────────────────────────────────────────

-- A fee is either not quoted (NULL) or a real, non-negative figure. A
-- negative shipping cost is a discount pretending to be a fee, and it would
-- quietly reduce the milestone amounts computed from the total.
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_costs_non_negative_check"
  CHECK (
    ("shippingCost" IS NULL OR "shippingCost" >= 0)
    AND ("clearingCost" IS NULL OR "clearingCost" >= 0)
    AND ("importDuty" IS NULL OR "importDuty" >= 0)
  );

-- An accessory is never inventory. Were one allowed to name a product, the
-- conversion could not tell which lines are the thing being sold.
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_accessory_no_product_check"
  CHECK ("kind" <> 'ACCESSORY' OR num_nonnulls("vehicleId", "sparePartId") = 0);

ALTER TABLE "Order" ADD CONSTRAINT "Order_import_duty_non_negative_check"
  CHECK ("importDuty" IS NULL OR "importDuty" >= 0);

-- A line cannot take more off the shelf than it sold, and cannot take a
-- negative amount — either would make a cancellation release stock that
-- never left.
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_stock_reserved_check"
  CHECK ("stockReserved" >= 0 AND "stockReserved" <= "quantity");

-- A quotation valid for zero days is expired on arrival; one valid for years
-- is a price promised indefinitely.
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_quote_validity_check"
  CHECK ("quoteValidityDays" BETWEEN 1 AND 365);
