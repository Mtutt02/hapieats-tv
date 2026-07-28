-- ============================================================
-- HapiEats TV — Clips (vertical short-form video) + creator follows
-- Additive only. Clips reuse the videos table + Mux pipeline,
-- likes, comments, reports, and RLS that already exist.
-- ============================================================

-- 1. Clip flags on videos
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS is_clip        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clip_category  TEXT
    CHECK (clip_category IS NULL OR clip_category IN
      ('food','lifestyle','travel','wellness','fitness','entertainment','other'));

CREATE INDEX IF NOT EXISTS idx_videos_clips
  ON public.videos (is_clip, created_at DESC)
  WHERE is_clip = true;

-- 2. Creator follows (user → creator), powers the Following feed
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

-- 3. Denormalized follower count on profiles (kept fresh by trigger)
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
