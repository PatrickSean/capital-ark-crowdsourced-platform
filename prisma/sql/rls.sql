-- ---------------------------------------------------------------------------
-- Capital Ark row level security.
--
-- Run this AFTER `prisma migrate deploy`, against your Supabase database:
--   psql "$DIRECT_URL" -f prisma/sql/rls.sql
--
-- The governing idea: anonymous users are first-class contributors. They may
-- read public campaign data and write their own pledges, because requiring a
-- signup before someone can give is the single biggest drop-off in the funnel.
-- What they may NOT do is administer a coalition, since that needs an identity
-- we can hold accountable.
-- ---------------------------------------------------------------------------

alter table public.users               enable row level security;
alter table public.coalitions          enable row level security;
alter table public.coalition_members   enable row level security;
alter table public.candidates          enable row level security;
alter table public.fundraising_targets enable row level security;
alter table public.pledges             enable row level security;
alter table public.link_click_events   enable row level security;
alter table public.activity_events     enable row level security;

-- True only for users who have linked an email or OAuth identity.
create or replace function public.is_permanent_user()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'is_anonymous', 'true') = 'false';
$$;

create or replace function public.is_coalition_admin(target_coalition uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.coalition_members m
     where m.coalition_id = target_coalition
       and m.user_id = auth.uid()
       and m.role in ('OWNER', 'ADMIN')
  );
$$;

-- users -----------------------------------------------------------------
create policy "users read own row"
  on public.users for select
  using (id = auth.uid());

create policy "users update own row"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- coalitions ------------------------------------------------------------
-- Public coalitions are readable by everyone including signed-out visitors,
-- because a shared link has to render before the visitor has any session.
create policy "public coalitions are world readable"
  on public.coalitions for select
  to anon, authenticated
  using (is_public or is_coalition_admin(id));

create policy "permanent users create coalitions"
  on public.coalitions for insert
  to authenticated
  with check (created_by_id = auth.uid() and public.is_permanent_user());

create policy "admins update their coalition"
  on public.coalitions for update
  to authenticated
  using (is_coalition_admin(id))
  with check (is_coalition_admin(id));

-- coalition_members -----------------------------------------------------
create policy "members read their own membership rows"
  on public.coalition_members for select
  to authenticated
  using (user_id = auth.uid() or is_coalition_admin(coalition_id));

create policy "admins manage membership"
  on public.coalition_members for all
  to authenticated
  using (is_coalition_admin(coalition_id))
  with check (is_coalition_admin(coalition_id));

-- candidates ------------------------------------------------------------
create policy "candidates are world readable"
  on public.candidates for select
  to anon, authenticated
  using (true);

create policy "permanent users add candidates"
  on public.candidates for insert
  to authenticated
  with check (public.is_permanent_user());

-- fundraising_targets ---------------------------------------------------
create policy "targets of public coalitions are world readable"
  on public.fundraising_targets for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.coalitions c
       where c.id = coalition_id and (c.is_public or is_coalition_admin(c.id))
    )
  );

create policy "admins manage targets"
  on public.fundraising_targets for all
  to authenticated
  using (is_coalition_admin(coalition_id))
  with check (is_coalition_admin(coalition_id));

-- pledges ---------------------------------------------------------------
-- Deliberately narrow. Individual pledge rows carry the donor's identity and
-- receipt, so they are visible only to the pledger and coalition admins. The
-- public progress bar is served from an aggregate (see progress_totals below),
-- never by letting clients read the underlying rows.
create policy "pledgers read their own pledges"
  on public.pledges for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.fundraising_targets t
       where t.id = target_id and is_coalition_admin(t.coalition_id)
    )
  );

-- Anonymous users may pledge, unless the coalition has opted into requiring
-- a signed-in identity.
create policy "users create their own pledges"
  on public.pledges for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.fundraising_targets t
        join public.coalitions c on c.id = t.coalition_id
       where t.id = target_id
         and t.status = 'ACTIVE'
         and (not c.require_sign_in or public.is_permanent_user())
    )
  );

create policy "pledgers update their own pledges"
  on public.pledges for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- link_click_events -----------------------------------------------------
create policy "admins read click events"
  on public.link_click_events for select
  to authenticated
  using (
    exists (
      select 1 from public.fundraising_targets t
       where t.id = target_id and is_coalition_admin(t.coalition_id)
    )
  );

create policy "users log their own click events"
  on public.link_click_events for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- activity_events -------------------------------------------------------
create policy "activity of public coalitions is world readable"
  on public.activity_events for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.coalitions c
       where c.id = coalition_id and (c.is_public or is_coalition_admin(c.id))
    )
  );

-- ---------------------------------------------------------------------------
-- Public progress aggregate.
--
-- Exposes only sums, never rows, so a signed-out visitor can see a live
-- progress bar without any pledge-level data leaving the database.
-- ---------------------------------------------------------------------------
create or replace view public.target_progress
with (security_invoker = off) as
  select
    t.id                                                                as target_id,
    t.goal_cents,
    coalesce(sum(p.confirmed_amount_cents) filter (where p.status = 'COMPLETED'),  0)::bigint as confirmed_cents,
    coalesce(sum(p.confirmed_amount_cents) filter (where p.status = 'UNVERIFIED'), 0)::bigint as attested_cents,
    coalesce(sum(p.amount_cents)           filter (where p.status = 'PENDING'),    0)::bigint as pending_cents,
    count(distinct p.user_id) filter (where p.status in ('COMPLETED', 'UNVERIFIED'))          as donor_count
  from public.fundraising_targets t
  left join public.pledges p on p.target_id = t.id
  group by t.id, t.goal_cents;

grant select on public.target_progress to anon, authenticated;

-- Receipts bucket: private, owner-scoped, served only via signed URLs.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "users upload their own receipts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read their own receipts"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
