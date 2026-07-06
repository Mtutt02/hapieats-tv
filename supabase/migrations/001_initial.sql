-- ──────────────────────────────────────────────────────────────────────────────
-- HapiEats TV — Initial Schema
-- Run via: supabase db push
-- ──────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Profiles (extends auth.users) ──────────────────────────────────────────
create table public.profiles (
  id                           uuid primary key references auth.users(id) on delete cascade,
  username                     text unique not null,
  display_name                 text,
  bio                          text,
  avatar_url                   text,
  banner_url                   text,
  is_creator                   boolean default false,
  stripe_account_id            text,       -- Stripe Connect express account
  stripe_customer_id           text,       -- Stripe customer for platform sub
  platform_subscription_id     text,       -- Stripe subscription ID
  platform_subscription_status text,       -- active | canceled | etc.
  created_at                   timestamptz default now(),
  updated_at                   timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- ── Channels ───────────────────────────────────────────────────────────────
create table public.channels (
  id                 uuid primary key default uuid_generate_v4(),
  creator_id         uuid not null references public.profiles(id) on delete cascade,
  name               text not null,
  slug               text unique not null,
  description        text,
  thumbnail_url      text,
  stripe_price_id    text,           -- price for channel subscription
  subscription_price numeric(10,2),  -- display price in USD
  subscriber_count   integer default 0,
  video_count        integer default 0,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

alter table public.channels enable row level security;

create policy "Channels are viewable by everyone"
  on public.channels for select using (true);

create policy "Creators can manage their own channel"
  on public.channels for all using (auth.uid() = creator_id);

-- ── Videos ─────────────────────────────────────────────────────────────────
create table public.videos (
  id               uuid primary key default uuid_generate_v4(),
  channel_id       uuid not null references public.channels(id) on delete cascade,
  creator_id       uuid not null references public.profiles(id) on delete cascade,
  title            text not null,
  description      text,
  mux_asset_id     text,
  mux_playback_id  text,
  mux_upload_id    text,
  thumbnail_url    text,
  duration         integer,          -- seconds
  status           text not null default 'uploading'
                     check (status in ('uploading','processing','ready','errored')),
  visibility       text not null default 'private'
                     check (visibility in ('public','private','unlisted')),
  pricing_model    text not null default 'free'
                     check (pricing_model in ('free','pay_per_view','subscription')),
  price            numeric(10,2),
  stripe_price_id  text,
  view_count       integer default 0,
  published_at     timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table public.videos enable row level security;

-- Creators can see all their own videos; everyone can see public ready videos
create policy "Creators see all their videos"
  on public.videos for select
  using (auth.uid() = creator_id);

create policy "Anyone can see public ready videos"
  on public.videos for select
  using (status = 'ready' and visibility = 'public');

create policy "Creators can manage their own videos"
  on public.videos for all
  using (auth.uid() = creator_id);

-- ── Channel Subscriptions ──────────────────────────────────────────────────
create table public.subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  subscriber_id           uuid not null references public.profiles(id) on delete cascade,
  channel_id              uuid not null references public.channels(id) on delete cascade,
  stripe_subscription_id  text unique not null,
  status                  text not null default 'active'
                            check (status in ('active','canceled','past_due','trialing')),
  current_period_end      timestamptz,
  created_at              timestamptz default now(),
  unique(subscriber_id, channel_id)
);

alter table public.subscriptions enable row level security;

create policy "Users see their own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = subscriber_id);

create policy "Service role manages subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- ── Pay-per-view Purchases ─────────────────────────────────────────────────
create table public.purchases (
  id                        uuid primary key default uuid_generate_v4(),
  buyer_id                  uuid not null references public.profiles(id) on delete cascade,
  video_id                  uuid not null references public.videos(id) on delete cascade,
  stripe_payment_intent_id  text unique not null,
  amount                    integer not null,  -- in cents
  created_at                timestamptz default now(),
  unique(buyer_id, video_id)
);

alter table public.purchases enable row level security;

create policy "Users see their own purchases"
  on public.purchases for select
  using (auth.uid() = buyer_id);

create policy "Service role manages purchases"
  on public.purchases for all
  using (auth.role() = 'service_role');

-- ── Video Views ────────────────────────────────────────────────────────────
create table public.video_views (
  id         uuid primary key default uuid_generate_v4(),
  video_id   uuid not null references public.videos(id) on delete cascade,
  viewer_id  uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.video_views enable row level security;

create policy "Anyone can insert a view"
  on public.video_views for insert with check (true);

create policy "Creators see views on their videos"
  on public.video_views for select
  using (
    exists (
      select 1 from public.videos v
      where v.id = video_id and v.creator_id = auth.uid()
    )
  );

-- ── Functions & Triggers ───────────────────────────────────────────────────

-- Auto-create profile on signup
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update updated_at timestamps
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_channels_updated_at before update on public.channels
  for each row execute procedure public.set_updated_at();

create trigger set_videos_updated_at before update on public.videos
  for each row execute procedure public.set_updated_at();

-- Increment view count when a view is inserted
create or replace function public.increment_view_count()
returns trigger language plpgsql security definer as $$
begin
  update public.videos set view_count = view_count + 1 where id = new.video_id;
  return new;
end;
$$;

create trigger on_view_inserted
  after insert on public.video_views
  for each row execute procedure public.increment_view_count();

-- Increment/decrement channel subscriber count
create or replace function public.update_subscriber_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.channels set subscriber_count = subscriber_count + 1
    where id = new.channel_id;
  elsif tg_op = 'DELETE' then
    update public.channels set subscriber_count = subscriber_count - 1
    where id = old.channel_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_subscription_change
  after insert or delete on public.subscriptions
  for each row execute procedure public.update_subscriber_count();

-- ── Indexes ────────────────────────────────────────────────────────────────
create index idx_videos_channel_id on public.videos(channel_id);
create index idx_videos_creator_id on public.videos(creator_id);
create index idx_videos_status_visibility on public.videos(status, visibility);
create index idx_subscriptions_subscriber on public.subscriptions(subscriber_id);
create index idx_subscriptions_channel on public.subscriptions(channel_id);
create index idx_purchases_buyer on public.purchases(buyer_id);
create index idx_purchases_video on public.purchases(video_id);
create index idx_video_views_video on public.video_views(video_id);
