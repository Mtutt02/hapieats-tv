-- Comments
create table public.comments (
  id          uuid primary key default uuid_generate_v4(),
  video_id    uuid not null references public.videos(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.comments for select using (true);

create policy "Authenticated users can comment"
  on public.comments for insert with check (auth.uid() = author_id);

create policy "Authors can update their own comments"
  on public.comments for update using (auth.uid() = author_id);

create policy "Authors can delete their own comments"
  on public.comments for delete using (auth.uid() = author_id);

create index idx_comments_video_id on public.comments(video_id);
create index idx_comments_author_id on public.comments(author_id);

-- Likes (one per user per video)
create table public.video_likes (
  id         uuid primary key default uuid_generate_v4(),
  video_id   uuid not null references public.videos(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(video_id, user_id)
);

alter table public.video_likes enable row level security;

create policy "Anyone can see like counts"
  on public.video_likes for select using (true);

create policy "Authenticated users can like"
  on public.video_likes for insert with check (auth.uid() = user_id);

create policy "Users can unlike"
  on public.video_likes for delete using (auth.uid() = user_id);

-- Add like_count column to videos
alter table public.videos add column if not exists like_count integer default 0;

-- Trigger to keep like_count in sync
create or replace function public.update_like_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.videos set like_count = like_count + 1 where id = new.video_id;
  elsif tg_op = 'DELETE' then
    update public.videos set like_count = greatest(like_count - 1, 0) where id = old.video_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_video_like_change
  after insert or delete on public.video_likes
  for each row execute procedure public.update_like_count();

-- Add comment_count column to videos
alter table public.videos add column if not exists comment_count integer default 0;

create or replace function public.update_comment_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.videos set comment_count = comment_count + 1 where id = new.video_id;
  elsif tg_op = 'DELETE' then
    update public.videos set comment_count = greatest(comment_count - 1, 0) where id = old.video_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_comment_change
  after insert or delete on public.comments
  for each row execute procedure public.update_comment_count();
