-- Trigram indexes for the admin vehicle search.
--
-- The search box filters with `contains` + `mode: "insensitive"`, which
-- Prisma compiles to ILIKE '%term%'. The leading wildcard leaves a B-tree
-- index with no prefix to seek on, so every keystroke of a debounced search
-- sequentially scanned the whole Vehicle table across three columns.
--
-- pg_trgm indexes every three-character substring, which turns an infix
-- match into an index lookup. The trade is a slightly heavier write per
-- vehicle — irrelevant on a table an operator appends to a handful of times
-- a day, and bounded by the inventory of a single dealership.
--
-- Safe to apply to a live database: CREATE EXTENSION IF NOT EXISTS is a
-- no-op when the extension is present, and creating an index takes a
-- SHARE lock that blocks writes but not reads. On a table this size that is
-- milliseconds. Should the inventory ever be large enough for that to
-- matter, the same statements with CONCURRENTLY are the answer — they
-- cannot be used here because Prisma runs each migration in a transaction.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Vehicle_make_idx" ON "Vehicle" USING GIN ("make" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Vehicle_model_idx" ON "Vehicle" USING GIN ("model" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Vehicle_referenceNumber_idx" ON "Vehicle" USING GIN ("referenceNumber" gin_trgm_ops);
