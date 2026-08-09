-- ---------------------------------------------------------------------------
-- Capital Ark row-level security for the optional Supabase deployment.
--
-- Run this AFTER `prisma migrate deploy`, as the database owner:
--   psql "$DIRECT_URL" -f prisma/sql/rls.sql
--
-- Browser roles are read-only. Every mutation and every private read goes
-- through Capital Ark's server, where authorization is enforced before Prisma
-- uses a private database role with BYPASSRLS (or equivalent table-owner
-- access). Never expose that database credential or a Supabase service-role
-- token to a browser.
-- ---------------------------------------------------------------------------

alter table public.users               enable row level security;
alter table public.coalitions          enable row level security;
alter table public.coalition_members   enable row level security;
alter table public.candidates          enable row level security;
alter table public.fundraising_targets enable row level security;
alter table public.pledges             enable row level security;
alter table public.link_click_events   enable row level security;
alter table public.activity_events     enable row level security;

-- Remove every policy name shipped by earlier versions before defining the
-- intentionally small read-only surface. Revoking privileges below is a second
-- independent boundary: a stale policy cannot restore browser access.
drop policy if exists "users read own row" on public.users;
drop policy if exists "users update own row" on public.users;
drop policy if exists "users_select_own" on public.users;

drop policy if exists "public coalitions are world readable" on public.coalitions;
drop policy if exists "permanent users create coalitions" on public.coalitions;
drop policy if exists "admins update their coalition" on public.coalitions;
drop policy if exists "coalitions_select_public" on public.coalitions;

drop policy if exists "members read their own membership rows" on public.coalition_members;
drop policy if exists "admins manage membership" on public.coalition_members;

drop policy if exists "candidates are world readable" on public.candidates;
drop policy if exists "permanent users add candidates" on public.candidates;
drop policy if exists "candidates_select_for_public_targets" on public.candidates;

drop policy if exists "targets of public coalitions are world readable" on public.fundraising_targets;
drop policy if exists "admins manage targets" on public.fundraising_targets;
drop policy if exists "targets_select_public" on public.fundraising_targets;

drop policy if exists "pledgers read their own pledges" on public.pledges;
drop policy if exists "users create their own pledges" on public.pledges;
drop policy if exists "pledgers update their own pledges" on public.pledges;

drop policy if exists "admins read click events" on public.link_click_events;
drop policy if exists "users log their own click events" on public.link_click_events;

drop policy if exists "activity of public coalitions is world readable" on public.activity_events;

drop policy if exists "users upload their own receipts" on storage.objects;
drop policy if exists "users read their own receipts" on storage.objects;

-- These SECURITY DEFINER helpers supported the removed client-admin policies.
-- Keeping them would create an unnecessary privilege surface.
drop function if exists public.is_coalition_admin(uuid);
drop function if exists public.is_permanent_user();

-- Supabase commonly grants broad table privileges to its API roles. Remove
-- all of them first, including anything inherited from PostgreSQL's PUBLIC
-- pseudo-role. Server credentials are deliberately not named or revoked here.
revoke all privileges on table
  public.users,
  public.coalitions,
  public.coalition_members,
  public.candidates,
  public.fundraising_targets,
  public.pledges,
  public.link_click_events,
  public.activity_events
from public;

revoke all privileges on table
  public.users,
  public.coalitions,
  public.coalition_members,
  public.candidates,
  public.fundraising_targets,
  public.pledges,
  public.link_click_events,
  public.activity_events
from anon, authenticated;

-- users ---------------------------------------------------------------------
-- An authenticated person may read only their own profile. There is no client
-- update policy; account changes go through an authorized server endpoint.
create policy "users_select_own"
  on public.users for select
  to authenticated
  using (id = auth.uid());

grant select (
  id,
  email,
  display_name,
  avatar_url,
  is_anonymous,
  employer,
  occupation,
  city,
  state,
  zip,
  created_at,
  updated_at
) on public.users to authenticated;

-- coalitions ----------------------------------------------------------------
create policy "coalitions_select_public"
  on public.coalitions for select
  to anon, authenticated
  using (is_public = true);

grant select (
  id,
  slug,
  name,
  description,
  logo_url,
  tracking_prefix,
  flat_tracking_tag,
  require_sign_in,
  verification_status,
  reviewed_at,
  is_public,
  created_at,
  updated_at
) on public.coalitions to anon, authenticated;

-- fundraising_targets -------------------------------------------------------
create policy "targets_select_public"
  on public.fundraising_targets for select
  to anon, authenticated
  using (
    status = 'ACTIVE'
    and exists (
      select 1
        from public.coalitions c
       where c.id = coalition_id
         and c.is_public = true
    )
  );

grant select (
  id,
  slug,
  coalition_id,
  candidate_id,
  title,
  description,
  goal_cents,
  deadline,
  suggested_amounts,
  status,
  created_at,
  updated_at
) on public.fundraising_targets to anon, authenticated;

-- candidates ----------------------------------------------------------------
-- A candidate row is public only when an active target in a public coalition
-- references it. This avoids turning the candidates table into a world-readable
-- directory unrelated to a visible drive.
create policy "candidates_select_for_public_targets"
  on public.candidates for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
        from public.fundraising_targets t
        join public.coalitions c on c.id = t.coalition_id
       where t.candidate_id = candidates.id
         and t.status = 'ACTIVE'
         and c.is_public = true
    )
  );

grant select (
  id,
  slug,
  full_name,
  legal_name,
  party,
  office,
  state,
  district,
  bio,
  photo_url,
  donation_url,
  donation_url_verified_at,
  platform,
  website_url,
  official_profile_url,
  official_data_verified_at,
  jurisdiction,
  committee_name,
  ncsbe_committee_id,
  fec_candidate_id,
  fec_committee_id,
  is_active,
  created_at,
  updated_at
) on public.candidates to anon, authenticated;

-- No policies or browser grants are created for coalition_members, pledges,
-- link_click_events, or activity_events. Coalition admins do not receive a
-- database-side exception. Server endpoints authorize every private read and
-- write, and public activity is served only through the app's sanitized view
-- model rather than raw activity rows.

-- ---------------------------------------------------------------------------
-- Public progress aggregate.
--
-- The view exposes sums only. Historical UNVERIFIED/self-reported rows remain
-- stored but never affect public progress or donor counts. COMPLETED rows count
-- only when backed by receipt evidence. Pending intent is visible for 72 hours,
-- matching the application expiry window. The view owner must be the trusted
-- migration role; security_invoker=off intentionally prevents API roles from
-- needing any access to private pledge rows.
-- ---------------------------------------------------------------------------
drop view if exists public.target_progress;

create view public.target_progress
with (security_invoker = off) as
  select
    t.id as target_id,
    t.goal_cents,
    coalesce(
      sum(coalesce(p.confirmed_amount_cents, p.amount_cents)) filter (
        where p.status = 'COMPLETED'
          and p.evidence_type in ('RECEIPT_ATTACHED', 'RECEIPT_AI_CHECKED')
      ),
      0
    )::bigint as confirmed_cents,
    0::bigint as attested_cents,
    coalesce(
      sum(p.amount_cents) filter (
        where p.status = 'PENDING'
          and p.created_at >= now() - interval '72 hours'
      ),
      0
    )::bigint as pending_cents,
    coalesce(
      sum(coalesce(p.confirmed_amount_cents, p.amount_cents)) filter (
        where p.status = 'COMPLETED'
          and p.evidence_type in ('RECEIPT_ATTACHED', 'RECEIPT_AI_CHECKED')
      ),
      0
    )::bigint as raised_cents,
    count(distinct p.user_id) filter (
      where p.status = 'COMPLETED'
        and p.evidence_type in ('RECEIPT_ATTACHED', 'RECEIPT_AI_CHECKED')
    ) as donor_count
  from public.fundraising_targets t
  join public.coalitions c
    on c.id = t.coalition_id
   and c.is_public = true
  left join public.pledges p on p.target_id = t.id
  where t.status = 'ACTIVE'
  group by t.id, t.goal_cents;

revoke all privileges on public.target_progress from public;
revoke all privileges on public.target_progress from anon, authenticated;
grant select on public.target_progress to anon, authenticated;

-- Raw receipt persistence is no longer offered. Remove only the two policies
-- shipped by older Capital Ark releases. Do not drop the bucket or delete any
-- existing objects; operators may need to retain or dispose of them under
-- their own records policy.
