-- The public NC campaign was still in pre-launch verification before this
-- timestamp. Browser link checks created unresolved intent rows that were
-- visible as "In progress" even though no contribution was confirmed.
-- Preserve the audit rows, but remove them from public progress exactly once.
UPDATE "pledges" AS p
SET
  "status" = 'EXPIRED',
  "updated_at" = CURRENT_TIMESTAMP
FROM "fundraising_targets" AS t
JOIN "coalitions" AS c ON c."id" = t."coalition_id"
WHERE p."target_id" = t."id"
  AND c."slug" = 'nc-hemp-industry'
  AND p."status" = 'PENDING'
  AND p."created_at" < TIMESTAMPTZ '2026-08-09T11:57:24.230Z';
