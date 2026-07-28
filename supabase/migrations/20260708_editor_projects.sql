-- ============================================================
-- HapiEats TV Studio — Editor Projects (cloud sync)
-- ============================================================

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
