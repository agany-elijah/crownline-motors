-- Restores the "exactly one main photograph per vehicle" invariant.
--
-- The rule the application maintains at write time (reconcilePrimary() in
-- src/lib/storage/vehicle-photo-service.ts) is that a vehicle with at least
-- one live photograph has exactly one with isPrimary = true. Live data had
-- drifted out of it: a vehicle was found with a live photograph and no
-- primary at all, which the dashboard used to render as a gallery whose
-- cover image was chosen arbitrarily by whatever query read it first, and
-- which the public vehicle card would show with no image.
--
-- One statement, so the repair is atomic and idempotent. The ranking matches
-- reconcilePrimary exactly: keep an existing primary if there is one, break
-- ties on display order, then on insertion time, then on id so the result is
-- deterministic even for rows that are identical on all three.
--
-- Only rows whose value actually changes are written, so re-running this on
-- an already-correct database touches nothing.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "vehicleId"
      ORDER BY "isPrimary" DESC, "displayOrder" ASC, "createdAt" ASC, id ASC
    ) AS rank
  FROM "VehiclePhoto"
  WHERE "deletedAt" IS NULL
)
UPDATE "VehiclePhoto" AS photo
SET "isPrimary" = (ranked.rank = 1)
FROM ranked
WHERE photo.id = ranked.id
  AND photo."isPrimary" IS DISTINCT FROM (ranked.rank = 1);

-- A soft-deleted photograph must never carry isPrimary: reconcilePrimary's
-- "keep the existing primary" branch would otherwise look at a row nobody
-- can see. deleteVehiclePhotoAction clears it in the same write as the
-- deletion, but rows deleted before that was true are cleaned up here.
UPDATE "VehiclePhoto"
SET "isPrimary" = false
WHERE "deletedAt" IS NOT NULL AND "isPrimary" = true;
