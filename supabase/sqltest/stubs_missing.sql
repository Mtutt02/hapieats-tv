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

-- r5: 20260711_academy.sql section 10 verbatim, minus the institutions FK (the academy migration cannot apply in PGlite)
CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, title TEXT NOT NULL, slug TEXT, description TEXT,
  credential_tier TEXT NOT NULL DEFAULT 'skill' CHECK (credential_tier IN ('completion','skill','diploma')),
  price NUMERIC(10,2) NOT NULL DEFAULT 0, stripe_price_id TEXT, is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "programs_read" ON public.programs;
CREATE POLICY "programs_read" ON public.programs FOR SELECT USING (true);
CREATE TABLE IF NOT EXISTS public.program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, user_id));
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "program_enroll_own" ON public.program_enrollments;
CREATE POLICY "program_enroll_own" ON public.program_enrollments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
