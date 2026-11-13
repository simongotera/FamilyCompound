-- Location quiz: each member's answers, researched location facts (with sources), and saved shortlists.
--
-- Safe to re-run: it stops with a clear message instead of half-applying.
-- Assumes existing tables: public.members (id, auth_user_id), public.countries (id),
-- public.land_options (id). The preflight below checks those id types really are uuid —
-- it was written without access to the live database, so it verifies rather than assumes.
--
-- To apply: paste this whole file into the Supabase SQL editor and run it, or
--   supabase link --project-ref <ref> && supabase db push

-- ---------- preflight ----------
do $$
declare
  bad text;
begin
  select string_agg(format('%s.%s is %s', table_name, column_name, data_type), ', ')
    into bad
  from information_schema.columns
  where table_schema = 'public'
    and ((table_name = 'members' and column_name in ('id', 'auth_user_id'))
      or (table_name in ('countries', 'land_options') and column_name = 'id'))
    and data_type <> 'uuid';
  if bad is not null then
    raise exception 'Location quiz migration expects uuid ids, but found: %. Change the foreign-key column types in this file to match before applying.', bad;
  end if;

  if to_regclass('public.members') is null then
    raise exception 'public.members does not exist — wrong database?';
  end if;

  if to_regclass('public.location_quiz_responses') is not null
     or to_regclass('public.location_facts') is not null
     or to_regclass('public.location_shortlists') is not null then
    raise exception 'The location quiz tables already exist. Nothing applied.';
  end if;
end
$$;

-- Is the signed-in user this member? Wrapped in (select ...) in policies so it runs once per query.
create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.members m where m.auth_user_id = (select auth.uid()) limit 1;
$$;
revoke execute on function public.current_member_id() from public, anon;
grant execute on function public.current_member_id() to authenticated;

-- One row per member: sliders, pairwise judgments, dealbreakers.
create table public.location_quiz_responses (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  sliders jsonb not null default '{}'::jsonb,
  top_criteria text[] not null default '{}',
  pairwise jsonb not null default '{}'::jsonb,
  dealbreakers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A researched rating for one criterion of one country or parcel. A source is required:
-- the quiz never scores a location from an unsourced number.
create table public.location_facts (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('country', 'parcel')),
  country_id uuid references public.countries(id) on delete cascade,
  land_option_id uuid references public.land_options(id) on delete cascade,
  criterion text not null check (criterion ~ '^[a-z_]{2,40}$'),
  rating numeric(2,1) not null check (rating between 1 and 5),
  value_text text check (char_length(value_text) <= 300),
  source text not null check (char_length(btrim(source)) between 3 and 1000),
  notes text check (char_length(notes) <= 2000),
  added_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (target_type = 'country' and country_id is not null and land_option_id is null)
    or (target_type = 'parcel' and land_option_id is not null and country_id is null)
  )
);
create index location_facts_country_idx on public.location_facts (country_id, criterion) where country_id is not null;
create index location_facts_parcel_idx on public.location_facts (land_option_id, criterion) where land_option_id is not null;
create index location_facts_added_by_idx on public.location_facts (added_by);

-- A saved snapshot of a quiz result (ranked shortlist with reasons).
create table public.location_shortlists (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  scope text not null check (scope in ('countries', 'parcels')),
  participants jsonb not null default '[]'::jsonb,
  result jsonb not null,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index location_shortlists_created_by_idx on public.location_shortlists (created_by);

alter table public.location_quiz_responses enable row level security;
alter table public.location_facts enable row level security;
alter table public.location_shortlists enable row level security;

-- Everyone in the compound can see everyone's answers (results are combined), facts and shortlists.
create policy "members read quiz responses" on public.location_quiz_responses
  for select to authenticated using ((select public.current_member_id()) is not null);
create policy "members write own quiz response" on public.location_quiz_responses
  for insert to authenticated with check (member_id = (select public.current_member_id()));
create policy "members update own quiz response" on public.location_quiz_responses
  for update to authenticated using (member_id = (select public.current_member_id()))
  with check (member_id = (select public.current_member_id()));
create policy "members delete own quiz response" on public.location_quiz_responses
  for delete to authenticated using (member_id = (select public.current_member_id()));

create policy "members read facts" on public.location_facts
  for select to authenticated using ((select public.current_member_id()) is not null);
create policy "members add facts as themselves" on public.location_facts
  for insert to authenticated with check (added_by = (select public.current_member_id()));
create policy "members delete own facts" on public.location_facts
  for delete to authenticated using (added_by = (select public.current_member_id()));

create policy "members read shortlists" on public.location_shortlists
  for select to authenticated using ((select public.current_member_id()) is not null);
create policy "members save shortlists as themselves" on public.location_shortlists
  for insert to authenticated with check (created_by = (select public.current_member_id()));
create policy "members delete own shortlists" on public.location_shortlists
  for delete to authenticated using (created_by = (select public.current_member_id()));
