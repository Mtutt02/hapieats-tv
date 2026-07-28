-- ============================================================
-- HapiEats TV — Fix Upload Schema
-- 1. Make channel_id nullable on videos (general posts have no channel)
-- 2. Add clip_start / clip_end for future clipping feature
-- ============================================================

-- 1. Make channel_id nullable so general posts can be created without a channel
ALTER TABLE public.videos ALTER COLUMN channel_id DROP NOT NULL;

-- 2. Add clip columns (nullable, for future clipping feature)
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS clip_start NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS clip_end   NUMERIC(10,3);
