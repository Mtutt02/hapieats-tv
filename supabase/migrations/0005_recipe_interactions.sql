-- Migration 0005: Recipe interactions + flavor profile + creator goals
-- Supports interactive recipe features and profile v3

-- Track user progress through interactive recipes
create table if not exists recipe_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  servings integer not null default 4,
  checked_ingredients text[] not null default '{}',
  current_step integer not null default 1,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, video_id)
);
create index if not exists idx_recipe_interactions_user on recipe_interactions(user_id);

-- Add flavor_profile jsonb column to profiles for the HapiEats DNA card
alter table profiles add column if not exists flavor_profile jsonb;

-- Add streak_count to profiles for the streak flame indicator
alter table profiles add column if not exists streak_count integer default 0;

-- Creator goals table (tips, equipment funds, etc.)
create table if not exists creator_goals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  category text, -- 'equipment', 'trip', 'community', 'other'
  current_amount integer not null default 0,
  target_amount integer not null,
  reward text, -- what backers get
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_creator_goals_creator on creator_goals(creator_id);
