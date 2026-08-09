CREATE TYPE "ContributionEvidenceType" AS ENUM (
  'SELF_REPORTED',
  'RECEIPT_ATTACHED',
  'RECEIPT_AI_CHECKED'
);

ALTER TABLE "activity_events"
ADD COLUMN "evidence_type" "ContributionEvidenceType";

-- Public activity never needs a contributor identifier. Pledge ownership
-- remains on the private pledge row; old feed rows are scrubbed in place.
UPDATE "activity_events"
SET "actor_id" = NULL,
    "actor_label" = NULL
WHERE "type" = 'PLEDGE_CONFIRMED';

CREATE INDEX "activity_events_target_id_created_at_idx"
ON "activity_events"("target_id", "created_at");
