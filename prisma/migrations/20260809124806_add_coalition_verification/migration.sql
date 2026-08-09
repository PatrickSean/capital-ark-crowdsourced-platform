-- Community-created drives stay immediately shareable without inheriting the
-- trust language reserved for data reviewed by Capital Ark.
CREATE TYPE "CoalitionVerificationStatus" AS ENUM (
  'COMMUNITY_UNVERIFIED',
  'PLATFORM_VERIFIED'
);

ALTER TABLE "coalitions"
  ADD COLUMN "verification_status" "CoalitionVerificationStatus" NOT NULL DEFAULT 'COMMUNITY_UNVERIFIED',
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "organizer_attested_at" TIMESTAMP(3);

-- This is the one curated production slate that was reviewed before the open
-- creation flow launched. All other existing and future public-created rows
-- remain explicitly COMMUNITY_UNVERIFIED unless an admin reviews them.
UPDATE "coalitions"
SET
  "verification_status" = 'PLATFORM_VERIFIED',
  "reviewed_at" = TIMESTAMP '2026-08-08 00:00:00'
WHERE "slug" = 'nc-hemp-industry';
