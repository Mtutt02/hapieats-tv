-- ============================================================
-- P0 #834 hardening: Studio project ownership + Mux upload abuse
-- HELD FOR KENNEDY: written, reviewed, NOT applied to any database.
-- Idempotent. The app code works without it (ledger fails open); apply before relying on DB-level limits.
-- ============================================================

-- 1) editor_projects: ownership enforced by the database, not only by route code.
--    (RLS + policy editor_projects_own already exist from 20260708_editor_projects.sql.)
ALTER TABLE public.editor_projects FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.editor_projects FROM anon;

-- A row can never be reassigned to another account, whoever issues the UPDATE.
CREATE OR REPLACE FUNCTION public.editor_projects_lock_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'editor_projects.user_id is immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS editor_projects_lock_owner ON public.editor_projects;
CREATE TRIGGER editor_projects_lock_owner
  BEFORE UPDATE ON public.editor_projects
  FOR EACH ROW EXECUTE FUNCTION public.editor_projects_lock_owner();

-- 2) Ledger of Mux direct-upload URLs issued per creator (distributed hourly quota).
CREATE TABLE IF NOT EXISTS public.mux_upload_requests (
  upload_id   TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mux_upload_requests_user_idx
  ON public.mux_upload_requests (user_id, created_at DESC);

-- Written and read only by the server (service role bypasses RLS); no client access.
ALTER TABLE public.mux_upload_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mux_upload_requests FROM anon, authenticated;
