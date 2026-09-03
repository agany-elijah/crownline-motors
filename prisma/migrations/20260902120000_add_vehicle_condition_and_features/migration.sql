-- CreateEnum
CREATE TYPE "VehicleCondition" AS ENUM ('NEW', 'USED');

-- AlterTable
--
-- Both columns are additive and carry defaults, so every existing listing is
-- backfilled by Postgres as part of the ADD COLUMN rather than being left
-- NULL for the application to guess about.
--
-- USED is the default for the same reason it is the default in the schema:
-- an import that has not been declared new is not new, and the wrong value
-- here is a misrepresentation on a priced public page.
ALTER TABLE "Vehicle" ADD COLUMN     "condition" "VehicleCondition" NOT NULL DEFAULT 'USED',
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[];
