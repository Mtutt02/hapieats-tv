-- ═══════════════════════════════════════════════════════════════════════════
-- Tests for 20260831_munchor_sso.sql
--
-- Runs against a scratch Postgres — NEVER against a real project. It creates
-- Supabase-shaped scaffolding (auth.users, auth.uid(), the profiles shape and
-- handle_new_user trigger from 001_initial.sql) so the migration can be
-- exercised the way it will actually behave in production.
--
--   createdb -h /tmp -p 55432 -U postgres munchor_test
--   psql -h /tmp -p 55432 -U postgres -d munchor_test \
--        -v ON_ERROR_STOP=1 -f supabase/tests/munchor_sso_test.sql
--
-- Every check is an ASSERT: the script is silent on success and aborts loudly
-- on failure, so it is usable as a CI gate.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- ── Scaffolding ────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  email_confirmed_at timestamptz,
  created_at         timestamptz default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- profiles as it actually exists (001_initial.sql + the role column added by
-- 20260701_chef_verification.sql). Note there is NO email column — that is the
-- whole reason find_user_id_by_email() has to go through auth.users.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  role         text not null default 'user',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Apply the migration under test (twice — it must be idempotent) ─────────
\ir ../migrations/20260831_munchor_sso.sql
\ir ../migrations/20260831_munchor_sso.sql

-- ── Fixtures ───────────────────────────────────────────────────────────────
insert into auth.users (email, raw_user_meta_data) values
  ('Jane@Example.com', '{"username":"jane"}'),
  ('aXb@example.com',  '{"username":"axb"}')
on conflict (email) do nothing;

-- ── find_user_id_by_email ──────────────────────────────────────────────────
do $$
declare jane uuid;
begin
  select id into jane from auth.users where email = 'Jane@Example.com';

  assert public.find_user_id_by_email('Jane@Example.com') = jane,
    'exact match failed';

  assert public.find_user_id_by_email('JANE@EXAMPLE.COM') = jane,
    'match should be case-insensitive';

  assert public.find_user_id_by_email('nobody@example.com') is null,
    'unknown address must return null';

  -- The regression this function exists to prevent: `_` and `%` are legal in
  -- an email local-part, so a LIKE-based lookup would treat 'a_b@example.com'
  -- as a wildcard and resolve to 'aXb@example.com' — a different person.
  assert public.find_user_id_by_email('a_b@example.com') is null,
    'underscore must NOT behave as a wildcard';
end $$;

-- ── Username collision aborts account creation ─────────────────────────────
-- Not a nicety: profiles.username is UNIQUE and handle_new_user runs inside
-- the auth.users INSERT, so a collision rolls back the whole createUser call.
-- This is why the login route resolves a free username before creating a user.
do $$
declare failed boolean := false;
begin
  begin
    -- No metadata username, so the trigger falls back to split_part -> 'jane',
    -- which is taken.
    insert into auth.users (email) values ('jane@other-domain.com');
  exception when unique_violation then
    failed := true;
  end;
  assert failed, 'expected a username collision to abort user creation';
end $$;

do $$ begin
  -- Same address, but with a pre-resolved unique username: must succeed.
  insert into auth.users (email, raw_user_meta_data)
    values ('jane@other-domain.com', '{"username":"jane2"}');
  assert exists (select 1 from public.profiles where username = 'jane2'),
    'pre-resolved username should let creation succeed';
end $$;

-- ── Single-use link tokens ─────────────────────────────────────────────────
do $$
declare jane uuid; first_claim text; second_claim text;
begin
  select id into jane from auth.users where email = 'Jane@Example.com';

  insert into public.munchor_link_requests
    (token_hash, hapieats_user_id, munchor_user_id, munchor_email, expires_at)
  values ('test_token', jane, gen_random_uuid(), 'jane@example.com', now() + interval '30 min');

  -- The conditional claim used by /api/auth/munchor/confirm. Two concurrent
  -- clicks must not both succeed.
  update public.munchor_link_requests set consumed_at = now()
   where token_hash = 'test_token' and consumed_at is null
  returning token_hash into first_claim;

  update public.munchor_link_requests set consumed_at = now()
   where token_hash = 'test_token' and consumed_at is null
  returning token_hash into second_claim;

  assert first_claim = 'test_token', 'first claim should win';
  assert second_claim is null,       'second claim must be rejected';
end $$;

-- ── Expiry ─────────────────────────────────────────────────────────────────
do $$
declare jane uuid;
begin
  select id into jane from auth.users where email = 'Jane@Example.com';

  insert into public.munchor_link_requests
    (token_hash, hapieats_user_id, munchor_user_id, munchor_email, expires_at)
  values ('expired_token', jane, gen_random_uuid(), 'jane@example.com', now() - interval '1 min');

  assert not exists (
    select 1 from public.munchor_link_requests
     where token_hash = 'expired_token' and consumed_at is null and expires_at > now()
  ), 'an expired token must not be usable';
end $$;

-- ── RLS keeps the anon key out ─────────────────────────────────────────────
do $$
declare jane uuid; visible integer;
begin
  select id into jane from auth.users where email = 'Jane@Example.com';
  insert into public.munchor_identities (hapieats_user_id, munchor_user_id, munchor_email)
    values (jane, gen_random_uuid(), 'jane@example.com')
  on conflict do nothing;

  grant usage on schema public to anon;
  grant select, insert, update, delete
    on public.munchor_identities, public.munchor_link_requests to anon;

  set local role anon;
  select count(*) into visible from public.munchor_identities;
  assert visible = 0, 'anon must not read link rows without a matching auth.uid()';

  select count(*) into visible from public.munchor_link_requests;
  assert visible = 0, 'anon must never read link requests';
  reset role;
end $$;

-- anon must not be able to probe which addresses have accounts
do $$
declare denied boolean := false;
begin
  set local role anon;
  begin
    perform public.find_user_id_by_email('Jane@Example.com');
  exception when insufficient_privilege then
    denied := true;
  end;
  reset role;
  assert denied, 'anon must not be able to call find_user_id_by_email';
end $$;

select 'All Munchor SSO migration tests passed.' as result;
