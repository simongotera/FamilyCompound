-- Tests for 20261113160000_invites_from_the_app.sql.
--
-- Paste the whole file into the Supabase SQL editor and run it. It wraps itself in a transaction
-- and rolls back, so it mints real invitations, proves they work, and leaves nothing behind.
-- It raises on the first failure; reaching 'all tests passed' means every assertion held.
--
-- The important trick: the member-facing calls run under `set local role authenticated` with a
-- forged request.jwt.claims, so they go through exactly the privileges a browser has. Anything
-- a browser is NOT allowed to do (reading a hash, calling verify_*) is asserted from the admin
-- role instead — and test 4 proves a member really is refused.

begin;

do $t$
declare
  me record; inv record; cod record;
  n integer; got text; i integer;
begin
  select m.id, m.auth_user_id, m.email, m.family_id into me
    from public.members m order by m.created_at limit 1;
  if me.id is null then raise exception 'No member to impersonate.'; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', me.auth_user_id, 'role', 'authenticated', 'email', me.email)::text, true);
  set local role authenticated;

  -- 0. require_member() is internal: a member cannot call it, but the functions that call it
  --    from the inside still work, because those run as the owner.
  begin
    perform public.require_member();
    raise exception 'FAIL require_member is callable by a member';
  exception when insufficient_privilege then null;
  end;

  -- 1. a per-person invite: 24 random bytes, hex, expiring when asked
  select * into inv from public.create_invite_link('Aunt Rosa', 14);
  if inv.token is null or inv.token !~ '^[0-9a-f]{48}$' then
    raise exception 'FAIL token shape: %', inv.token;
  end if;
  if inv.expires_at::date <> (now() + interval '14 days')::date then
    raise exception 'FAIL invite expiry %', inv.expires_at;
  end if;

  -- 2. a shared code, with the app's caps clamping absurd input
  select * into cod from public.create_access_code('Phone calls', 999, 9999);
  if cod.code !~ '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$' then
    raise exception 'FAIL code shape: %', cod.code;
  end if;
  if cod.max_uses <> 25 then raise exception 'FAIL max_uses not clamped: %', cod.max_uses; end if;
  if cod.expires_at::date <> (now() + interval '90 days')::date then
    raise exception 'FAIL days not clamped: %', cod.expires_at;
  end if;

  -- 3. both show up in the listing, attributed, and live
  select count(*) into n from public.my_family_invites() v where v.created_by_name is not null;
  if n < 2 then raise exception 'FAIL listing missing attributed rows (got %)', n; end if;
  select count(*) into n from public.my_family_invites() v where v.id = cod.id and v.status = 'live';
  if n <> 1 then raise exception 'FAIL fresh code not live'; end if;
  select count(*) into n from public.my_family_invites() v where v.id = inv.id and v.status = 'live';
  if n <> 1 then raise exception 'FAIL fresh invite not live'; end if;

  -- 4. a member cannot reach the hash, which is the whole point of the design
  begin
    select l.token_hash into got from public.invite_links l where l.id = inv.id;
    raise exception 'FAIL a member can read invite_links directly';
  exception when insufficient_privilege then null;
  end;

  reset role;

  -- 5. only a hash was stored, at bcrypt cost 12
  select l.token_hash into got from public.invite_links l where l.id = inv.id;
  if got = inv.token then raise exception 'FAIL plaintext token stored'; end if;
  if got !~ '^\$2[aby]\$12\$' then raise exception 'FAIL not bcrypt cost 12: %', got; end if;

  -- 6. the gate accepts what the app minted, into the right family
  if public.verify_access_code(cod.code) is distinct from me.family_id then
    raise exception 'FAIL new code does not verify into the right family';
  end if;
  if public.verify_invite_token(inv.token, 'rosa@example.com') is distinct from me.family_id then
    raise exception 'FAIL new invite token does not verify';
  end if;

  set local role authenticated;

  -- 7. and the listing now says who claimed it
  select count(*) into n from public.my_family_invites() v
    where v.id = inv.id and v.status = 'used' and v.used_by_email = 'rosa@example.com';
  if n <> 1 then raise exception 'FAIL claimed invite not shown as used'; end if;

  -- 8. revoking: once, and only within your own family
  perform public.revoke_family_invite('code', cod.id);
  select count(*) into n from public.my_family_invites() v where v.id = cod.id and v.status = 'revoked';
  if n <> 1 then raise exception 'FAIL code not revoked'; end if;
  begin
    perform public.revoke_family_invite('code', cod.id);
    raise exception 'FAIL double revoke accepted';
  exception when sqlstate 'PT404' then null;
  end;
  begin
    perform public.revoke_family_invite('code', gen_random_uuid());
    raise exception 'FAIL revoking an unknown id accepted';
  exception when sqlstate 'PT404' then null;
  end;

  -- 9. a blank label is refused rather than silently stored
  begin
    perform public.create_invite_link('   ', 10);
    raise exception 'FAIL blank label accepted';
  exception when sqlstate 'PT400' then null;
  end;

  -- 10. the per-member daily caps bite
  for i in 2..10 loop
    perform public.create_invite_link('Relative ' || i, 7);
  end loop;
  begin
    perform public.create_invite_link('One too many', 7);
    raise exception 'FAIL daily invite cap did not bite';
  exception when sqlstate 'PT429' then null;
  end;

  perform public.create_access_code('Second', 7, 2);
  perform public.create_access_code('Third', 7, 2);
  begin
    perform public.create_access_code('Fourth', 7, 2);
    raise exception 'FAIL code cap did not bite';
  exception when sqlstate 'PT429' then null;
  end;

  reset role;
  raise notice 'functional tests passed';
end
$t$;

-- 11. the privilege surface has not widened: no new table reads, no anon execute, and the
--     SQL-editor-only minters are still out of the browser's reach.
do $t$
declare
  leaked text;
begin
  select string_agg(format('%s:%s:%s', table_name, grantee, privilege_type), ', ') into leaked
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('invite_links','access_codes','access_attempts','allowed_emails','invites')
     and grantee in ('anon','authenticated');
  if leaked is not null then raise exception 'FAIL table privileges leaked: %', leaked; end if;

  select string_agg(p.proname, ', ') into leaked
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('create_invite_link','create_access_code','my_family_invites',
                       'revoke_family_invite','require_member')
     and has_function_privilege('anon', p.oid, 'execute');
  if leaked is not null then raise exception 'FAIL anon can execute: %', leaked; end if;

  select string_agg(p.proname, ', ') into leaked
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('create_invite_link','create_access_code','my_family_invites','revoke_family_invite')
     and not has_function_privilege('authenticated', p.oid, 'execute');
  if leaked is not null then raise exception 'FAIL members cannot execute: %', leaked; end if;

  -- the SQL-editor minters, and the internal helper, stay out of the browser's reach
  select string_agg(p.proname, ', ') into leaked
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('mint_access_code','mint_invite_link','require_member')
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'));
  if leaked is not null then raise exception 'FAIL internal functions exposed: %', leaked; end if;

  raise notice 'privilege tests passed';
end
$t$;

select 'all tests passed' as result;

rollback;
