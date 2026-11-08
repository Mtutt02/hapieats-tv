-- Objects the repo's migrations assume but never create (made in the Supabase dashboard).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'viewer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
CREATE TABLE IF NOT EXISTS public.courses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), creator_id UUID, title TEXT);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_connect_status TEXT;
-- Verbatim from 20260711_academy.sql section 8 (that file cannot apply: needs dashboard-made course_lessons etc.)
CREATE TABLE IF NOT EXISTS public.pro_payout_pool (
  month TEXT PRIMARY KEY, gross_cents BIGINT NOT NULL DEFAULT 0, pool_cents BIGINT NOT NULL DEFAULT 0,
  total_credits NUMERIC(14,2) NOT NULL DEFAULT 0, distributed BOOLEAN NOT NULL DEFAULT false,
  distributed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.pro_payout_pool ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pro_pool_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL, credits NUMERIC(14,2) NOT NULL DEFAULT 0, cents BIGINT NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (creator_id, month));
ALTER TABLE public.pro_pool_earnings ENABLE ROW LEVEL SECURITY;

-- r3: 20260711_academy.sql 14 verbatim (academy migration itself cannot apply in PGlite)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS enrollment_count INT NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.bump_course_enrollment(p_course_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.courses SET enrollment_count = enrollment_count + 1 WHERE id = p_course_id;
$$;
REVOKE ALL ON FUNCTION public.bump_course_enrollment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_course_enrollment(UUID) TO authenticated, service_role;
