-- The spare-parts domain (Wave B / roadmap Phase 9), and the commerce
-- extensions that let it share the vehicle side's order, payment and
-- shipment infrastructure instead of growing a parallel one.
--
-- ── Written by hand, applied with `migrate deploy` ────────────────────
-- Same reason as 20260902140000_add_login_attempt_rate_limiting: Supabase
-- installs extensions this schema does not declare (pg_stat_statements,
-- pgcrypto, uuid-ossp, supabase_vault), so `prisma migrate dev` reads them
-- as drift and offers to reset a database holding real inventory. The DDL
-- below was generated with `prisma migrate diff --from-config-datasource`
-- against the live database, then annotated and extended with the CHECK
-- constraints Prisma's schema DSL cannot express.
--
-- ── Safe on a live database ───────────────────────────────────────────
-- Every statement is additive: four new tables, four new enum types, five
-- new columns on existing tables (all nullable or defaulted), new indexes,
-- and CHECK constraints on tables that are empty today (Order, OrderItem,
-- Quote, Payment and Shipment have never held a row — the commerce layer is
-- schema-only so far). Nothing is dropped, renamed or rewritten, so no
-- existing vehicle listing, photograph or audit row is touched.
--
-- `ALTER TYPE ... ADD VALUE` inside a transaction is permitted from
-- PostgreSQL 12 onward provided the new value is not *used* in the same
-- transaction. Nothing below uses one — the new variants only become
-- reachable to application code — so this runs safely inside the single
-- transaction Prisma wraps each migration in. This database is 17.6.

-- CreateEnum
CREATE TYPE "SparePartStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SparePartCondition" AS ENUM ('NEW', 'USED', 'REFURBISHED');

-- CreateEnum
CREATE TYPE "SparePartPricingMode" AS ENUM ('FIXED', 'QUOTE_ONLY');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('VEHICLE', 'SPARE_PART');

-- AlterEnum
--
-- A parts order is paid in full before it is packed, so it opens in a state
-- the vehicle flow has no word for. Reusing PENDING_DEPOSIT would tell an
-- operator to chase a deposit that does not exist.
ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_PAYMENT';

-- AlterEnum
ALTER TYPE "QuoteType" ADD VALUE 'SPARE_PART';

-- AlterEnum
ALTER TYPE "ShipmentType" ADD VALUE 'SPARE_PART';

-- AlterEnum
--
-- The spare-parts logistics timeline. IN_TRANSIT and DELIVERED already exist
-- and are deliberately shared with the vehicle timeline — a box on a lorry
-- and a car on a ship are both in transit, and the customer reading either
-- word does not need to know which chain produced it.
--
-- Appended in declaration order rather than interleaved with the vehicle
-- states: `ADD VALUE` places a variant last unless told otherwise, and an
-- enum whose order disagrees with prisma/schema.prisma is drift the next
-- diff would offer to "fix".
ALTER TYPE "TrackingStatus" ADD VALUE 'ORDER_CONFIRMED';
ALTER TYPE "TrackingStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "TrackingStatus" ADD VALUE 'PACKED';
ALTER TYPE "TrackingStatus" ADD VALUE 'DISPATCHED';
ALTER TYPE "TrackingStatus" ADD VALUE 'OUT_FOR_DELIVERY';

-- AlterTable
--
-- Which workflow an order follows. Defaulted to VEHICLE so the column is
-- backfilled by Postgres rather than left for the application to guess about
-- — and VEHICLE is the honest default, because every order this platform can
-- currently create is one.
ALTER TABLE "Order" ADD COLUMN     "type" "OrderType" NOT NULL DEFAULT 'VEHICLE';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "sparePartId" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "linkedSparePartId" TEXT,
ADD COLUMN     "requestedPartName" TEXT,
ADD COLUMN     "requestedPartNumber" TEXT;

-- CreateTable
CREATE TABLE "SparePartCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePartCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePart" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "oemPartNumber" TEXT,
    "brand" TEXT,
    "condition" "SparePartCondition" NOT NULL DEFAULT 'USED',
    "countryOfOrigin" "CountryOfOrigin",
    "pricingMode" "SparePartPricingMode" NOT NULL DEFAULT 'FIXED',
    "price" DECIMAL(12,2),
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "specifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SparePartStatus" NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "supplierName" TEXT,
    "supplierNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartPhoto" (
    "id" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "altText" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparePartPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartCompatibility" (
    "id" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "engine" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePartCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "sparePartId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "quotedUnitPrice" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SparePartCategory_slug_key" ON "SparePartCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SparePartCategory_name_key" ON "SparePartCategory"("name");

-- CreateIndex
CREATE INDEX "SparePartCategory_isActive_displayOrder_idx" ON "SparePartCategory"("isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SparePart_referenceNumber_key" ON "SparePart"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SparePart_slug_key" ON "SparePart"("slug");

-- CreateIndex
-- Every public read pins status = PUBLISHED, so it leads each composite
-- index: the featured rail, the category browse and the price filter all
-- narrow on it first.
CREATE INDEX "SparePart_status_isFeatured_idx" ON "SparePart"("status", "isFeatured");

-- CreateIndex
CREATE INDEX "SparePart_status_categoryId_idx" ON "SparePart"("status", "categoryId");

-- CreateIndex
CREATE INDEX "SparePart_price_idx" ON "SparePart"("price");

-- CreateIndex
-- Trigram indexes for the catalogue and admin search boxes, exactly as
-- 20260829120000 added them for vehicles: `contains` + insensitive compiles
-- to ILIKE '%term%', whose leading wildcard leaves a B-tree with no prefix to
-- seek on. These three columns are the three things a person types when
-- looking for a part — what it is called, the number off the old one, and our
-- own reference. pg_trgm is already installed by that migration.
CREATE INDEX "SparePart_name_idx" ON "SparePart" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "SparePart_oemPartNumber_idx" ON "SparePart" USING GIN ("oemPartNumber" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "SparePart_referenceNumber_idx" ON "SparePart" USING GIN ("referenceNumber" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "SparePartPhoto_sparePartId_idx" ON "SparePartPhoto"("sparePartId");

-- CreateIndex
CREATE INDEX "SparePartPhoto_deletedAt_idx" ON "SparePartPhoto"("deletedAt");

-- CreateIndex
CREATE INDEX "SparePartCompatibility_sparePartId_idx" ON "SparePartCompatibility"("sparePartId");

-- CreateIndex
-- Fitment matching is case-insensitive (an operator types "toyota", the
-- vehicle record says "Toyota"), which compiles to ILIKE and cannot use a
-- B-tree at all — hence trigram here too rather than a composite (make,
-- model) index that the planner would never choose.
CREATE INDEX "SparePartCompatibility_make_idx" ON "SparePartCompatibility" USING GIN ("make" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "SparePartCompatibility_model_idx" ON "SparePartCompatibility" USING GIN ("model" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_vehicleId_idx" ON "QuoteItem"("vehicleId");

-- CreateIndex
CREATE INDEX "QuoteItem_sparePartId_idx" ON "QuoteItem"("sparePartId");

-- CreateIndex
CREATE INDEX "Order_type_status_idx" ON "Order"("type", "status");

-- CreateIndex
CREATE INDEX "OrderItem_sparePartId_idx" ON "OrderItem"("sparePartId");

-- CreateIndex
CREATE INDEX "Quote_type_status_idx" ON "Quote"("type", "status");

-- CreateIndex
CREATE INDEX "Shipment_shipmentType_currentStatus_idx" ON "Shipment"("shipmentType", "currentStatus");

-- AddForeignKey
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SparePartCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartPhoto" ADD CONSTRAINT "SparePartPhoto_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartCompatibility" ADD CONSTRAINT "SparePartCompatibility_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_linkedSparePartId_fkey" FOREIGN KEY ("linkedSparePartId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────
-- CHECK CONSTRAINTS
--
-- Everything below this line is hand-written. Prisma's schema DSL has no way
-- to express a cross-column check, so these live only here — which is safe:
-- the migrate engine does not model CHECK constraints at all, and therefore
-- never proposes to drop one. (Verified against this database with
-- `prisma migrate diff --from-config-datasource`, which reports no drift with
-- these in place.)
--
-- They are the invariants that must hold no matter which code path writes the
-- row. Zod still validates the same rules at the edge, because a constraint
-- violation is a 500 and a validation error is a sentence an operator can act
-- on — the database is the backstop, not the error message.
-- ─────────────────────────────────────────────────────────────────────

-- A part is either priced or quoted, and never both or neither.
--
-- Without this, "the price has not been typed in yet" and "this one is priced
-- on enquiry" are the same row, and the catalogue has to guess which promise
-- it is making to the customer. The brief is explicit that an estimate must
-- never be presentable as a confirmed figure.
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_pricing_mode_check"
  CHECK (
    ("pricingMode" = 'FIXED' AND "price" IS NOT NULL)
    OR ("pricingMode" = 'QUOTE_ONLY' AND "price" IS NULL)
  );

-- Money is never negative. A negative price would sail through every
-- percentage calculation in the payment milestones and produce an order that
-- owes the customer money.
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_price_non_negative_check"
  CHECK ("price" IS NULL OR "price" >= 0);

-- Stock is never negative.
--
-- This is what makes the only safe way to sell a part also the obvious one: a
-- conditional decrement inside the order transaction —
--
--   UPDATE "SparePart" SET "stockQuantity" = "stockQuantity" - $2
--    WHERE "id" = $1 AND "stockQuantity" >= $2
--
-- — where a zero row count means somebody else took the last one. A
-- read-then-write in application code oversells under concurrency; this
-- constraint turns that bug into a failed transaction rather than a negative
-- stock level and a customer owed a part nobody has.
ALTER TABLE "SparePart" ADD CONSTRAINT "SparePart_stock_non_negative_check"
  CHECK ("stockQuantity" >= 0);

-- A fitment year range must run forwards.
--
-- A reversed pair is not a loud error: it silently matches no vehicle at all,
-- so the part quietly disappears from the searches of exactly the customers
-- the rule was written for. Either bound may be absent, meaning unbounded in
-- that direction.
ALTER TABLE "SparePartCompatibility" ADD CONSTRAINT "SparePartCompatibility_year_range_check"
  CHECK ("yearFrom" IS NULL OR "yearTo" IS NULL OR "yearTo" >= "yearFrom");

-- An order line sells exactly one product.
--
-- Two nullable sibling foreign keys are the right shape for two product types
-- (see the note on OrderItem in schema.prisma), but they make three wrong
-- states representable: neither set, or both. This is the constraint the
-- schema documentation previously had to leave to application validation.
-- `num_nonnulls` is a Postgres builtin and extends to a third product type
-- without being rewritten.
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_exactly_one_product_check"
  CHECK (num_nonnulls("vehicleId", "sparePartId") = 1);

-- A sold line has a positive quantity. Zero contributes nothing to the total
-- while still reserving stock; negative is a refund wearing a sale's clothes,
-- and refunds belong in the payment ledger.
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive_check"
  CHECK ("quantity" > 0);

-- A quote line may reference at most one product — and legitimately none.
--
-- Deliberately weaker than the order-line rule above: "a rear bumper for a
-- 2018 Prado" is a quote for something not in the catalogue, which is the
-- entire reason Get a Quote exists. `description` always carries the human
-- answer, so a line without a foreign key is still meaningful.
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_at_most_one_product_check"
  CHECK (num_nonnulls("vehicleId", "sparePartId") <= 1);

-- Same reasoning as the order line: a zero-quantity quote line prices
-- nothing, and it becomes an order line when the quote is accepted.
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quantity_positive_check"
  CHECK ("quantity" > 0);

-- A quoted price is absent (not yet priced) or non-negative. Never negative:
-- this figure is copied onto the OrderItem when the quote is accepted.
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_price_non_negative_check"
  CHECK ("quotedUnitPrice" IS NULL OR "quotedUnitPrice" >= 0);
