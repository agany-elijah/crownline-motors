-- Per-listing visibility: the facts an operator has chosen not to publish on
-- one vehicle or spare part. Additive — both columns default to an empty
-- list, so every existing listing keeps showing exactly what it did.


-- AlterTable
ALTER TABLE "SparePart" ADD COLUMN     "hiddenFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "hiddenFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
