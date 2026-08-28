-- Collapse AdminRole to a single ADMIN value (Wave A).
--
-- Postgres cannot remove a value from an enum in place, so the standard
-- swap is used: build the new type, move the column onto it, then retire
-- the old one. Wrapped in a transaction so a failure at any step leaves the
-- column on its original type rather than half-migrated.
--
-- The USING clause maps EVERY existing value — SUPER_ADMIN, MANAGER and
-- STAFF alike — onto ADMIN. That is the merge itself, and it is why this
-- cannot be a plain type change: without it Postgres refuses, because the
-- rows hold values the new type does not define.
--
-- The default is dropped before the type change and restored after. A
-- column default is itself typed, so leaving it in place would make the
-- ALTER fail on a default that no longer parses.

BEGIN;

CREATE TYPE "AdminRole_new" AS ENUM ('ADMIN');

ALTER TABLE "AdminProfile" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "AdminProfile"
  ALTER COLUMN "role" TYPE "AdminRole_new"
  USING ('ADMIN'::text::"AdminRole_new");

ALTER TYPE "AdminRole" RENAME TO "AdminRole_old";
ALTER TYPE "AdminRole_new" RENAME TO "AdminRole";
DROP TYPE "AdminRole_old";

ALTER TABLE "AdminProfile" ALTER COLUMN "role" SET DEFAULT 'ADMIN';

COMMIT;
