-- ═══════════════════════════════════════════════════════════════════════════
-- Munchor SSO — sign in to HapiEats TV with a Munchor account
--
-- Munchor runs on a SEPARATE Supabase project, so there is no shared auth
-- schema. HapiEats verifies the caller against Munchor server-side, then keeps
-- its own mapping from a Munchor user id to a HapiEats user id.
--
-- Additive only: CREATE ... IF NOT EXISTS throughout, no destructive DDL.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Established links ──────────────────────────────────────────────────────
-- One HapiEats account maps to at most one Munchor account and vice versa.
create table if not exists public.munchor_identities (
  hapieats_user_id  uuid primary key references auth.users(id) on delete cascade,
  munchor_user_id   uuid        not null unique,
  munchor_email     text        not null,
  linked_at         timestamptz not null default now(),
  last_login_at     timestamptz
);

create index if not exists munchor_identities_munchor_user_id_idx
  on public.munchor_identities (munchor_user_id);

create index if not exists munchor_identities_munchor_email_idx
  on public.munchor_identities (lower(munchor_email));

comment on table public.munchor_identities is
  'Links a HapiEats auth user to a Munchor auth user (separate Supabase project). Written only by the service role via /api/auth/munchor/*.';

-- ── Pending link confirmations ─────────────────────────────────────────────
-- When a Munchor sign-in matches an EXISTING HapiEats account by email we do
-- not merge on the spot — that would let anyone who controls a Munchor account
-- with a given email take over the HapiEats account of the same address.
-- Instead we park the request here and require the user to prove they own the
-- address by clicking a magic link sent to it.
--
-- Only the SHA-256 hash of the token is stored, so a leaked table dump cannot
-- be replayed to complete a link.
create table if not exists public.munchor_link_requests (
  token_hash        text        primary key,
  hapieats_user_id  uuid        not null references auth.users(id) on delete cascade,
  munchor_user_id   uuid        not null,
  munchor_email     text        not null,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  consumed_at       timestamptz
);

create index if not exists munchor_link_requests_user_idx
  on public.munchor_link_requests (hapieats_user_id);

create index if not exists munchor_link_requests_expiry_idx
  on public.munchor_link_requests (expires_at)
  where consumed_at is null;

comment on table public.munchor_link_requests is
  'Short-lived, single-use tokens for confirming a Munchor <-> HapiEats account link. Stores only the SHA-256 hash of each token.';

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Both tables are service-role only. RLS is enabled with NO permissive policy
-- for anon/authenticated, so the anon key cannot read or write either table.
-- The service role bypasses RLS by design.
alter table public.munchor_identities    enable row level security;
alter table public.munchor_link_requests enable row level security;

-- A user may see (but never modify) their own link, so the settings page can
-- show "Connected to Munchor as ...".
drop policy if exists munchor_identities_select_own on public.munchor_identities;
create policy munchor_identities_select_own
  on public.munchor_identities
  for select
  using (auth.uid() = hapieats_user_id);

-- ── Housekeeping ───────────────────────────────────────────────────────────
-- Expired, unconsumed requests are dead weight. Safe to call any time.
create or replace function public.purge_expired_munchor_link_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.munchor_link_requests
   where consumed_at is null
     and expires_at < now() - interval '1 day';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_expired_munchor_link_requests() from public, anon, authenticated;

-- ── Email → user id lookup ─────────────────────────────────────────────────
-- public.profiles has no email column (see 001_initial.sql and the
-- handle_new_user trigger), so auth.users is the only authoritative place to
-- resolve an address. auth.users is not reachable through PostgREST, hence
-- this SECURITY DEFINER helper.
--
-- Case-insensitive exact match — NOT `like`, because `_` and `%` are legal in
-- an email local-part and would otherwise behave as wildcards and resolve to
-- the wrong account.
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select u.id
    from auth.users u
   where lower(u.email) = lower(p_email)
   order by u.created_at asc
   limit 1;
$$;

-- Service role only. The anon/authenticated roles must never be able to probe
-- which email addresses have accounts.
revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
