-- ============================================================
-- HapiEats TV — ALL PENDING MIGRATIONS (idempotent, run once)
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Covers: editor metadata columns (fixes upload errors),
-- editor projects, user blocks + chat reports, Clips + follows.
-- ============================================================

-- ── 1. Editor edit-metadata columns on videos ──
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS edit_overlays       TEXT,
  ADD COLUMN IF NOT EXISTS edit_music_track    TEXT,
  ADD COLUMN IF NOT EXISTS edit_filters        TEXT,
  ADD COLUMN IF NOT EXISTS edit_voiceover_url  TEXT;

-- ── 2. Studio editor cloud-synced projects ──
CREATE TABLE IF NOT EXISTS public.editor_projects (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled project',
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS editor_projects_user_idx
  ON public.editor_projects (user_id, updated_at DESC);
ALTER TABLE public.editor_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "editor_projects_own" ON public.editor_projects;
CREATE POLICY "editor_projects_own" ON public.editor_projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 3. User blocking + chat/user reports ──
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_blocks_own" ON public.user_blocks;
CREATE POLICY "user_blocks_own" ON public.user_blocks
  FOR ALL USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON public.user_blocks (blocker_id);

ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS chat_message_id   UUID,
  ADD COLUMN IF NOT EXISTS reported_user_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── 4. Clips + creator follows ──
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS is_clip        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clip_category  TEXT
    CHECK (clip_category IS NULL OR clip_category IN
      ('food','lifestyle','travel','wellness','fitness','entertainment','other'));
CREATE INDEX IF NOT EXISTS idx_videos_clips
  ON public.videos (is_clip, created_at DESC)
  WHERE is_clip = true;

CREATE TABLE IF NOT EXISTS public.creator_follows (
  follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, creator_id),
  CHECK (follower_id <> creator_id)
);
ALTER TABLE public.creator_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "creator_follows_public_read" ON public.creator_follows;
CREATE POLICY "creator_follows_public_read" ON public.creator_follows
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "creator_follows_own_write" ON public.creator_follows;
CREATE POLICY "creator_follows_own_write" ON public.creator_follows
  FOR ALL USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);
CREATE INDEX IF NOT EXISTS idx_creator_follows_creator ON public.creator_follows (creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_follows_follower ON public.creator_follows (follower_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS follower_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sync_follower_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET follower_count = follower_count + 1 WHERE id = NEW.creator_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.creator_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_follower_count ON public.creator_follows;
CREATE TRIGGER trg_sync_follower_count
  AFTER INSERT OR DELETE ON public.creator_follows
  FOR EACH ROW EXECUTE FUNCTION public.sync_follower_count();
