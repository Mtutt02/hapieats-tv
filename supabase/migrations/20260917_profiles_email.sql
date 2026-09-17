-- ═══════════════════════════════════════════════════════════════════════════
-- profiles.email — reconcile the schema with what the code already assumes
--
-- Several code paths read or write public.profiles.email:
--   • app/auth/callback/route.ts          inserts it on the fallback path
--   • app/api/admin/users/lookup/route.ts SELECTs and filters on it
--
-- but no migration ever creates the column: 001_initial.sql does not define it
-- and handle_new_user() never populates it. Either it was added by hand in the
-- dashboard (in which case this migration is a harmless no-op) or it is genuinely
-- missing, in which case admin user lookup fails on every call and the
-- /auth/callback fallback insert silently errors with 42703.
--
-- This migration makes the schema match the code either way. Additive and
-- idempotent — safe to run repeatedly, and safe whichever turned out to be true.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── The column ─────────────────────────────────────────────────────────────
-- Nullable with no default, so adding it does not rewrite the table.
alter table public.profiles add column if not exists email text;

comment on column public.profiles.email is
  'Mirror of auth.users.email, kept for lookups that cannot reach the auth schema through PostgREST. auth.users remains the source of truth.';

-- ── Backfill ───────────────────────────────────────────────────────────────
-- Only touches rows that have no email yet, so re-running is a no-op and an
-- address someone deliberately changed is never overwritten.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is null
   and u.email is not null;

-- ── Keep it populated going forward ────────────────────────────────────────
-- handle_new_user() previously wrote only id/username/display_name/avatar_url,
-- so every account created through the trigger had a null email. Same behaviour
-- as before in every other respect — the username fallback chain is unchanged.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    new.email
  );
  return new;
end;
$$;

-- ── Lookup index ───────────────────────────────────────────────────────────
-- Admin user lookup matches on email. Indexed on lower(email) so the query can
-- be case-insensitive without a sequential scan — addresses are case-insensitive
-- in practice, and the stored casing is whatever the user typed at signup.
create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));
