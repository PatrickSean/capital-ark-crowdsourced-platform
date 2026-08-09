-- Minimize outbound-link telemetry before source publication.
--
-- Link events are attribution counters, not visitor histories. Keep only the
-- target, processor, tracking tag, optional intended amount, and timestamp.
-- Dropping these columns also permanently removes any historical prefill data
-- that may have appeared in a generated URL.
--
-- Older Supabase installs may have policies whose expressions depend on the
-- identity columns. PostgreSQL will reject the column drop until those policy
-- dependencies are removed; the hardened rls.sql intentionally recreates no
-- browser policy for this private table.
DROP POLICY IF EXISTS "users log their own click events"
  ON public."link_click_events";
DROP POLICY IF EXISTS "admins read click events"
  ON public."link_click_events";

ALTER TABLE "link_click_events"
  DROP CONSTRAINT IF EXISTS "link_click_events_pledge_id_fkey",
  DROP CONSTRAINT IF EXISTS "link_click_events_user_id_fkey";

ALTER TABLE "link_click_events"
  DROP COLUMN "pledge_id",
  DROP COLUMN "user_id",
  DROP COLUMN "generated_url",
  DROP COLUMN "referrer",
  DROP COLUMN "ip_hash";

-- Full browser user-agent strings were not used by any application flow.
ALTER TABLE "pledges" DROP COLUMN "user_agent";

-- Apply the documented retention boundary immediately for existing records;
-- the hourly retention job keeps it enforced after this migration.
UPDATE "pledges"
SET "ip_hash" = NULL
WHERE "ip_hash" IS NOT NULL
  AND "created_at" < CURRENT_TIMESTAMP - INTERVAL '30 days';
