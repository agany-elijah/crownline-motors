-- Settings centre: business identity, branding, tracking configuration,
-- catalogue display, notifications, SEO and security controls on the
-- BusinessSettings singleton; two-factor state on AdminProfile; and the
-- AdminSession / AdminLoginEvent tables behind session timeout, session
-- revocation and sign-in activity.
--
-- ── Non-destructive ───────────────────────────────────────────────────
-- Every change is additive. No column is dropped, renamed or retyped, and
-- every new NOT NULL column carries a default, so existing rows are valid the
-- moment the statement commits. The two new tables start empty.
--
-- ── Why the existing row is backfilled ────────────────────────────────
-- The public footer used to read its phone, email, address, hours and social
-- links from src/config/site.ts. Those values now live here. Copying them onto
-- the existing row keeps the live site rendering exactly what it did before
-- this deploy; an operator replaces them from Settings. A fresh environment
-- gets empty values, which publish nothing rather than placeholders.


-- CreateEnum
CREATE TYPE "AdminTheme" AS ENUM ('LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "AdminSessionEndReason" AS ENUM ('SIGNED_OUT', 'REVOKED', 'EXPIRED', 'PASSWORD_CHANGED');

-- CreateEnum
CREATE TYPE "AdminLoginEventKind" AS ENUM ('SIGN_IN_SUCCEEDED', 'SIGN_IN_FAILED', 'TWO_FACTOR_FAILED', 'SIGNED_OUT');

-- AlterTable
ALTER TABLE "AdminProfile" ADD COLUMN     "twoFactorEnabledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "adminEmailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowPasswordRecovery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "businessAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "businessDescription" TEXT NOT NULL DEFAULT 'Quality vehicles sourced from Japan and Korea and delivered to South Sudan.',
ADD COLUMN     "businessEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "businessName" TEXT NOT NULL DEFAULT 'Crownline Motors',
ADD COLUMN     "catalogDisplay" JSONB,
ADD COLUMN     "customerEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dashboardNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultCountry" TEXT NOT NULL DEFAULT 'SS',
ADD COLUMN     "defaultDashboardTheme" "AdminTheme" NOT NULL DEFAULT 'LIGHT',
ADD COLUMN     "faviconStoragePath" TEXT,
ADD COLUMN     "logoDarkStoragePath" TEXT,
ADD COLUMN     "logoLightStoragePath" TEXT,
ADD COLUMN     "notifyAdminsOfNewQuotes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ogImageStoragePath" TEXT,
ADD COLUMN     "primaryPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "requireTwoFactor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "searchIndexingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "seoDefaultDescription" TEXT,
ADD COLUMN     "seoDefaultTitle" TEXT,
ADD COLUMN     "sessionTimeoutHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "siteTitle" TEXT,
ADD COLUMN     "sitemapEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialFacebook" TEXT,
ADD COLUMN     "socialInstagram" TEXT,
ADD COLUMN     "socialLinkedin" TEXT,
ADD COLUMN     "socialTiktok" TEXT,
ADD COLUMN     "socialX" TEXT,
ADD COLUMN     "socialYoutube" TEXT,
ADD COLUMN     "trackingNumberPrefix" TEXT NOT NULL DEFAULT 'CLM',
ADD COLUMN     "trackingStages" JSONB;

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "authSessionId" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" "AdminSessionEndReason",

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLoginEvent" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "kind" "AdminLoginEventKind" NOT NULL,
    "deviceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_authSessionId_key" ON "AdminSession"("authSessionId");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_endedAt_idx" ON "AdminSession"("adminId", "endedAt");

-- CreateIndex
CREATE INDEX "AdminLoginEvent_adminId_createdAt_idx" ON "AdminLoginEvent"("adminId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminLoginEvent" ADD CONSTRAINT "AdminLoginEvent_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── CHECK constraints ─────────────────────────────────────────────────
-- Not expressible in the Prisma schema, so they live here (see CLAUDE.md,
-- "What is enforced at the schema level"). Verified by npm run db:check.

-- 2–6 capital letters, and never a prefix that collides with another
-- reference once hyphens are dropped (CLM-O-…, CLM-V-…, CLM-Q-…, CLM-SP-…).
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_tracking_prefix_check"
  CHECK ("trackingNumberPrefix" ~ '^[A-Z]{2,6}$'
         AND "trackingNumberPrefix" NOT IN ('CLMO', 'CLMV', 'CLMQ', 'CLMSP'));

-- An hour to thirty days. Zero would sign every administrator out on every
-- request; unbounded is no timeout at all.
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_session_timeout_check"
  CHECK ("sessionTimeoutHours" BETWEEN 1 AND 720);

ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_default_country_check"
  CHECK ("defaultCountry" ~ '^[A-Z]{2}$');

-- A session cannot have a reason for ending without having ended, or the
-- reverse.
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_end_consistency_check"
  CHECK (("endedAt" IS NULL) = ("endReason" IS NULL));

-- ── Backfill the existing singleton ───────────────────────────────────
UPDATE "BusinessSettings"
SET "primaryPhone"    = '+211 900 000 000',
    "businessEmail"   = 'info@crownlinemotors.com',
    "businessAddress" = 'Juba, South Sudan',
    "businessHours"   = '[
      {"day":"MONDAY","closed":false,"opensAt":"08:00","closesAt":"18:00"},
      {"day":"TUESDAY","closed":false,"opensAt":"08:00","closesAt":"18:00"},
      {"day":"WEDNESDAY","closed":false,"opensAt":"08:00","closesAt":"18:00"},
      {"day":"THURSDAY","closed":false,"opensAt":"08:00","closesAt":"18:00"},
      {"day":"FRIDAY","closed":false,"opensAt":"08:00","closesAt":"18:00"},
      {"day":"SATURDAY","closed":false,"opensAt":"08:00","closesAt":"18:00"},
      {"day":"SUNDAY","closed":true,"opensAt":"08:00","closesAt":"18:00"}
    ]'::jsonb,
    "socialFacebook"  = 'https://facebook.com/crownlinemotors',
    "socialInstagram" = 'https://instagram.com/crownlinemotors',
    "socialLinkedin"  = 'https://www.linkedin.com/company/crownlinemotors'
WHERE "id" = 1;
