-- An admin-editable delivery-date estimate on Order, distinct from the
-- Shipment/TrackingEvent logistics timeline.
--
-- ── Written by hand, applied with `migrate deploy` ────────────────────
-- Same reason as the earlier hand-written migrations in this project:
-- Supabase installs extensions this schema does not declare, so
-- `prisma migrate dev` reads them as drift and offers to reset a database
-- holding real orders. Generated with
-- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
-- --script` against the live database.
--
-- ── Safe on a live database ───────────────────────────────────────────
-- One nullable column, no default: every existing order gets NULL, which is
-- exactly "no delivery estimate given yet". Nothing is dropped or rewritten.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "estimatedDeliveryDate" TIMESTAMP(3);
