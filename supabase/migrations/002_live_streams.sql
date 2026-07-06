create table public.live_streams (
  id                  uuid primary key default uuid_generate_v4(),
  channel_id          uuid not null references public.channels(id) on delete cascade,
  creator_id          uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  description         text,
  mux_live_stream_id  text unique not null,
  mux_playback_id     text,
  stream_key          text not null,          -- kept secret, only shown to creator
  status              text not null default 'idle'
                        check (status in ('idle','active','ended')),
  viewer_count        integer default 0,
  started_at          timestamptz,
  ended_at            timestamptz,
  recording_asset_id  text,                   -- Mux asset ID after stream ends
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.live_streams enable row level security;

create policy "Live streams are viewable by everyone"
  on public.live_streams for select using (true);

create policy "Creators can manage their own live streams"
  on public.live_streams for all using (auth.uid() = creator_id);

create policy "Service role manages live streams"
  on public.live_streams for all using (auth.role() = 'service_role');

create index idx_live_streams_channel on public.live_streams(channel_id);
create index idx_live_streams_status on public.live_streams(status);
create index idx_live_streams_creator on public.live_streams(creator_id);
