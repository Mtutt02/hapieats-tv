-- ============================================================
-- HapiEats TV — User blocking + chat/user reporting (additive)
-- ============================================================

-- Block list
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

-- Extend content_reports to cover chat messages and user profiles
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS chat_message_id   UUID,
  ADD COLUMN IF NOT EXISTS reported_user_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
