-- Vehicle photograph categories are removed.
--
-- The dashboard now models a gallery as one main photograph plus a set of
-- supporting ones, which is the only distinction that changes what a
-- customer sees: the main image is the vehicle card and the first frame of
-- the gallery. FRONT / REAR / DASHBOARD and the rest were a taxonomy an
-- operator had to maintain on every upload and that nothing downstream read.
--
-- Destructive but safe: the column carried no business meaning, is not
-- referenced by any order, payment or shipment, and dropping it cannot
-- orphan a photograph. `isPrimary` and `displayOrder` — the two fields that
-- do decide presentation — are untouched, so no existing gallery changes.

-- DropColumn
ALTER TABLE "VehiclePhoto" DROP COLUMN "category";

-- DropEnum
DROP TYPE "VehiclePhotoCategory";
