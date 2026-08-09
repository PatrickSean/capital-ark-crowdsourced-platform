-- Optional AI receipt checks retain only derived, non-donor fields. The raw
-- screenshot is never written to this database by the AI review path.
CREATE TYPE "ReceiptCheckStatus" AS ENUM (
  'NOT_REQUESTED',
  'AI_CHECKED_MATCH',
  'AI_NEEDS_REVIEW',
  'AI_UNAVAILABLE'
);

ALTER TABLE "pledges"
  ADD COLUMN "client_request_id" UUID,
  ADD COLUMN "evidence_type" "ContributionEvidenceType",
  ADD COLUMN "receipt_check_status" "ReceiptCheckStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "receipt_evidence_hash" VARCHAR(64),
  ADD COLUMN "receipt_check_model" VARCHAR(100),
  ADD COLUMN "receipt_checked_at" TIMESTAMP(3),
  ADD COLUMN "receipt_extracted_amount_cents" INTEGER,
  ADD COLUMN "receipt_contribution_date" DATE,
  ADD COLUMN "receipt_candidate_matched" BOOLEAN,
  ADD COLUMN "receipt_committee_matched" BOOLEAN,
  ADD COLUMN "receipt_amount_matched" BOOLEAN,
  ADD COLUMN "receipt_processor_matched" BOOLEAN,
  ADD COLUMN "receipt_date_plausible" BOOLEAN,
  ADD COLUMN "receipt_check_reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Preserve existing trust semantics conservatively. Legacy COMPLETED rows are
-- receipt-backed only when a private receipt key actually exists; every other
-- contributor-confirmed row is self-reported.
UPDATE "pledges"
SET "status" = 'UNVERIFIED'
WHERE "status" = 'COMPLETED'
  AND NULLIF(BTRIM("receipt_url"), '') IS NULL;

UPDATE "pledges"
SET "evidence_type" = CASE
  WHEN "status" = 'COMPLETED'
    AND NULLIF(BTRIM("receipt_url"), '') IS NOT NULL
    THEN 'RECEIPT_ATTACHED'::"ContributionEvidenceType"
  WHEN "status" IN ('COMPLETED', 'UNVERIFIED')
    THEN 'SELF_REPORTED'::"ContributionEvidenceType"
  ELSE NULL
END;

CREATE UNIQUE INDEX "pledges_receipt_evidence_hash_key"
  ON "pledges"("receipt_evidence_hash");

CREATE UNIQUE INDEX "pledges_user_id_client_request_id_key"
  ON "pledges"("user_id", "client_request_id");
