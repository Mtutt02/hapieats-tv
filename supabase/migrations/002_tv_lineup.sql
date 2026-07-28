-- ──────────────────────────────────────────────────────────────────────────────
-- HapiEats TV — TV Lineup (fixed channel number assignments)
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists public.tv_lineup (
  id              uuid primary key default uuid_generate_v4(),
  channel_number  integer unique not null,        -- e.g. 6, 13, 99
  name            text not null,                  -- display name
  icon            text not null default '📺',     -- emoji
  description     text not null default '',
  category        text not null default 'General',
  -- Content source — at most one of these should be set
  channel_id      uuid references public.channels(id) on delete set null,
  mux_playback_id text,                           -- specific Mux asset/live stream ID
  video_url       text,                           -- external MP4 URL
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.tv_lineup enable row level security;

-- Everyone can read the lineup (needed for /tv page)
create policy "TV lineup readable by all"
  on public.tv_lineup for select using (true);

-- Only service role (server-side admin routes) can write
-- Admin API routes use the service client which bypasses RLS
