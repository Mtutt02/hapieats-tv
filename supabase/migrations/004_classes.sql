-- ── Classes ─────────────────────────────────────────────────────────────────
create table public.classes (
  id               uuid primary key default uuid_generate_v4(),
  instructor_id    uuid not null references public.profiles(id) on delete cascade,
  channel_id       uuid not null references public.channels(id) on delete cascade,
  title            text not null check (char_length(title) between 3 and 120),
  description      text check (char_length(description) <= 2000),
  category         text not null default 'general'
                     check (category in ('baking','cooking','pastry','grilling','international','vegan','nutrition','general')),
  skill_level      text not null default 'beginner'
                     check (skill_level in ('beginner','intermediate','advanced','all-levels')),
  type             text not null default 'recorded'
                     check (type in ('live','recorded','series')),
  price            numeric(10,2) not null default 0,
  stripe_price_id  text,
  max_students     integer,          -- null = unlimited
  scheduled_at     timestamptz,      -- for live classes
  live_stream_id   uuid references public.live_streams(id) on delete set null,
  thumbnail_url    text,
  is_published     boolean default false,
  enrollment_count integer default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table public.classes enable row level security;

create policy "Published classes are viewable by everyone"
  on public.classes for select
  using (is_published = true);

create policy "Instructors see all their classes"
  on public.classes for select
  using (auth.uid() = instructor_id);

create policy "Instructors can manage their own classes"
  on public.classes for all
  using (auth.uid() = instructor_id);

-- ── Class Lessons ────────────────────────────────────────────────────────────
create table public.class_lessons (
  id              uuid primary key default uuid_generate_v4(),
  class_id        uuid not null references public.classes(id) on delete cascade,
  title           text not null check (char_length(title) between 2 and 120),
  description     text,
  video_id        uuid references public.videos(id) on delete set null,
  order_index     integer not null default 0,
  is_free_preview boolean default false,
  duration        integer,   -- seconds, cached from video
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.class_lessons enable row level security;

create policy "Anyone can see free preview lessons"
  on public.class_lessons for select
  using (is_free_preview = true);

create policy "Enrolled users can see all lessons"
  on public.class_lessons for select
  using (
    exists (
      select 1 from public.class_enrollments e
      where e.class_id = class_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );

create policy "Instructors can see all their lessons"
  on public.class_lessons for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_id and c.instructor_id = auth.uid()
    )
  );

create policy "Instructors can manage their lessons"
  on public.class_lessons for all
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_id and c.instructor_id = auth.uid()
    )
  );

-- ── Class Enrollments ────────────────────────────────────────────────────────
create table public.class_enrollments (
  id                       uuid primary key default uuid_generate_v4(),
  class_id                 uuid not null references public.classes(id) on delete cascade,
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  stripe_payment_intent_id text,
  status                   text not null default 'active'
                             check (status in ('active','canceled','refunded')),
  progress_lesson_id       uuid references public.class_lessons(id) on delete set null,
  enrolled_at              timestamptz default now(),
  unique(class_id, user_id)
);

alter table public.class_enrollments enable row level security;

create policy "Users see their own enrollments"
  on public.class_enrollments for select
  using (auth.uid() = user_id);

create policy "Users can enroll themselves"
  on public.class_enrollments for insert
  with check (auth.uid() = user_id);

create policy "Instructors see enrollments for their classes"
  on public.class_enrollments for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_id and c.instructor_id = auth.uid()
    )
  );

create policy "Service role manages enrollments"
  on public.class_enrollments for all
  using (auth.role() = 'service_role');

-- ── Triggers ──────────────────────────────────────────────────────────────────

create trigger set_classes_updated_at before update on public.classes
  for each row execute procedure public.set_updated_at();

create trigger set_class_lessons_updated_at before update on public.class_lessons
  for each row execute procedure public.set_updated_at();

-- Increment enrollment count
create or replace function public.update_enrollment_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.classes set enrollment_count = enrollment_count + 1 where id = new.class_id;
  elsif tg_op = 'DELETE' then
    update public.classes set enrollment_count = greatest(0, enrollment_count - 1) where id = old.class_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_enrollment_change
  after insert or delete on public.class_enrollments
  for each row execute procedure public.update_enrollment_count();

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index idx_classes_instructor on public.classes(instructor_id);
create index idx_classes_channel on public.classes(channel_id);
create index idx_classes_type on public.classes(type);
create index idx_classes_category on public.classes(category);
create index idx_classes_published on public.classes(is_published);
create index idx_class_lessons_class on public.class_lessons(class_id, order_index);
create index idx_enrollments_user on public.class_enrollments(user_id);
create index idx_enrollments_class on public.class_enrollments(class_id);
