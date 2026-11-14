-- Let any family member hand out access from inside the app, instead of Simon running SQL.
--
-- What changes and what deliberately doesn't:
--   * Four new SECURITY DEFINER functions, EXECUTE granted to `authenticated`. They are the
--     only new surface. No table privilege is granted to anyone: the gate tables stay
--     unreachable through PostgREST, exactly as 20261113150000 left them.
--   * Still only a bcrypt hash is stored. The plaintext is returned once, by the function, to
--     the member who asked for it, and is never written to a table or a log.
--   * The caller never names a family. Every function resolves it from the caller's own
--     members row, so a member can only ever invite into their own family.
--   * Caps are per member and per family, so one member cannot mint invitations in bulk, and a
--     stolen session cannot either. Rate-limit refusals come back as SQLSTATE PT429/PT409,
--     which PostgREST turns into HTTP 429/409.
--   * Who minted what is recorded (invite_links.created_by, access_codes.created_by) and every
--     mint and revoke is appended to access_attempts, which is the existing audit trail.
--
-- The SQL-editor functions mint_access_code / mint_invite_link are left exactly as they are:
-- they take an explicit family and have no caps, which is right for a superuser and wrong for
-- a browser. Nothing here grants them to anybody.
--
-- Requires 20261113150000_access_gate.sql. Safe to re-run.

do $$
begin
  if to_regclass('public.access_codes') is null then
    raise exception 'Run the access gate migration first.';
  end if;
end
$$;

-- ---------- who minted it ----------

alter table public.access_codes
  add column if not exists created_by uuid references public.members(id) on delete set null;
alter table public.invite_links
  add column if not exists created_by uuid references public.members(id) on delete set null;

create index if not exists invite_links_family_idx on public.invite_links (family_id, created_at desc);
create index if not exists access_codes_family_idx on public.access_codes (family_id, created_at desc);
create index if not exists invite_links_creator_idx on public.invite_links (created_by, created_at desc);
create index if not exists access_codes_creator_idx on public.access_codes (created_by, created_at desc);

-- The audit trail gains three outcomes: a member minting or revoking is worth recording next
-- to the attempts to get in with what they minted.
alter table public.access_attempts drop constraint if exists access_attempts_outcome_check;
alter table public.access_attempts add constraint access_attempts_outcome_check
  check (outcome in ('granted_allowlist','granted_code','granted_invite',
                     'denied_unknown','denied_bad_code','denied_rate_limited','waitlisted',
                     'minted_invite','minted_code','revoked_invite'));

-- ---------- helper: the caller, as a member ----------

-- Raises rather than returning null, so no caller can forget to check.
create or replace function public.require_member()
returns public.members
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.members;
begin
  select * into me from public.members where auth_user_id = (select auth.uid());
  if not found then
    raise exception 'Only a family member can do this.' using errcode = 'PT403';
  end if;
  return me;
end
$$;
-- Not granted to anybody. It is called only from inside the other SECURITY DEFINER functions
-- below, which run as the owner, so `authenticated` never needs EXECUTE on it — granting it
-- would only expose one more /rest/v1/rpc endpoint for no benefit.
revoke all on function public.require_member() from public, anon, authenticated;

-- ---------- minting, from the app ----------

-- A link for one named person. Returns the token once; the caller builds <origin>/?token=…
create or replace function public.create_invite_link(p_label text, p_days integer default 30)
returns table (id uuid, token text, expires_at timestamptz, label text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := public.require_member();
  days integer := least(greatest(coalesce(p_days, 30), 1), 90);
  who text := nullif(btrim(coalesce(p_label, '')), '');
  raw text;
  exp timestamptz;
  new_id uuid;
begin
  if who is null then
    raise exception 'Say who the invitation is for.' using errcode = 'PT400';
  end if;
  if char_length(who) > 120 then
    raise exception 'That name is too long.' using errcode = 'PT400';
  end if;

  -- Every column below is qualified with the table alias: this function's OUT parameters are
  -- called id/label/expires_at, which would otherwise shadow the columns of the same name.
  --
  -- Per member, per day. Generous for a family, hopeless for anyone farming invitations.
  if (select count(*) from public.invite_links l
        where l.created_by = me.id and l.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'That is ten invitations today. Try again tomorrow.' using errcode = 'PT429';
  end if;
  -- Per family, outstanding. Unclaimed invitations are the thing worth bounding.
  if (select count(*) from public.invite_links l
        where l.family_id = me.family_id and l.revoked_at is null and l.used_at is null
          and l.expires_at > now()) >= 50 then
    raise exception 'There are already 50 unused invitations open. Revoke some first.'
      using errcode = 'PT409';
  end if;

  raw := encode(extensions.gen_random_bytes(24), 'hex');
  exp := now() + make_interval(days => days);
  insert into public.invite_links (family_id, label, token_hash, expires_at, created_by)
  values (me.family_id, who, extensions.crypt(raw, extensions.gen_salt('bf', 12)), exp, me.id)
  returning invite_links.id into new_id;

  insert into public.access_attempts (email, outcome) values (me.email, 'minted_invite');

  return query select new_id, raw, exp, who;
end
$$;
revoke all on function public.create_invite_link(text, integer) from public, anon;
grant execute on function public.create_invite_link(text, integer) to authenticated;

-- A shared code, for someone you can only reach by phone. Deliberately stingier than the
-- SQL-editor version: fewer uses, a shorter life, and only three alive at once per family,
-- because one code in a group chat is one code everybody has.
create or replace function public.create_access_code(
  p_label text,
  p_days integer default 30,
  p_max_uses integer default 5
)
returns table (id uuid, code text, expires_at timestamptz, max_uses integer, label text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := public.require_member();
  days integer := least(greatest(coalesce(p_days, 30), 1), 90);
  uses integer := least(greatest(coalesce(p_max_uses, 5), 1), 25);
  what text := nullif(btrim(coalesce(p_label, '')), '');
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/l: these get read aloud
  raw text := '';
  i integer;
  exp timestamptz;
  new_id uuid;
begin
  if what is null then
    raise exception 'Give the code a label so you know what it was for.' using errcode = 'PT400';
  end if;
  if char_length(what) > 60 then
    raise exception 'That label is too long.' using errcode = 'PT400';
  end if;

  -- Qualified for the same reason as in create_invite_link: id/label/expires_at/max_uses/code
  -- are OUT parameters of this function.
  if (select count(*) from public.access_codes k
        where k.created_by = me.id and k.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'That is three codes today. Try again tomorrow.' using errcode = 'PT429';
  end if;
  if (select count(*) from public.access_codes k
        where k.family_id = me.family_id and k.revoked_at is null and k.expires_at > now()
          and k.use_count < k.max_uses) >= 3 then
    raise exception 'Three codes are already live. Revoke one before making another.'
      using errcode = 'PT409';
  end if;

  for i in 1..16 loop
    raw := raw || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  raw := substr(raw,1,4)||'-'||substr(raw,5,4)||'-'||substr(raw,9,4)||'-'||substr(raw,13,4);

  exp := now() + make_interval(days => days);
  insert into public.access_codes (family_id, label, code_hash, expires_at, max_uses, created_by)
  values (me.family_id, what, extensions.crypt(raw, extensions.gen_salt('bf', 12)), exp, uses, me.id)
  returning access_codes.id into new_id;

  insert into public.access_attempts (email, outcome) values (me.email, 'minted_code');

  return query select new_id, raw, exp, uses, what;
end
$$;
revoke all on function public.create_access_code(text, integer, integer) from public, anon;
grant execute on function public.create_access_code(text, integer, integer) to authenticated;

-- ---------- seeing and revoking what your family handed out ----------

-- Everything the caller's family has minted, both kinds, without a hash in sight. `status` is
-- computed here so the browser cannot disagree with the database about what is still live.
create or replace function public.my_family_invites()
returns table (
  kind text,
  id uuid,
  label text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  used_at timestamptz,
  used_by_email text,
  use_count integer,
  max_uses integer,
  created_by_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select * from public.members where auth_user_id = (select auth.uid()))
  select 'invite'::text,
         l.id,
         l.label,
         case when l.revoked_at is not null then 'revoked'
              when l.used_at is not null then 'used'
              when l.expires_at <= now() then 'expired'
              else 'live' end,
         l.created_at, l.expires_at, l.revoked_at, l.used_at, l.used_by_email,
         null::integer, null::integer, c.name
    from public.invite_links l
    join me on me.family_id = l.family_id
    left join public.members c on c.id = l.created_by
  union all
  select 'code'::text,
         k.id,
         k.label,
         case when k.revoked_at is not null then 'revoked'
              when k.expires_at <= now() then 'expired'
              when k.use_count >= k.max_uses then 'used'
              else 'live' end,
         k.created_at, k.expires_at, k.revoked_at, null::timestamptz, null::text,
         k.use_count, k.max_uses, c.name
    from public.access_codes k
    join me on me.family_id = k.family_id
    left join public.members c on c.id = k.created_by
  order by 4, 5 desc;
$$;
revoke all on function public.my_family_invites() from public, anon;
grant execute on function public.my_family_invites() to authenticated;

-- Revoking is immediate and final. Scoped to the caller's family by the WHERE clause, so a
-- guessed id from another family simply matches nothing.
create or replace function public.revoke_family_invite(p_kind text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := public.require_member();
  hit integer;
begin
  if p_kind = 'invite' then
    update public.invite_links l set revoked_at = now()
      where l.id = p_id and l.family_id = me.family_id and l.revoked_at is null;
  elsif p_kind = 'code' then
    update public.access_codes k set revoked_at = now()
      where k.id = p_id and k.family_id = me.family_id and k.revoked_at is null;
  else
    raise exception 'Unknown kind.' using errcode = 'PT400';
  end if;
  get diagnostics hit = row_count;
  if hit = 0 then
    raise exception 'Nothing to revoke.' using errcode = 'PT404';
  end if;
  insert into public.access_attempts (email, outcome) values (me.email, 'revoked_invite');
  return true;
end
$$;
revoke all on function public.revoke_family_invite(text, uuid) from public, anon;
grant execute on function public.revoke_family_invite(text, uuid) to authenticated;
