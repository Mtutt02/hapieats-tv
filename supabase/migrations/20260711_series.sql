-- ============================================================
-- HapiEats — Series (playlists under channels)
-- A channel can hold many series; videos can be added to a
-- series any time after creation, and a video can live in
-- multiple series. Additive & idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.series (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  creator_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  slug          TEXT,
  description   TEXT,
  thumbnail_url TEXT,
  is_public     BOOLEAN NOT NULL DEFAULT true,
  video_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_series_channel ON public.series (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_series_creator ON public.series (creator_id);

ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "series_public_read" ON public.series;
CREATE POLICY "series_public_read" ON public.series FOR SELECT USING (true);
DROP POLICY IF EXISTS "series_owner_write" ON public.series;
CREATE POLICY "series_owner_write" ON public.series FOR ALL
  USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- Ordered membership: a video's place inside a series.
CREATE TABLE IF NOT EXISTS public.series_videos (
  series_id  UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  video_id   UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (series_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_series_videos_series ON public.series_videos (series_id, position);
CREATE INDEX IF NOT EXISTS idx_series_videos_video ON public.series_videos (video_id);

ALTER TABLE public.series_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "series_videos_read" ON public.series_videos;
CREATE POLICY "series_videos_read" ON public.series_videos FOR SELECT USING (true);
DROP POLICY IF EXISTS "series_videos_owner" ON public.series_videos;
CREATE POLICY "series_videos_owner" ON public.series_videos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND s.creator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND s.creator_id = auth.uid()));

-- Keep series.video_count fresh.
CREATE OR REPLACE FUNCTION public.sync_series_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.series SET video_count = video_count + 1, updated_at = now() WHERE id = NEW.series_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.series SET video_count = GREATEST(0, video_count - 1), updated_at = now() WHERE id = OLD.series_id;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_sync_series_count ON public.series_videos;
CREATE TRIGGER trg_sync_series_count
  AFTER INSERT OR DELETE ON public.series_videos
  FOR EACH ROW EXECUTE FUNCTION public.sync_series_count();
