-- A fourth, miscellaneous fee on a quotation: a label plus an amount,
-- alongside the existing shipping/clearing/import-duty fees.
--
-- ── Written by hand, applied with `migrate deploy` ────────────────────
-- Same reason as the earlier hand-written migrations in this project:
-- Supabase installs extensions (pg_stat_statements, pgcrypto,
-- supabase_vault, uuid-ossp) this schema does not declare, so
-- `prisma migrate dev` reads them as drift and offers to reset a database
-- holding real inventory. This SQL was generated with
-- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
-- --script` against the live database, which is unaffected by that
-- extension noise.
--
-- ── Safe on a live database ───────────────────────────────────────────
-- Both columns are nullable with no default: every existing row gets NULL
-- in both, which is exactly "no other cost on this quote" — the same
-- convention `shippingCost`/`clearingCost`/`importDuty` already use.
-- Nothing is dropped, renamed or rewritten.

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "otherCostsAmount" DECIMAL(12,2),
ADD COLUMN     "otherCostsLabel" TEXT;
