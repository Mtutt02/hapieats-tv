-- ============================================================
-- HapiEats TV — Editor Edit Metadata
-- Store editor edits (overlays, filters, music, voiceover) so
-- they can be rendered client-side during playback.
-- ============================================================

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS edit_overlays       TEXT,     -- JSON stringified Overlay[]
  ADD COLUMN IF NOT EXISTS edit_music_track    TEXT,     -- track ID or file ref
  ADD COLUMN IF NOT EXISTS edit_filters        TEXT,     -- JSON stringified FilterSettings
  ADD COLUMN IF NOT EXISTS edit_voiceover_url  TEXT;     -- base64 data URL or storage URL
