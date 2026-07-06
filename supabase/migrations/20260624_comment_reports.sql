-- ── Add comment_id to content_reports + fix video visibility ──────────────────

-- 1. Add comment_id column to content_reports
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_content_reports_comment ON public.content_reports(comment_id);

-- 2. Fix seeded videos: set visibility=public and published_at for all ready videos
--    that are still private (default). This makes them watchable by anonymous users.
UPDATE public.videos
SET
  visibility   = 'public',
  published_at = COALESCE(published_at, NOW())
WHERE status = 'ready'
  AND visibility = 'private';

-- Done
SELECT 'comment_reports migration complete' AS status;
