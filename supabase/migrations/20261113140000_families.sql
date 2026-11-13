-- Families as a first-class scope.
--
-- Replaces the inherited "any signed-in user sees and may delete everything" model
-- (every pre-existing policy was `auth.role() = 'authenticated'`) with per-family scoping.
--
-- Every data table carries family_id, defaulted from the caller's session so the client
-- never supplies it and cannot supply a wrong one. Delete rules are set to match what the
-- app's UI already allows, so nothing changes behaviour by surprise:
--   family-wide delete: land_options, countries, decisions
--   author-only delete: priorities, budget_contributions, tasks,
--                       location_quiz_responses, location_facts, location_shortlists
--
-- Safe to re-run: aborts with a clear message instead of half-applying.

-- ---------- preflight ----------
do $$
begin
  if to_regclass('public.families') is not null then
    raise exception 'public.families already exists. Nothing applied.';
  end if;
  if to_regclass('public.members') is null then
    raise exception 'public.members does not exist — wrong database?';
  end if;
end
$$;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

-- ---------- add family_id everywhere, then backfill ----------
-- members.family_id has to exist before the helper below, because Postgres validates a SQL
-- function's body at creation time.
alter table public.members add column family_id uuid references public.families(id) on delete restrict;

-- Resolve the caller's family once per query, not once per row.
create or replace function public.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.family_id from public.members m where m.auth_user_id = (select auth.uid()) limit 1;
$$;
revoke execute on function public.current_family_id() from public, anon;
grant execute on function public.current_family_id() to authenticated;

do $$
declare
  fam uuid;
  t text;
  tables text[] := array[
    'land_options','countries','priorities','budget_contributions','decisions','tasks',
    'location_quiz_responses','location_facts','location_shortlists'
  ];
  orphans bigint;
begin
  -- One family for everything that exists today. Renaming it later is a plain UPDATE.
  insert into public.families (name) values ('Gotera') returning id into fam;

  update public.members set family_id = fam where family_id is null;

  foreach t in array tables loop
    execute format('alter table public.%I add column family_id uuid references public.families(id) on delete restrict', t);
    execute format('update public.%I set family_id = $1 where family_id is null', t) using fam;

    execute format('select count(*) from public.%I where family_id is null', t) into orphans;
    if orphans > 0 then
      raise exception 'Backfill left % orphaned rows in %, rolling back', orphans, t;
    end if;

    execute format('alter table public.%I alter column family_id set not null', t);
    execute format('alter table public.%I alter column family_id set default public.current_family_id()', t);
    execute format('create index %I on public.%I (family_id)', t || '_family_idx', t);
  end loop;

  select count(*) into orphans from public.members where family_id is null;
  if orphans > 0 then
    raise exception 'Backfill left % members without a family, rolling back', orphans;
  end if;
end
$$;

alter table public.members alter column family_id set not null;
create index members_family_idx on public.members (family_id);

-- ---------- replace the policies ----------
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('land_options','countries','priorities','budget_contributions','decisions',
                        'tasks','location_quiz_responses','location_facts','location_shortlists','members')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$$;

-- members: everyone in the family can see each other; you may only edit your own row.
-- INSERT is deliberately absent — joining happens through public.join_my_family() in the
-- gate migration, so the client can never choose its own family.
create policy "members read own family" on public.members
  for select to authenticated using (family_id = (select public.current_family_id()));
create policy "members update own row" on public.members
  for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()) and family_id = (select public.current_family_id()));

-- Shared family research: any member may read, add, edit and delete.
do $$
declare
  t text;
begin
  foreach t in array array['land_options','countries','decisions'] loop
    execute format($f$
      create policy "family reads %1$s" on public.%1$I
        for select to authenticated using (family_id = (select public.current_family_id()));
      create policy "family inserts %1$s" on public.%1$I
        for insert to authenticated with check (family_id = (select public.current_family_id()));
      create policy "family updates %1$s" on public.%1$I
        for update to authenticated
        using (family_id = (select public.current_family_id()))
        with check (family_id = (select public.current_family_id()));
      create policy "family deletes %1$s" on public.%1$I
        for delete to authenticated using (family_id = (select public.current_family_id()));
    $f$, t);
  end loop;
end
$$;

-- Personal entries: the family reads them, only the author may change or remove them.
do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('priorities', 'member_id', false),
      ('budget_contributions', 'member_id', false),
      ('tasks', 'owner_id', true),               -- anyone may tick a task off
      ('location_quiz_responses', 'member_id', false),
      ('location_facts', 'added_by', false),
      ('location_shortlists', 'created_by', false)
    ) as v(tbl, owner_col, family_update)
  loop
    execute format($f$
      create policy "family reads %1$s" on public.%1$I
        for select to authenticated using (family_id = (select public.current_family_id()));
      create policy "author inserts %1$s" on public.%1$I
        for insert to authenticated
        with check (family_id = (select public.current_family_id())
                    and %2$I = (select public.current_member_id()));
      create policy "author deletes %1$s" on public.%1$I
        for delete to authenticated
        using (family_id = (select public.current_family_id())
               and %2$I = (select public.current_member_id()));
    $f$, spec.tbl, spec.owner_col);

    if spec.family_update then
      execute format($f$
        create policy "family updates %1$s" on public.%1$I
          for update to authenticated
          using (family_id = (select public.current_family_id()))
          with check (family_id = (select public.current_family_id()));
      $f$, spec.tbl);
    else
      execute format($f$
        create policy "author updates %1$s" on public.%1$I
          for update to authenticated
          using (family_id = (select public.current_family_id())
                 and %2$I = (select public.current_member_id()))
          with check (family_id = (select public.current_family_id())
                      and %2$I = (select public.current_member_id()));
      $f$, spec.tbl, spec.owner_col);
    end if;
  end loop;
end
$$;

-- location_facts and location_shortlists were created without UPDATE grants; the rest keep theirs.
grant select, insert, update, delete on public.members to authenticated;

-- Supabase's advisor flags this as callable by anon. It is an event-trigger function, so
-- Postgres refuses to call it directly anyway — but there is no reason for it to be callable.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
