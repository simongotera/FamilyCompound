-- The gate in front of the app: waitlist, allow-list, access codes, per-person invite links.
--
-- Design notes that matter:
--   * None of these tables grant anything to `anon` or `authenticated`, except INSERT on the
--     waitlist. They are reachable only by the edge function's service role and the SQL editor,
--     so a mistake in a policy cannot expose them.
--   * Codes and invite tokens are stored as bcrypt hashes, never in plaintext.
--   * Verification happens in SECURITY DEFINER functions here, never in browser JavaScript.
--   * Sign-ups stay OFF in Supabase Auth permanently. The edge function creates users with the
--     service role, which that setting does not restrict. The gate is therefore the only door.
--
-- Requires 20261113140000_families.sql. Safe to re-run: aborts rather than half-applying.

do $$
begin
  if to_regclass('public.families') is null then
    raise exception 'Run the families migration first.';
  end if;
  if to_regclass('public.access_codes') is not null then
    raise exception 'The gate tables already exist. Nothing applied.';
  end if;
end
$$;

create extension if not exists pgcrypto with schema extensions;

-- ---------- tables ----------

-- Anyone may add themselves. Nobody may read it back through the API.
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1 and char_length(email) <= 320),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
-- A plain unique constraint, not a unique index on lower(email): ON CONFLICT cannot use an
-- expression index, and the edge function always lowercases before writing.
alter table public.waitlist add constraint waitlist_email_key unique (email);

-- Emails Simon has approved up front. Matching one gets you in with no code.
create table public.allowed_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index allowed_emails_email_key on public.allowed_emails (lower(email));

-- A shared code. Only its bcrypt hash is stored.
create table public.access_codes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  code_hash text not null,
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses between 1 and 1000),
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Per-person invite links: one token, one person, individually revocable.
create table public.invite_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  label text check (char_length(label) <= 120),
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_email text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Every attempt, successful or not. Drives the rate limit and the audit trail.
create table public.access_attempts (
  id bigserial primary key,
  email text,
  ip inet,
  outcome text not null check (outcome in ('granted_allowlist','granted_code','granted_invite',
                                           'denied_unknown','denied_bad_code','denied_rate_limited','waitlisted')),
  created_at timestamptz not null default now()
);
create index access_attempts_email_idx on public.access_attempts (lower(email), created_at desc);
create index access_attempts_ip_idx on public.access_attempts (ip, created_at desc);

-- Granted access, waiting to be claimed on first sign-in.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);
-- Likewise plain, and not partial: a partial index is no good as a conflict target either.
-- One invite row per email; re-granting access resets consumed_at.
alter table public.invites add constraint invites_email_key unique (email);

-- ---------- lock everything down ----------
alter table public.waitlist enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.access_codes enable row level security;
alter table public.invite_links enable row level security;
alter table public.access_attempts enable row level security;
alter table public.invites enable row level security;

revoke all on public.waitlist, public.allowed_emails, public.access_codes,
               public.invite_links, public.access_attempts, public.invites
  from anon, authenticated;

-- The one exception: a visitor may put their email on the waitlist, and read nothing back.
grant insert on public.waitlist to anon, authenticated;

-- The edge function's service role. access_codes and invite_links are deliberately absent:
-- they are only ever reached through SECURITY DEFINER functions, so even a compromised edge
-- function cannot read a hash or mint a code. bigserial also needs its sequence.
grant select, insert on public.waitlist to service_role;
grant select on public.allowed_emails to service_role;
grant insert on public.access_attempts to service_role;
grant usage on sequence public.access_attempts_id_seq to service_role;
grant select, insert, update on public.invites to service_role;
grant select on public.members to service_role;
grant execute on function public.access_rate_limited(text, inet) to service_role;
grant execute on function public.verify_access_code(text) to service_role;
grant execute on function public.verify_invite_token(text, text) to service_role;
create policy "anyone may join the waitlist" on public.waitlist
  for insert to anon, authenticated with check (true);

-- ---------- minting ----------

-- Generates a random code, stores only its hash, and returns the plaintext ONCE.
-- Run from the Supabase SQL editor. Copy the result into a password manager, then clear the tab.
create or replace function public.mint_access_code(
  p_label text,
  p_days integer default 90,
  p_max_uses integer default 25,
  p_family_id uuid default null
)
returns table (code text, expires_at timestamptz, label text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- No 0/O/1/I/l: these get read aloud and written down.
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  raw text := '';
  i integer;
  fam uuid;
  exp timestamptz;
begin
  fam := coalesce(p_family_id, (select f.id from public.families f order by f.created_at limit 1));
  if fam is null then raise exception 'No family to attach the code to.'; end if;

  for i in 1..16 loop
    raw := raw || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  -- Grouped for reading aloud over the phone.
  raw := substr(raw,1,4)||'-'||substr(raw,5,4)||'-'||substr(raw,9,4)||'-'||substr(raw,13,4);

  exp := now() + make_interval(days => p_days);
  insert into public.access_codes (family_id, label, code_hash, expires_at, max_uses)
  values (fam, p_label, extensions.crypt(raw, extensions.gen_salt('bf', 12)), exp, p_max_uses);

  return query select raw, exp, p_label;
end
$$;
revoke all on function public.mint_access_code(text, integer, integer, uuid) from public, anon, authenticated;

-- A per-person invite link. Returns the token once; the URL is /join?token=...
create or replace function public.mint_invite_link(
  p_label text,
  p_days integer default 30,
  p_family_id uuid default null
)
returns table (token text, expires_at timestamptz, label text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw text;
  fam uuid;
  exp timestamptz;
begin
  fam := coalesce(p_family_id, (select f.id from public.families f order by f.created_at limit 1));
  if fam is null then raise exception 'No family to attach the invite to.'; end if;
  raw := encode(extensions.gen_random_bytes(24), 'hex');
  exp := now() + make_interval(days => p_days);
  insert into public.invite_links (family_id, label, token_hash, expires_at)
  values (fam, p_label, extensions.crypt(raw, extensions.gen_salt('bf', 12)), exp);
  return query select raw, exp, p_label;
end
$$;
revoke all on function public.mint_invite_link(text, integer, uuid) from public, anon, authenticated;

-- ---------- verification (service role only, via the edge function) ----------

-- Returns the family to join, or null. Never reveals why it failed.
create or replace function public.verify_access_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
begin
  if p_code is null or btrim(p_code) = '' then return null; end if;
  for rec in
    select * from public.access_codes
    where revoked_at is null and expires_at > now() and use_count < max_uses
  loop
    if rec.code_hash = extensions.crypt(upper(btrim(p_code)), rec.code_hash) then
      update public.access_codes set use_count = use_count + 1 where id = rec.id;
      return rec.family_id;
    end if;
  end loop;
  return null;
end
$$;
revoke all on function public.verify_access_code(text) from public, anon, authenticated;

create or replace function public.verify_invite_token(p_token text, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
begin
  if p_token is null or btrim(p_token) = '' then return null; end if;
  for rec in
    select * from public.invite_links
    where revoked_at is null and used_at is null and expires_at > now()
  loop
    if rec.token_hash = extensions.crypt(btrim(p_token), rec.token_hash) then
      update public.invite_links set used_at = now(), used_by_email = lower(btrim(p_email)) where id = rec.id;
      return rec.family_id;
    end if;
  end loop;
  return null;
end
$$;
revoke all on function public.verify_invite_token(text, text) from public, anon, authenticated;

-- Has this email or IP been trying too often? 5 per email / 15 min, 20 per IP / hour.
create or replace function public.access_rate_limited(p_email text, p_ip inet)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.access_attempts
      where lower(email) = lower(btrim(p_email))
        and outcome like 'denied%'
        and created_at > now() - interval '15 minutes') >= 5
    or
    (select count(*) from public.access_attempts
      where p_ip is not null and ip = p_ip
        and outcome like 'denied%'
        and created_at > now() - interval '1 hour') >= 20;
$$;
revoke all on function public.access_rate_limited(text, inet) from public, anon, authenticated;

-- ---------- joining, once signed in ----------

-- The client never supplies a family_id. This reads the invite for the email in the caller's
-- own JWT, creates the member in that family, and consumes the invite.
create or replace function public.join_my_family(p_name text, p_household text default null, p_locale text default 'en')
returns public.members
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  mail text := lower(btrim((select auth.jwt() ->> 'email')));
  inv record;
  existing public.members;
  created public.members;
begin
  if uid is null then raise exception 'Not signed in.'; end if;

  select * into existing from public.members where auth_user_id = uid;
  if found then return existing; end if;

  select * into inv from public.invites
    where lower(email) = mail and consumed_at is null
    order by created_at desc limit 1;
  if not found then
    raise exception 'No invitation for this account.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.members (auth_user_id, name, email, household, locale, family_id)
  values (uid, btrim(p_name), mail, nullif(btrim(coalesce(p_household,'')),''), p_locale, inv.family_id)
  returning * into created;

  update public.invites set consumed_at = now() where id = inv.id;
  return created;
end
$$;
revoke all on function public.join_my_family(text, text, text) from public, anon;
grant execute on function public.join_my_family(text, text, text) to authenticated;
